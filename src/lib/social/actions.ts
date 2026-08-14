"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability/report-server";
import { activityOf, type ActivityKey } from "@/lib/workout/calories";
import { guardAction, LIMITS } from "@/lib/security/action-guard";
import type { PresenceStatus } from "./types";
import { z } from "zod";

// Canlı oturum/parti başlığı: kolon sınırsız `text`. Server action dışarıdan
// doğrudan POST edilebildiği için arayüzdeki maxlength koruma sayılmaz.
const baslikSchema = z.string().trim().max(80).nullable().optional();

export interface SocialResult<T = undefined> { ok: boolean; error?: string; data?: T }
const fail = (e: string): SocialResult<never> => ({ ok: false, error: e });

type Admin = ReturnType<typeof createAdminClient>;

async function me(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function displayName(admin: Admin, userId: string): Promise<string> {
  const { data } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return (data?.full_name as string) ?? "Bir sporcu";
}

// ---------------------------------------------------------------------------
// Arkadaşlık
// ---------------------------------------------------------------------------
export async function sendFriendRequest(targetId: string): Promise<SocialResult<{ status: "sent" | "accepted" }>> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  if (userId === targetId) return fail("Kendine istek gönderemezsin.");

  const rl = await guardAction("friend:request", userId, LIMITS.invite);
  if (!rl.ok) return fail(rl.error!);

  try {
    const admin = createAdminClient();

    // Karşı taraf zaten bana istek göndermişse doğrudan kabul et
    const { data: incoming } = await admin.from("friendships")
      .select("id, status").eq("requester_id", targetId).eq("addressee_id", userId).maybeSingle();
    if (incoming) {
      if (incoming.status === "accepted") return { ok: true, data: { status: "accepted" } };
      await admin.from("friendships")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", incoming.id as string);
      await admin.from("notifications").insert({
        user_id: targetId, type: "achievement", title: "Arkadaşlık kabul edildi",
        body: `${await displayName(admin, userId)} artık arkadaşın.`, href: "/teams",
      });
      revalidatePath("/teams");
      return { ok: true, data: { status: "accepted" } };
    }

    const { data: existing } = await admin.from("friendships")
      .select("id, status").eq("requester_id", userId).eq("addressee_id", targetId).maybeSingle();
    if (existing) {
      if (existing.status === "accepted") return { ok: true, data: { status: "accepted" } };
      await admin.from("friendships")
        .update({ status: "pending", responded_at: null }).eq("id", existing.id as string);
    } else {
      const { error } = await admin.from("friendships")
        .insert({ requester_id: userId, addressee_id: targetId, status: "pending" });
      if (error) return fail(error.message);
    }

    await admin.from("notifications").insert({
      user_id: targetId, type: "info", title: "Yeni arkadaşlık isteği",
      body: `${await displayName(admin, userId)} seni arkadaş olarak eklemek istiyor.`, href: "/teams",
    });
    revalidatePath("/teams");
    return { ok: true, data: { status: "sent" } };
  } catch (err) {
    await reportError(err, { where: "social/sendFriendRequest", userId });
    return fail("İstek gönderilemedi.");
  }
}

export async function respondFriendRequest(requestId: string, accept: boolean): Promise<SocialResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const { data: req } = await admin.from("friendships")
      .select("id, requester_id, addressee_id").eq("id", requestId).maybeSingle();
    if (!req) return fail("İstek bulunamadı.");
    if (req.addressee_id !== userId) return fail("Bu isteği yanıtlayamazsın.");

    await admin.from("friendships").update({
      status: accept ? "accepted" : "declined",
      responded_at: new Date().toISOString(),
    }).eq("id", requestId);

    if (accept) {
      await admin.from("notifications").insert({
        user_id: req.requester_id as string, type: "achievement", title: "Arkadaşlık kabul edildi",
        body: `${await displayName(admin, userId)} isteğini kabul etti.`, href: "/teams",
      });
    }
    revalidatePath("/teams");
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "social/respondFriendRequest", userId });
    return fail("İşlem yapılamadı.");
  }
}

export async function removeFriend(targetId: string): Promise<SocialResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    await admin.from("friendships").delete()
      .or(`and(requester_id.eq.${userId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${userId})`);
    revalidatePath("/teams");
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "social/removeFriend", userId });
    return fail("Kaldırılamadı.");
  }
}

// ---------------------------------------------------------------------------
// Takip
// ---------------------------------------------------------------------------
export async function toggleFollow(targetId: string): Promise<SocialResult<{ following: boolean }>> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  if (userId === targetId) return fail("Kendini takip edemezsin.");
  try {
    const admin = createAdminClient();
    const { data: existing } = await admin.from("follows")
      .select("follower_id").eq("follower_id", userId).eq("following_id", targetId).maybeSingle();
    if (existing) {
      await admin.from("follows").delete().eq("follower_id", userId).eq("following_id", targetId);
      revalidatePath("/teams");
      return { ok: true, data: { following: false } };
    }
    await admin.from("follows").insert({ follower_id: userId, following_id: targetId });
    await admin.from("notifications").insert({
      user_id: targetId, type: "info", title: "Yeni takipçi",
      body: `${await displayName(admin, userId)} seni takip etmeye başladı.`, href: "/teams",
    });
    revalidatePath("/teams");
    return { ok: true, data: { following: true } };
  } catch (err) {
    await reportError(err, { where: "social/toggleFollow", userId });
    return fail("İşlem yapılamadı.");
  }
}

// ---------------------------------------------------------------------------
// Kişisel akış
// ---------------------------------------------------------------------------

/**
 * Kişisel akış gönderisi.
 *
 * `visibility` = "team" seçilirse gönderi kullanıcının takımına yazılır ve takım
 * akışında da görünür — yani takım gönderisi ile kişisel gönderi aynı tabloda,
 * yalnızca kapsamları farklı (bkz. migration 0044).
 */
export async function createFeedPost(input: {
  body: string;
  visibility: "team" | "friends" | "public";
}): Promise<SocialResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  const text = (input.body ?? "").trim();
  if (!text) return fail("Boş gönderi paylaşılamaz.");
  if (text.length > 1000) return fail("Gönderi en fazla 1000 karakter olabilir.");
  if (!["team", "friends", "public"].includes(input.visibility)) return fail("Geçersiz görünürlük.");

  const rl = await guardAction("feed:post", userId, LIMITS.post);
  if (!rl.ok) return fail(rl.error!);

  try {
    const admin = createAdminClient();
    let teamId: string | null = null;

    if (input.visibility === "team") {
      const { data: m } = await admin.from("team_members")
        .select("team_id").eq("user_id", userId).maybeSingle();
      if (!m) return fail("Henüz bir takımın yok. Önce bir takıma katıl.");
      teamId = m.team_id as string;
    }

    const { error } = await admin.from("team_posts").insert({
      team_id: teamId,
      user_id: userId,
      kind: "post",
      body: text,
      visibility: input.visibility,
    });
    if (error) return fail(error.message);

    revalidatePath("/feed");
    revalidatePath("/teams");
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "social/createFeedPost", userId });
    return fail("Paylaşılamadı.");
  }
}

// ---------------------------------------------------------------------------
// Presence (kalp atışı)
// ---------------------------------------------------------------------------
export async function heartbeat(input?: {
  status?: PresenceStatus; activity?: string | null; teamId?: string | null;
}): Promise<SocialResult> {
  const userId = await me();
  if (!userId) return { ok: false };
  try {
    const admin = createAdminClient();
    await admin.from("user_presence").upsert({
      user_id: userId,
      status: input?.status ?? "online",
      activity: input?.activity ?? null,
      team_id: input?.teamId ?? null,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Birlikte antrenman (canlı oturum)
// ---------------------------------------------------------------------------
export async function startLiveSession(teamId: string, title?: string): Promise<SocialResult<{ id: string }>> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const { data: member } = await admin.from("team_members")
      .select("user_id").eq("team_id", teamId).eq("user_id", userId).maybeSingle();
    if (!member) return fail("Bu takımın üyesi değilsin.");

    // Zaten canlı bir oturum varsa ona katıl
    const { data: live } = await admin.from("team_live_sessions")
      .select("id").eq("team_id", teamId).eq("status", "live")
      .order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (live) {
      await joinLiveSessionInternal(admin, live.id as string, userId);
      revalidatePath("/teams");
      return { ok: true, data: { id: live.id as string } };
    }

    const { data: session, error } = await admin.from("team_live_sessions").insert({
      team_id: teamId, host_id: userId,
      title: baslikSchema.safeParse(title).data?.trim() || "Birlikte Antrenman",
    }).select("id").single();
    if (error || !session) return fail(error?.message ?? "Oturum başlatılamadı.");

    await joinLiveSessionInternal(admin, session.id as string, userId);

    const name = await displayName(admin, userId);
    const { data: members } = await admin.from("team_members").select("user_id").eq("team_id", teamId);
    const rows = ((members as { user_id: string }[]) ?? [])
      .filter((m) => m.user_id !== userId)
      .map((m) => ({
        user_id: m.user_id, type: "workout" as const,
        title: "Birlikte antrenman başladı 🏋️",
        body: `${name} antrenmana başladı. Sen de katıl!`, href: "/teams",
      }));
    if (rows.length) await admin.from("notifications").insert(rows);

    revalidatePath("/teams");
    return { ok: true, data: { id: session.id as string } };
  } catch (err) {
    await reportError(err, { where: "social/startLiveSession", userId });
    return fail("Oturum başlatılamadı.");
  }
}

async function joinLiveSessionInternal(admin: Admin, sessionId: string, userId: string) {
  await admin.from("team_live_participants").upsert(
    { session_id: sessionId, user_id: userId, joined_at: new Date().toISOString(), left_at: null },
    { onConflict: "session_id,user_id" }
  );
  await admin.from("user_presence").upsert({
    user_id: userId, status: "training", activity: "Birlikte antrenman", last_seen_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
}

/**
 * Arkadaş bazlı Workout Party başlatır (takım gerektirmez).
 *
 * Takım oturumundan farkı: `team_id` null, görünürlük "friends" ve katılım
 * açık davetle olur. Seçilen aktivitenin MET katsayısı oturuma yazılır;
 * `end_live_session()` kaloriyi bu katsayı ve katılımcının kilosuyla hesaplar.
 */
export async function startFriendParty(input: {
  title?: string;
  activity?: ActivityKey;
  friendIds?: string[];
}): Promise<SocialResult<{ id: string }>> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");

  const rl = await guardAction("party:start", userId, LIMITS.invite);
  if (!rl.ok) return fail(rl.error!);

  try {
    const admin = createAdminClient();

    // Zaten açık bir partim varsa yenisini açma — ona yönlendir.
    const { data: existing } = await admin.from("team_live_sessions")
      .select("id").eq("host_id", userId).eq("status", "live").is("team_id", null)
      .order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (existing) {
      await joinLiveSessionInternal(admin, existing.id as string, userId);
      revalidatePath("/feed");
      return { ok: true, data: { id: existing.id as string } };
    }

    const act = activityOf(input.activity);
    const { data: session, error } = await admin.from("team_live_sessions").insert({
      team_id: null,
      host_id: userId,
      title: baslikSchema.safeParse(input.title).data?.trim() || `${act.emoji} ${act.label} Partisi`,
      visibility: "friends",
      activity: act.key,
      met: act.met,
    }).select("id").single();
    if (error || !session) return fail(error?.message ?? "Parti başlatılamadı.");

    const sessionId = session.id as string;
    await joinLiveSessionInternal(admin, sessionId, userId);

    // Davetliler: yalnızca gerçekten arkadaş olanlar (istemciden gelen listeye güvenilmez)
    const requested = [...new Set((input.friendIds ?? []).filter((f) => f && f !== userId))];
    if (requested.length) {
      const { data: friendRows } = await admin.from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
      const friendSet = new Set(
        ((friendRows as { requester_id: string; addressee_id: string }[]) ?? [])
          .map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id))
      );
      const invitees = requested.filter((id) => friendSet.has(id));

      if (invitees.length) {
        await admin.from("live_session_invites").upsert(
          invitees.map((id) => ({ session_id: sessionId, user_id: id, invited_by: userId })),
          { onConflict: "session_id,user_id" }
        );
        const name = await displayName(admin, userId);
        await admin.from("notifications").insert(
          invitees.map((id) => ({
            user_id: id, type: "workout" as const,
            title: "Birlikte antrenman daveti 🏋️",
            body: `${name} seni ${act.label.toLowerCase()} partisine davet etti.`,
            href: "/feed",
          }))
        );
      }
    }

    revalidatePath("/feed");
    revalidatePath("/teams");
    return { ok: true, data: { id: sessionId } };
  } catch (err) {
    await reportError(err, { where: "social/startFriendParty", userId });
    return fail("Parti başlatılamadı.");
  }
}

export async function joinLiveSession(sessionId: string): Promise<SocialResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const { data: s } = await admin.from("team_live_sessions")
      .select("id, team_id, status").eq("id", sessionId).maybeSingle();
    if (!s || s.status !== "live") return fail("Bu oturum artık aktif değil.");

    // Görünürlük kuralı tek yerde: `can_see_live_session()` RPC'si (migration 0044).
    // Takım üyeliği, davet ve arkadaşlık koşullarını birlikte değerlendirir.
    const { data: allowed } = await admin.rpc("can_see_live_session", {
      p_session: sessionId, p_viewer: userId,
    });
    if (allowed !== true) return fail("Bu antrenmana katılma yetkin yok.");

    await joinLiveSessionInternal(admin, sessionId, userId);
    revalidatePath("/teams");
    revalidatePath("/feed");
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "social/joinLiveSession", userId });
    return fail("Katılınamadı.");
  }
}

export async function leaveLiveSession(sessionId: string): Promise<SocialResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const { data: p } = await admin.from("team_live_participants")
      .select("id, joined_at").eq("session_id", sessionId).eq("user_id", userId).maybeSingle();
    if (p) {
      const secs = Math.max(0, Math.round((Date.now() - new Date(p.joined_at as string).getTime()) / 1000));
      await admin.from("team_live_participants")
        .update({ left_at: new Date().toISOString(), duration_sec: secs })
        .eq("id", p.id as string);
    }
    await admin.from("user_presence").upsert({
      user_id: userId, status: "online", activity: null, last_seen_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    revalidatePath("/teams");
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "social/leaveLiveSession", userId });
    return fail("Ayrılınamadı.");
  }
}

/** Oturumu bitirir; RPC süreleri hesaplar, bonus XP dağıtır, akışa düşer. */
export async function endLiveSession(sessionId: string): Promise<SocialResult<{ totalXp: number }>> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const { data: s } = await admin.from("team_live_sessions")
      .select("id, team_id, host_id, status").eq("id", sessionId).maybeSingle();
    if (!s) return fail("Oturum bulunamadı.");
    if (s.status === "ended") return { ok: true, data: { totalXp: 0 } };

    if (s.host_id !== userId) {
      // Arkadaş partisinde (team_id null) moderatörlük kavramı yoktur —
      // yalnızca başlatan bitirebilir.
      if (!s.team_id) return fail("Oturumu yalnızca başlatan kişi bitirebilir.");
      const { data: role } = await admin.from("team_members")
        .select("role").eq("team_id", s.team_id as string).eq("user_id", userId).maybeSingle();
      const r = (role?.role as string) ?? "";
      if (!["owner", "admin", "moderator"].includes(r)) return fail("Oturumu yalnızca başlatan kişi bitirebilir.");
    }

    const { data: total, error } = await admin.rpc("end_live_session", { p_session: sessionId });
    if (error) return fail(error.message);

    await admin.from("user_presence").upsert({
      user_id: userId, status: "online", activity: null, last_seen_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    revalidatePath("/teams");
    revalidatePath("/gamification");
    return { ok: true, data: { totalXp: Number(total) || 0 } };
  } catch (err) {
    await reportError(err, { where: "social/endLiveSession", userId });
    return fail("Oturum bitirilemedi.");
  }
}
