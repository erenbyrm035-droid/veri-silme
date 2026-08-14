"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability/report-server";
import { ROLE_RANK, type TeamRole, type ReactionKind, type MessageKind, type QuestMetric, type EventKind } from "./types";
import { guardAction, LIMITS } from "@/lib/security/action-guard";
import {
  createTeamSchema, updateTeamSchema, postBodySchema, commentBodySchema,
  messageSchema, questSchema, eventSchema, ilkHata,
} from "./schema";

export interface TeamResult<T = undefined> { ok: boolean; error?: string; data?: T }
const fail = (e: string): TeamResult<never> => ({ ok: false, error: e });

type Admin = ReturnType<typeof createAdminClient>;

async function me(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Kullanıcının takımdaki rolü. */
async function roleOf(admin: Admin, teamId: string, userId: string): Promise<TeamRole | null> {
  const { data } = await admin.from("team_members").select("role").eq("team_id", teamId).eq("user_id", userId).maybeSingle();
  return (data?.role as TeamRole) ?? null;
}
async function canAct(admin: Admin, teamId: string, userId: string, min: TeamRole): Promise<boolean> {
  const r = await roleOf(admin, teamId, userId);
  return !!r && ROLE_RANK[r] >= ROLE_RANK[min];
}

/**
 * Bir gönderi/etkinlik ile etkileşim (yorum, tepki, katılım) izni.
 *
 * NEDEN GEREKLİ: bu dosyadaki tüm sorgular `createAdminClient` ile, yani
 * RLS ATLANARAK çalışıyor. Güvenlik tamamen buradaki kontrollere bağlı.
 * Yorum/tepki/katılım fonksiyonları istemciden gelen ham `postId`/`eventId`
 * ile doğrudan yazıyordu ve çağıranın o takımın üyesi olup olmadığını hiç
 * sormuyordu — yani oturumu olan herkes ÜYESİ OLMADIĞI gizli bir takımın
 * gönderisine yorum yazabiliyor, etkinliğine kendini "katılıyor" olarak
 * ekleyebiliyordu (ve etkinlik hatırlatma cron'u sonra ona bildirim
 * gönderiyordu).
 *
 * `team_posts.team_id` NULL olabilir (migration 0044): kişisel akış
 * gönderileri. Onlar takıma ait değil, üyelik kontrolü de anlamsız —
 * görünürlükleri akış katmanında belirleniyor.
 *
 * @returns izin varsa `null`, yoksa döndürülecek hata sonucu
 */
async function assertCanInteract(
  admin: Admin,
  table: "team_posts" | "team_events",
  rowId: string,
  userId: string
): Promise<TeamResult<never> | null> {
  const { data } = await admin.from(table).select("team_id").eq("id", rowId).maybeSingle();
  if (!data) return fail(table === "team_posts" ? "Gönderi bulunamadı." : "Etkinlik bulunamadı.");
  const teamId = data.team_id as string | null;
  if (!teamId) return null; // kişisel gönderi — takım üyeliği aranmaz
  if (!(await canAct(admin, teamId, userId, "member"))) return fail("Bu takımın üyesi değilsin.");
  return null;
}

function touch(slug?: string) {
  revalidatePath("/teams");
  if (slug) revalidatePath(`/teams/${slug}`);
  revalidatePath("/gamification");
}

/** Takım üyelerine bildirim gönderir (kendisi hariç). */
async function notifyTeam(
  admin: Admin, teamId: string, exceptUserId: string | null,
  title: string, body: string, href: string
) {
  const { data } = await admin.from("team_members").select("user_id").eq("team_id", teamId);
  const rows = ((data as { user_id: string }[]) ?? [])
    .filter((m) => m.user_id !== exceptUserId)
    .map((m) => ({ user_id: m.user_id, type: "info" as const, title, body, href }));
  if (rows.length) await admin.from("notifications").insert(rows);
}

/** Takım seviyesi + rozetlerini yeniden değerlendirir (sessiz). */
async function refreshTeamMeta(admin: Admin, teamId: string) {
  try {
    await admin.rpc("sync_team_level", { p_team: teamId });
    await admin.rpc("evaluate_team_badges", { p_team: teamId });
  } catch { /* kritik değil */ }
}

// ---------------------------------------------------------------------------
// Takım kurma / katılma / ayrılma
// ---------------------------------------------------------------------------
const slugify = (s: string) =>
  s.toLowerCase().trim()
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export async function createTeam(input: {
  name: string; description?: string; city?: string; country?: string;
  joinPolicy?: "open" | "request" | "invite"; color?: string;
}): Promise<TeamResult<{ slug: string }>> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  const v = createTeamSchema.safeParse(input);
  if (!v.success) return fail(ilkHata(v.error));
  const name = v.data.name;

  try {
    const admin = createAdminClient();
    const { data: existing } = await admin.from("team_members").select("team_id").eq("user_id", userId).maybeSingle();
    if (existing) return fail("Zaten bir takımdasın. Önce mevcut takımdan ayrıl.");

    let slug = slugify(name) || `takim-${Date.now().toString(36)}`;
    const { data: taken } = await admin.from("teams").select("id").eq("slug", slug).maybeSingle();
    if (taken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const { data: code } = await admin.rpc("gen_team_code");
    const { data: team, error } = await admin.from("teams").insert({
      name, slug,
      description: input.description?.trim() || null,
      city: input.city?.trim() || null,
      country: input.country?.trim() || null,
      join_policy: input.joinPolicy ?? "open",
      color: input.color ?? "#A3E635",
      owner_id: userId,
      invite_code: (code as string) ?? null,
    }).select("id, slug").single();
    if (error || !team) return fail(error?.message ?? "Takım oluşturulamadı.");

    await admin.from("team_members").insert({ team_id: team.id, user_id: userId, role: "owner" });
    touch(team.slug);
    return { ok: true, data: { slug: team.slug } };
  } catch (err) {
    await reportError(err, { where: "teams/createTeam", userId });
    return fail("Takım oluşturulamadı.");
  }
}

export async function joinTeam(teamId: string, opts?: { message?: string }): Promise<TeamResult<{ status: "joined" | "requested" }>> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const { data: already } = await admin.from("team_members").select("team_id").eq("user_id", userId).maybeSingle();
    if (already) return fail("Zaten bir takımdasın.");

    const { data: team } = await admin.from("teams").select("id, slug, join_policy, member_limit").eq("id", teamId).maybeSingle();
    if (!team) return fail("Takım bulunamadı.");

    const { count } = await admin.from("team_members").select("id", { count: "exact", head: true }).eq("team_id", teamId);
    if ((count ?? 0) >= (team.member_limit ?? 100)) return fail("Takım kontenjanı dolu.");

    if (team.join_policy === "request" || team.join_policy === "invite") {
      await admin.from("team_join_requests").upsert(
        { team_id: teamId, user_id: userId, message: opts?.message?.trim() || null, status: "pending" },
        { onConflict: "team_id,user_id" }
      );
      await notifyTeam(admin, teamId, userId, "Yeni katılım isteği", "Takımına katılmak isteyen biri var.", `/teams/${team.slug}`);
      touch(team.slug);
      return { ok: true, data: { status: "requested" } };
    }

    await admin.from("team_members").insert({ team_id: teamId, user_id: userId, role: "member" });
    await notifyTeam(admin, teamId, userId, "Yeni üye", "Takımına yeni bir sporcu katıldı.", `/teams/${team.slug}`);
    await refreshTeamMeta(admin, teamId);
    touch(team.slug);
    return { ok: true, data: { status: "joined" } };
  } catch (err) {
    await reportError(err, { where: "teams/joinTeam", userId });
    return fail("Takıma katılınamadı.");
  }
}

/** Davet kodu veya davet linki token'ı ile katılım. */
export async function joinByCode(code: string): Promise<TeamResult<{ slug: string }>> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  const value = code.trim().toUpperCase();
  if (!value) return fail("Kod boş olamaz.");
  try {
    const admin = createAdminClient();
    let teamId: string | null = null;

    const { data: byCode } = await admin.from("teams").select("id").eq("invite_code", value).maybeSingle();
    if (byCode) teamId = byCode.id as string;
    if (!teamId) {
      const { data: inv } = await admin.from("team_invites").select("id, team_id, max_uses, uses, expires_at").eq("token", code.trim()).maybeSingle();
      if (inv) {
        if (inv.expires_at && new Date(inv.expires_at as string) < new Date()) return fail("Davet süresi dolmuş.");
        if (inv.max_uses != null && (inv.uses as number) >= (inv.max_uses as number)) return fail("Davet kullanım limiti dolmuş.");
        teamId = inv.team_id as string;
        await admin.from("team_invites").update({ uses: (inv.uses as number) + 1 }).eq("id", inv.id as string);
      }
    }
    if (!teamId) return fail("Geçersiz davet kodu.");

    const { data: already } = await admin.from("team_members").select("team_id").eq("user_id", userId).maybeSingle();
    if (already) return fail("Zaten bir takımdasın.");

    const { data: team } = await admin.from("teams").select("slug, member_limit").eq("id", teamId).maybeSingle();
    const { count } = await admin.from("team_members").select("id", { count: "exact", head: true }).eq("team_id", teamId);
    if ((count ?? 0) >= ((team?.member_limit as number) ?? 100)) return fail("Takım kontenjanı dolu.");

    await admin.from("team_members").insert({ team_id: teamId, user_id: userId, role: "member" });
    await notifyTeam(admin, teamId, userId, "Yeni üye", "Takımına davetle yeni bir sporcu katıldı.", `/teams/${team?.slug}`);
    await refreshTeamMeta(admin, teamId);
    touch(team?.slug as string);
    return { ok: true, data: { slug: team?.slug as string } };
  } catch (err) {
    await reportError(err, { where: "teams/joinByCode", userId });
    return fail("Katılım başarısız.");
  }
}

export async function leaveTeam(teamId: string): Promise<TeamResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const role = await roleOf(admin, teamId, userId);
    if (!role) return fail("Bu takımda değilsin.");
    if (role === "owner") {
      const { count } = await admin.from("team_members").select("id", { count: "exact", head: true }).eq("team_id", teamId);
      if ((count ?? 0) > 1) return fail("Kurucu olarak ayrılmadan önce kuruculuğu başka bir üyeye devret.");
    }
    await admin.from("team_members").delete().eq("team_id", teamId).eq("user_id", userId);
    touch();
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "teams/leaveTeam", userId });
    return fail("Takımdan ayrılınamadı.");
  }
}

// ---------------------------------------------------------------------------
// Takım ayarları + roller
// ---------------------------------------------------------------------------
export async function updateTeam(teamId: string, patch: {
  name?: string; description?: string; rules?: string; city?: string; country?: string;
  logo_url?: string | null; cover_url?: string | null; color?: string;
  join_policy?: "open" | "request" | "invite"; visibility?: "public" | "private";
}): Promise<TeamResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  const v = updateTeamSchema.safeParse(patch);
  if (!v.success) return fail(ilkHata(v.error));
  try {
    const admin = createAdminClient();
    if (!(await canAct(admin, teamId, userId, "admin"))) return fail("Bu işlem için yetkin yok.");
    const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const [k, val] of Object.entries(v.data)) {
      if (val === undefined) continue;
      clean[k] = typeof val === "string" ? (val.trim() || null) : val;
    }
    const { data: team } = await admin.from("teams").update(clean).eq("id", teamId).select("slug").single();
    touch(team?.slug as string);
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "teams/updateTeam", userId });
    return fail("Güncellenemedi.");
  }
}

export async function setMemberRole(teamId: string, targetUserId: string, role: TeamRole): Promise<TeamResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const myRole = await roleOf(admin, teamId, userId);
    if (!myRole) return fail("Bu takımda değilsin.");
    const targetRole = await roleOf(admin, teamId, targetUserId);
    if (!targetRole) return fail("Kullanıcı bu takımda değil.");

    if (role === "owner") {
      if (myRole !== "owner") return fail("Kuruculuğu yalnızca kurucu devredebilir.");
      await admin.from("team_members").update({ role: "owner" }).eq("team_id", teamId).eq("user_id", targetUserId);
      await admin.from("team_members").update({ role: "admin" }).eq("team_id", teamId).eq("user_id", userId);
      await admin.from("teams").update({ owner_id: targetUserId }).eq("id", teamId);
      touch();
      return { ok: true };
    }
    // Yalnızca kendinden düşük rolleri yönetebilir
    if (ROLE_RANK[myRole] <= ROLE_RANK[targetRole] || ROLE_RANK[myRole] <= ROLE_RANK[role]) {
      return fail("Bu rolü atamak için yetkin yok.");
    }
    await admin.from("team_members").update({ role }).eq("team_id", teamId).eq("user_id", targetUserId);
    touch();
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "teams/setMemberRole", userId });
    return fail("Rol güncellenemedi.");
  }
}

export async function removeMember(teamId: string, targetUserId: string): Promise<TeamResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const myRole = await roleOf(admin, teamId, userId);
    const targetRole = await roleOf(admin, teamId, targetUserId);
    if (!myRole || !targetRole) return fail("Üye bulunamadı.");
    if (ROLE_RANK[myRole] <= ROLE_RANK[targetRole]) return fail("Bu üyeyi çıkarmak için yetkin yok.");
    await admin.from("team_members").delete().eq("team_id", teamId).eq("user_id", targetUserId);
    touch();
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "teams/removeMember", userId });
    return fail("Üye çıkarılamadı.");
  }
}

export async function decideJoinRequest(requestId: string, approve: boolean): Promise<TeamResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const { data: req } = await admin.from("team_join_requests").select("id, team_id, user_id").eq("id", requestId).maybeSingle();
    if (!req) return fail("İstek bulunamadı.");
    if (!(await canAct(admin, req.team_id as string, userId, "admin"))) return fail("Yetkin yok.");

    await admin.from("team_join_requests").update({
      status: approve ? "approved" : "rejected", decided_by: userId, decided_at: new Date().toISOString(),
    }).eq("id", requestId);

    if (approve) {
      await admin.from("team_members").insert({ team_id: req.team_id, user_id: req.user_id, role: "member" });
      await refreshTeamMeta(admin, req.team_id as string);
      await admin.from("notifications").insert({
        user_id: req.user_id as string, type: "info", title: "Takıma kabul edildin",
        body: "Katılım isteğin onaylandı.", href: "/teams",
      });
    }
    touch();
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "teams/decideJoinRequest", userId });
    return fail("İşlem yapılamadı.");
  }
}

// ---------------------------------------------------------------------------
// Akış (feed)
// ---------------------------------------------------------------------------
export async function createPost(teamId: string, body: string): Promise<TeamResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  const v = postBodySchema.safeParse(body);
  if (!v.success) return fail(ilkHata(v.error));
  const text = v.data;

  const rl = await guardAction("team:post", userId, LIMITS.post);
  if (!rl.ok) return fail(rl.error!);

  try {
    const admin = createAdminClient();
    if (!(await canAct(admin, teamId, userId, "member"))) return fail("Bu takımın üyesi değilsin.");
    await admin.from("team_posts").insert({ team_id: teamId, user_id: userId, kind: "post", body: text });
    touch();
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "teams/createPost", userId });
    return fail("Paylaşılamadı.");
  }
}

export async function togglePostReaction(postId: string, kind: ReactionKind): Promise<TeamResult<{ active: boolean }>> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");

  const rl = await guardAction("post:react", userId, LIMITS.reaction);
  if (!rl.ok) return fail(rl.error!);

  try {
    const admin = createAdminClient();
    const gate = await assertCanInteract(admin, "team_posts", postId, userId);
    if (gate) return gate;
    const { data: existing } = await admin.from("team_post_reactions")
      .select("id").eq("post_id", postId).eq("user_id", userId).eq("kind", kind).maybeSingle();
    if (existing) {
      await admin.from("team_post_reactions").delete().eq("id", existing.id as string);
      return { ok: true, data: { active: false } };
    }
    await admin.from("team_post_reactions").insert({ post_id: postId, user_id: userId, kind });
    return { ok: true, data: { active: true } };
  } catch (err) {
    await reportError(err, { where: "teams/togglePostReaction", userId });
    return fail("İşlem yapılamadı.");
  }
}

export async function addComment(postId: string, body: string): Promise<TeamResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  const v = commentBodySchema.safeParse(body);
  if (!v.success) return fail(ilkHata(v.error));
  const text = v.data;

  const rl = await guardAction("team:comment", userId, LIMITS.post);
  if (!rl.ok) return fail(rl.error!);

  try {
    const admin = createAdminClient();
    const gate = await assertCanInteract(admin, "team_posts", postId, userId);
    if (gate) return gate;
    await admin.from("team_post_comments").insert({ post_id: postId, user_id: userId, body: text });
    touch();
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "teams/addComment", userId });
    return fail("Yorum eklenemedi.");
  }
}

export async function deletePost(postId: string): Promise<TeamResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const { data: p } = await admin.from("team_posts").select("team_id, user_id").eq("id", postId).maybeSingle();
    if (!p) return fail("Gönderi bulunamadı.");
    const mine = p.user_id === userId;
    // Takımsız (kişisel) gönderiyi yalnızca yazarı silebilir — moderatörlük
    // takım bağlamına aittir, kişisel akışta karşılığı yoktur.
    if (!mine) {
      if (!p.team_id) return fail("Yetkin yok.");
      if (!(await canAct(admin, p.team_id as string, userId, "moderator"))) return fail("Yetkin yok.");
    }
    await admin.from("team_posts").delete().eq("id", postId);
    touch();
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "teams/deletePost", userId });
    return fail("Silinemedi.");
  }
}

// ---------------------------------------------------------------------------
// Sohbet
// ---------------------------------------------------------------------------
export async function sendMessage(teamId: string, input: {
  body?: string; kind?: MessageKind; attachment?: Record<string, unknown>;
  replyTo?: string | null; mentions?: string[];
}): Promise<TeamResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  const v = messageSchema.safeParse(input);
  if (!v.success) return fail(ilkHata(v.error));
  const text = (v.data.body ?? "").trim();
  const kind = v.data.kind ?? "text";
  if (!text && kind === "text") return fail("Mesaj boş olamaz.");

  const rl = await guardAction("team:message", userId, LIMITS.post);
  if (!rl.ok) return fail(rl.error!);

  try {
    const admin = createAdminClient();
    if (!(await canAct(admin, teamId, userId, "member"))) return fail("Bu takımın üyesi değilsin.");

    const mentions = [...new Set((input.mentions ?? []).filter((m) => m && m !== userId))];
    const { error } = await admin.from("team_messages").insert({
      team_id: teamId, user_id: userId, body: text || null, kind,
      attachment: { ...(input.attachment ?? {}), ...(mentions.length ? { mentions } : {}) },
      reply_to: input.replyTo ?? null,
    });
    if (error) return fail(error.message);

    // @bahsedilen üyelere bildirim
    if (mentions.length) {
      const { data: prof } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
      const { data: team } = await admin.from("teams").select("slug").eq("id", teamId).maybeSingle();
      await admin.from("notifications").insert(
        mentions.map((m) => ({
          user_id: m, type: "info" as const,
          title: "Sohbette senden bahsedildi",
          body: `${(prof?.full_name as string) ?? "Bir takım arkadaşın"}: ${text.slice(0, 90)}`,
          href: `/teams/${(team?.slug as string) ?? ""}`,
        }))
      );
    }
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "teams/sendMessage", userId });
    return fail("Mesaj gönderilemedi.");
  }
}

export async function togglePinMessage(messageId: string): Promise<TeamResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const { data: m } = await admin.from("team_messages").select("team_id, pinned").eq("id", messageId).maybeSingle();
    if (!m) return fail("Mesaj bulunamadı.");
    if (!(await canAct(admin, m.team_id as string, userId, "moderator"))) return fail("Yetkin yok.");
    await admin.from("team_messages").update({ pinned: !m.pinned }).eq("id", messageId);
    touch();
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "teams/togglePinMessage", userId });
    return fail("İşlem yapılamadı.");
  }
}

export async function deleteMessage(messageId: string): Promise<TeamResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const { data: m } = await admin.from("team_messages").select("team_id, user_id").eq("id", messageId).maybeSingle();
    if (!m) return fail("Mesaj bulunamadı.");
    const mine = m.user_id === userId;
    if (!mine && !(await canAct(admin, m.team_id as string, userId, "moderator"))) return fail("Yetkin yok.");
    await admin.from("team_messages").delete().eq("id", messageId);
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "teams/deleteMessage", userId });
    return fail("Silinemedi.");
  }
}

// ---------------------------------------------------------------------------
// Görevler
// ---------------------------------------------------------------------------
export async function createQuest(teamId: string, input: {
  title: string; description?: string; metric: QuestMetric; target: number;
  rewardXp?: number; endsOn?: string | null;
}): Promise<TeamResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  const v = questSchema.safeParse(input);
  if (!v.success) return fail(ilkHata(v.error));
  input = v.data as typeof input;
  try {
    const admin = createAdminClient();
    if (!(await canAct(admin, teamId, userId, "admin"))) return fail("Görev oluşturmak için yönetici olmalısın.");
    await admin.from("team_quests").insert({
      team_id: teamId, title: input.title.trim(), description: input.description?.trim() || null,
      metric: input.metric, target: input.target, reward_xp: input.rewardXp ?? 100,
      ends_on: input.endsOn || null, created_by: userId,
    });
    await notifyTeam(admin, teamId, userId, "Yeni takım görevi", input.title.trim(), "/teams");
    touch();
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "teams/createQuest", userId });
    return fail("Görev oluşturulamadı.");
  }
}

/** Görevi tamamlandı olarak işaretler; hedefe ulaşıldıysa ödülü akışa düşer. */
export async function completeQuest(questId: string): Promise<TeamResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const { data: q } = await admin.from("team_quests").select("id, team_id, title, target, reward_xp, status").eq("id", questId).maybeSingle();
    if (!q) return fail("Görev bulunamadı.");
    if (!(await canAct(admin, q.team_id as string, userId, "admin"))) return fail("Yetkin yok.");
    if (q.status === "completed") return { ok: true };

    const { data: prog } = await admin.rpc("team_quest_progress", { p_quest: questId });
    if ((Number(prog) || 0) < Number(q.target)) return fail("Görev hedefine henüz ulaşılmadı.");

    await admin.from("team_quests").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", questId);
    await admin.from("team_posts").insert({
      team_id: q.team_id, kind: "quest", is_system: true,
      body: `Takım görevi tamamlandı: ${q.title}`,
      meta: { reward_xp: q.reward_xp },
    });
    await notifyTeam(admin, q.team_id as string, null, "Görev tamamlandı 🎉", String(q.title), "/teams");
    await refreshTeamMeta(admin, q.team_id as string);
    touch();
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "teams/completeQuest", userId });
    return fail("İşlem yapılamadı.");
  }
}

export async function deleteQuest(questId: string): Promise<TeamResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const { data: q } = await admin.from("team_quests").select("team_id").eq("id", questId).maybeSingle();
    if (!q) return fail("Görev bulunamadı.");
    if (!(await canAct(admin, q.team_id as string, userId, "admin"))) return fail("Yetkin yok.");
    await admin.from("team_quests").update({ status: "archived" }).eq("id", questId);
    touch();
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "teams/deleteQuest", userId });
    return fail("Silinemedi.");
  }
}

// ---------------------------------------------------------------------------
// Etkinlikler
// ---------------------------------------------------------------------------
export async function createEvent(teamId: string, input: {
  title: string; description?: string; kind: EventKind; startsAt: string; endsAt?: string | null; location?: string;
}): Promise<TeamResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  const v = eventSchema.safeParse(input);
  if (!v.success) return fail(ilkHata(v.error));
  input = v.data as typeof input;
  try {
    const admin = createAdminClient();
    if (!(await canAct(admin, teamId, userId, "moderator"))) return fail("Etkinlik oluşturmak için yetkin yok.");
    await admin.from("team_events").insert({
      team_id: teamId, title: input.title.trim(), description: input.description?.trim() || null,
      kind: input.kind, starts_at: input.startsAt, ends_at: input.endsAt || null,
      location: input.location?.trim() || null, created_by: userId,
    });
    await notifyTeam(admin, teamId, userId, "Yeni takım etkinliği", input.title.trim(), "/teams");
    touch();
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "teams/createEvent", userId });
    return fail("Etkinlik oluşturulamadı.");
  }
}

export async function toggleEventJoin(eventId: string): Promise<TeamResult<{ going: boolean }>> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const gate = await assertCanInteract(admin, "team_events", eventId, userId);
    if (gate) return gate;
    const { data: existing } = await admin.from("team_event_participants")
      .select("id").eq("event_id", eventId).eq("user_id", userId).maybeSingle();
    if (existing) {
      await admin.from("team_event_participants").delete().eq("id", existing.id as string);
      touch();
      return { ok: true, data: { going: false } };
    }
    await admin.from("team_event_participants").insert({ event_id: eventId, user_id: userId, status: "going" });
    touch();
    return { ok: true, data: { going: true } };
  } catch (err) {
    await reportError(err, { where: "teams/toggleEventJoin", userId });
    return fail("İşlem yapılamadı.");
  }
}

// ---------------------------------------------------------------------------
// Sohbet medyası — özel bucket için imzalı okuma bağlantıları
// ---------------------------------------------------------------------------
/**
 * `team-media` özel bucket'ındaki yollar için imzalı URL üretir.
 * Yalnızca takım üyeleri çağırabilir; süre 1 saat.
 */
export async function signTeamMedia(
  teamId: string, paths: string[]
): Promise<TeamResult<Record<string, string>>> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  const clean = [...new Set(paths.filter((p) => typeof p === "string" && p.startsWith(`${teamId}/`)))];
  if (clean.length === 0) return { ok: true, data: {} };
  try {
    const admin = createAdminClient();
    if (!(await canAct(admin, teamId, userId, "member"))) return fail("Bu takımın üyesi değilsin.");
    const { data, error } = await admin.storage.from("team-media").createSignedUrls(clean, 3600);
    if (error) return fail(error.message);
    const map: Record<string, string> = {};
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
    }
    return { ok: true, data: map };
  } catch (err) {
    await reportError(err, { where: "teams/signTeamMedia", userId });
    return fail("Medya bağlantısı alınamadı.");
  }
}

// ---------------------------------------------------------------------------
// Davet linki
// ---------------------------------------------------------------------------
export async function createInviteLink(teamId: string, opts?: { maxUses?: number; days?: number }): Promise<TeamResult<{ token: string }>> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    if (!(await canAct(admin, teamId, userId, "admin"))) return fail("Davet oluşturmak için yönetici olmalısın.");
    const token = `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    const expires = opts?.days ? new Date(Date.now() + opts.days * 86400000).toISOString() : null;
    const { error } = await admin.from("team_invites").insert({
      team_id: teamId, token, created_by: userId, max_uses: opts?.maxUses ?? null, expires_at: expires,
    });
    if (error) return fail(error.message);
    return { ok: true, data: { token } };
  } catch (err) {
    await reportError(err, { where: "teams/createInviteLink", userId });
    return fail("Davet oluşturulamadı.");
  }
}

// ---------------------------------------------------------------------------
// Takım savaşları
// ---------------------------------------------------------------------------

const BATTLE_METRICS = ["xp", "workouts", "minutes", "volume_kg", "steps"] as const;
const BATTLE_DAYS = [3, 7, 14] as const;

/**
 * Rakip takıma savaş daveti gönderir.
 *
 * Davet `pending` durumunda başlar; rakip takımın yöneticisi kabul edene kadar
 * skor sayılmaz. Kabul edildiğinde pencere o andan itibaren başlar — böylece
 * daveti geç gören takım dezavantajlı olmaz.
 */
export async function challengeTeam(input: {
  teamId: string;
  opponentId: string;
  metric: string;
  days: number;
}): Promise<TeamResult<{ id: string }>> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  if (input.teamId === input.opponentId) return fail("Bir takım kendine meydan okuyamaz.");

  const rl = await guardAction("battle:challenge", userId, LIMITS.sensitive);
  if (!rl.ok) return fail(rl.error!);

  const metric = (BATTLE_METRICS as readonly string[]).includes(input.metric) ? input.metric : "xp";
  const days = (BATTLE_DAYS as readonly number[]).includes(input.days) ? input.days : 7;

  try {
    const admin = createAdminClient();
    if (!(await canAct(admin, input.teamId, userId, "admin"))) {
      return fail("Savaş açmak için takım yöneticisi olmalısın.");
    }

    // Aynı iki takım arasında zaten açık bir savaş varsa yenisi açılmaz.
    const { data: open } = await admin
      .from("team_battles")
      .select("id")
      .in("status", ["pending", "active"])
      .or(
        `and(team_a.eq.${input.teamId},team_b.eq.${input.opponentId}),` +
        `and(team_a.eq.${input.opponentId},team_b.eq.${input.teamId})`
      )
      .maybeSingle();
    if (open) return fail("Bu takımla zaten devam eden bir savaş var.");

    const endsAt = new Date(Date.now() + days * 86_400_000).toISOString();
    const { data, error } = await admin.from("team_battles").insert({
      team_a: input.teamId, team_b: input.opponentId,
      metric, ends_at: endsAt, status: "pending", created_by: userId,
    }).select("id").single();
    if (error || !data) return fail(error?.message ?? "Savaş açılamadı.");

    const { data: t } = await admin.from("teams").select("name").eq("id", input.teamId).maybeSingle();
    const { data: opp } = await admin.from("teams").select("slug").eq("id", input.opponentId).maybeSingle();
    await notifyTeam(
      admin, input.opponentId, null,
      "Savaş daveti ⚔️",
      `${(t?.name as string) ?? "Bir takım"} takımınıza meydan okudu.`,
      `/teams/${(opp?.slug as string) ?? ""}`
    );

    touch();
    return { ok: true, data: { id: data.id as string } };
  } catch (err) {
    await reportError(err, { where: "teams/challengeTeam", userId });
    return fail("Savaş açılamadı.");
  }
}

/** Savaş davetini kabul eder veya reddeder (yalnızca davet edilen takım). */
export async function respondBattle(battleId: string, accept: boolean): Promise<TeamResult> {
  const userId = await me();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const { data: b } = await admin
      .from("team_battles")
      .select("id, team_a, team_b, status, ends_at, starts_at")
      .eq("id", battleId).maybeSingle();
    if (!b) return fail("Savaş bulunamadı.");
    if (b.status !== "pending") return fail("Bu davet artık yanıtlanamaz.");

    // Yalnızca davet EDİLEN takımın yöneticisi yanıtlar.
    if (!(await canAct(admin, b.team_b as string, userId, "admin"))) {
      return fail("Bu daveti yanıtlama yetkin yok.");
    }

    if (!accept) {
      await admin.from("team_battles").update({ status: "declined" }).eq("id", battleId);
      touch();
      return { ok: true };
    }

    // Pencere kabul anından başlar; süre orijinal gün sayısı kadar korunur.
    const durationMs =
      new Date(b.ends_at as string).getTime() - new Date(b.starts_at as string).getTime();
    const now = new Date();
    await admin.from("team_battles").update({
      status: "active",
      starts_at: now.toISOString(),
      ends_at: new Date(now.getTime() + durationMs).toISOString(),
    }).eq("id", battleId);

    await notifyTeam(admin, b.team_a as string, null, "Savaş başladı ⚔️",
      "Rakip takım meydan okumanı kabul etti. Skor sayılmaya başladı!", "/teams");

    touch();
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "teams/respondBattle", userId });
    return fail("İşlem yapılamadı.");
  }
}
