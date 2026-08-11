"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getLeaderboard, getTeamRoster, type LeaderboardResult, type TeamRosterMember } from "./queries";
import { guardAction, LIMITS } from "@/lib/security/action-guard";
import type { RewardCatalogItem, LeaderboardPeriod, LeaderboardScope, SyncGamificationResult } from "@/lib/database.types";

export interface GamResult<T = undefined> { ok: boolean; error?: string; data?: T; }
const fail = (e: string): GamResult<never> => ({ ok: false, error: e });

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

const STREAK_MILESTONES = [3, 7, 15, 30, 60, 100, 365];

/** Oyunlaştırma olayları için bildirim oluşturur (seviye/başarım/seri). */
async function notifyGamificationEvents(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  beforeLevel: number,
  beforeStreak: number,
  beforeAchIds: Set<string>,
  after: SyncGamificationResult
) {
  // type: notification_type enum → 'info'|'workout'|'nutrition'|'achievement'|'coach'
  const rows: { user_id: string; type: string; title: string; body: string; href: string }[] = [];

  // Seviye atladı
  if (after.level > beforeLevel) {
    const { data: lv } = await admin.from("levels").select("title").eq("level", after.level).maybeSingle();
    rows.push({
      user_id: userId, type: "achievement", href: "/gamification",
      title: "🎉 Seviye atladın!",
      body: `Artık Seviye ${after.level}${lv?.title ? ` — ${lv.title}` : ""}. Muhteşem gidiyorsun!`,
    });
  }

  // Yeni açılan başarımlar
  const { data: nowCompleted } = await admin
    .from("achievement_progress").select("achievement_id").eq("user_id", userId).eq("completed", true);
  const newIds = ((nowCompleted as { achievement_id: string }[]) ?? [])
    .map((r) => r.achievement_id).filter((id) => !beforeAchIds.has(id));
  if (newIds.length) {
    const { data: achs } = await admin.from("achievements").select("id, name, xp_reward").in("id", newIds);
    for (const a of (achs as { id: string; name: string; xp_reward: number }[]) ?? []) {
      rows.push({
        user_id: userId, type: "achievement", href: "/gamification",
        title: "🏆 Yeni başarım!",
        body: `"${a.name}" başarımını açtın (+${a.xp_reward} XP).`,
      });
    }
  }

  // Seri kilometre taşı
  if (after.current_streak > beforeStreak && STREAK_MILESTONES.includes(after.current_streak)) {
    rows.push({
      user_id: userId, type: "workout", href: "/gamification",
      title: "🔥 Seri devam ediyor!",
      body: `${after.current_streak} günlük seriye ulaştın. Bozma, harika gidiyor!`,
    });
  }

  if (rows.length) await admin.from("notifications").insert(rows);
}

/**
 * Geçerli kullanıcının XP/seviye/başarım/streak durumunu yeniden hesaplar.
 * Antrenman tamamlama, su/beslenme kaydı gibi olaylardan sonra çağrılır.
 * Seviye/başarım/seri değişimlerinde bildirim oluşturur.
 * Hafif ateşle-unut: hata olsa da çağıran akışı bozmaz.
 */
export async function syncMyGamification(): Promise<GamResult<SyncGamificationResult>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Oturum bulunamadı.");

  // Önceki durum (bildirim farkı için)
  const [{ data: before }, { data: beforeAch }] = await Promise.all([
    supabase.from("user_gamification").select("level, current_streak").eq("user_id", user.id).maybeSingle(),
    supabase.from("achievement_progress").select("achievement_id").eq("user_id", user.id).eq("completed", true),
  ]);
  const beforeLevel = (before as { level: number } | null)?.level ?? 1;
  const beforeStreak = (before as { current_streak: number } | null)?.current_streak ?? 0;
  const beforeAchIds = new Set(((beforeAch as { achievement_id: string }[]) ?? []).map((r) => r.achievement_id));

  const { data, error } = await supabase.rpc("sync_gamification", { p_user: user.id });
  if (error) return fail(error.message);
  const result = data as SyncGamificationResult;

  // Bildirimler (best-effort — akışı bozmaz)
  try {
    await notifyGamificationEvents(createAdminClient(), user.id, beforeLevel, beforeStreak, beforeAchIds, result);
  } catch { /* bildirim başarısızlığı kritik değil */ }

  revalidatePath("/dashboard");
  revalidatePath("/gamification");
  return { ok: true, data: result };
}

/** Liderlik tablosunu istemciden dinamik olarak yükler (dönem/kapsam değişimi). */
export async function loadLeaderboard(
  period: LeaderboardPeriod,
  scope: LeaderboardScope,
  scopeValue?: string | null,
  opts?: { limit?: number; offset?: number }
): Promise<LeaderboardResult> {
  const user = await currentUser();
  if (!user) return { rows: [], me: null, total: 0, needsProfile: false, scopeValue: null };
  return getLeaderboard({
    period, scope, scopeValue: scopeValue ?? null, userId: user.id,
    limit: opts?.limit, offset: opts?.offset,
  });
}

/** Liderlik bölge filtresi için ülke/şehir kaydeder. */
export async function saveLeaderboardRegion(country?: string | null, city?: string | null): Promise<GamResult> {
  const user = await currentUser();
  if (!user) return fail("Oturum bulunamadı.");
  const patch: Record<string, string | null> = {};
  if (country !== undefined) patch.country = (country ?? "").trim() || null;
  if (city !== undefined) patch.city = (city ?? "").trim() || null;
  if (Object.keys(patch).length === 0) return { ok: true };
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update(patch).eq("id", user.id);
  if (error) return fail(error.message);
  revalidatePath("/gamification");
  return { ok: true };
}

/** Ödül talep et — coin bakiyesini düşürür, ödülü uygular. */
export async function claimReward(rewardId: string): Promise<GamResult> {
  const user = await currentUser();
  if (!user) return fail("Oturum bulunamadı.");
  const admin = createAdminClient();

  const { data: reward } = await admin.from("reward_catalog").select("*").eq("id", rewardId).eq("enabled", true).maybeSingle();
  if (!reward) return fail("Ödül bulunamadı.");
  const r = reward as RewardCatalogItem;

  // Atomik harcama (migration 0040). Bakiye `coins_earned - coins_spent` olarak
  // türetildiği için sync_gamification yeniden hesaplasa da harcama kaybolmaz.
  // Tek UPDATE + koşul → eşzamanlı ikinci istek false döner, çift harcama olmaz.
  const { data: spent, error: spendErr } = await admin.rpc("spend_coins", {
    p_user: user.id,
    p_amount: r.cost_coins,
  });
  if (spendErr) return fail(spendErr.message);
  if (spent !== true) return fail("Yetersiz coin bakiyesi.");

  // Tüketilen ödüller 'consumed' (tekrar alınabilir); kozmetik ödüller 'active'
  // (uq_reward_claims_active ile tekilleştirilir → aynı kozmetik iki kez alınamaz).
  const consumable = r.type === "premium_days";
  const { error: claimErr } = await admin.from("reward_claims").insert({
    user_id: user.id, reward_id: rewardId, status: consumable ? "consumed" : "active", meta: r.value,
  });
  if (claimErr) {
    // Harcamayı geri al (best-effort).
    await admin.rpc("refund_coins", { p_user: user.id, p_amount: r.cost_coins });
    // 23505 = unique ihlali → kozmetik ödüle zaten sahip.
    if ((claimErr as { code?: string }).code === "23505") return fail("Bu ödüle zaten sahipsin.");
    return fail(claimErr.message);
  }

  // Premium gün ödülü ise profile uygula (mevcut süreyi uzat).
  if (r.type === "premium_days") {
    const days = Number((r.value as { days?: number }).days ?? 0);
    if (days > 0) {
      const { data: prof } = await admin.from("profiles").select("premium_until").eq("id", user.id).maybeSingle();
      const base = prof?.premium_until && new Date(prof.premium_until).getTime() > Date.now()
        ? new Date(prof.premium_until).getTime() : Date.now();
      const until = new Date(base + days * 864e5).toISOString();
      await admin.from("profiles").update({ is_premium: true, membership_type: "premium", premium_until: until }).eq("id", user.id);
    }
  }

  revalidatePath("/gamification");
  return { ok: true };
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Takım oluştur (kurucu = kullanıcı). */
export async function createTeam(name: string, description?: string): Promise<GamResult<{ id: string }>> {
  const user = await currentUser();
  if (!user) return fail("Oturum bulunamadı.");
  const clean = name.trim();
  if (clean.length < 3) return fail("Takım adı en az 3 karakter olmalı.");
  const admin = createAdminClient();
  const slug = `${slugify(clean)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await admin.from("teams").insert({
    name: clean, slug, description: description?.trim() || null, owner_id: user.id,
  }).select("id").single();
  if (error) return fail(error.message);
  await admin.from("team_members").insert({ team_id: data.id, user_id: user.id, role: "owner" });
  revalidatePath("/gamification");
  return { ok: true, data: { id: data.id as string } };
}

export async function joinTeam(teamId: string): Promise<GamResult> {
  const user = await currentUser();
  if (!user) return fail("Oturum bulunamadı.");
  const admin = createAdminClient();
  const { error } = await admin.from("team_members").upsert(
    { team_id: teamId, user_id: user.id, role: "member" }, { onConflict: "team_id,user_id" }
  );
  if (error) return fail(error.message);
  revalidatePath("/gamification");
  return { ok: true };
}

export async function leaveTeam(teamId: string): Promise<GamResult> {
  const user = await currentUser();
  if (!user) return fail("Oturum bulunamadı.");
  const admin = createAdminClient();
  const { error } = await admin.from("team_members").delete().eq("team_id", teamId).eq("user_id", user.id);
  if (error) return fail(error.message);
  revalidatePath("/gamification");
  return { ok: true };
}

/** Bir takımın üye kadrosunu (katkıya göre sıralı) getirir — client istek üzerine. */
export async function teamRoster(teamId: string): Promise<GamResult<TeamRosterMember[]>> {
  const user = await currentUser();
  if (!user) return fail("Oturum bulunamadı.");
  try {
    const roster = await getTeamRoster(teamId, user.id);
    return { ok: true, data: roster };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Kadro yüklenemedi.");
  }
}

// ---------------------------------------------------------------------------
// Battle Pass — sezon kademesi ödülü
// ---------------------------------------------------------------------------

/**
 * Sezon kademesi ödülünü talep eder.
 *
 * Tüm iş kuralı `claim_season_tier()` RPC'sinde: XP eşiği, premium kontrolü,
 * çift talep koruması (unique kısıt) ve ödülün uygulanması tek transaction'da.
 * RPC `auth.uid()` kullandığı için oturumlu istemciyle çağrılır.
 */
export async function claimSeasonTier(
  trackId: string,
  lane: "free" | "premium"
): Promise<GamResult<{ label: string; tier: number }>> {
  const user = await currentUser();
  if (!user) return fail("Oturum bulunamadı.");
  if (lane !== "free" && lane !== "premium") return fail("Geçersiz şerit.");

  const rl = await guardAction("season:claim", user.id, LIMITS.sensitive);
  if (!rl.ok) return fail(rl.error!);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_season_tier", {
    p_track: trackId,
    p_lane: lane,
  });
  if (error) return fail(error.message);

  const r = (data ?? {}) as Record<string, unknown>;
  if (!r.ok) return fail((r.error as string) ?? "Ödül alınamadı.");

  revalidatePath("/gamification");
  revalidatePath("/rewards");
  return {
    ok: true,
    data: {
      label: ((r.reward as Record<string, unknown>)?.label as string) ?? "Ödül",
      tier: Number(r.tier) || 0,
    },
  };
}
