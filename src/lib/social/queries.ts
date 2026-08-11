import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { derivePresence } from "./types";
import type {
  FriendRequestView, FriendView, LiveSessionView, PresenceInfo, SocialState,
  TeamPulse, TeamSeriesPoint,
} from "./types";

type Admin = ReturnType<typeof createAdminClient>;

const OFFLINE: PresenceInfo = { status: "offline", activity: null, last_seen_at: null };
const NO_SOCIAL: SocialState = { friend: "none", request_id: null, following: false, followed_by: false };

/** Kullanıcı kimliklerinden presence haritası. */
export async function presenceMap(admin: Admin, ids: string[]): Promise<Map<string, PresenceInfo>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data } = await admin
    .from("user_presence")
    .select("user_id, status, activity, last_seen_at")
    .in("user_id", unique);
  const rows = (data as { user_id: string; status: string; activity: string | null; last_seen_at: string }[]) ?? [];
  return new Map(rows.map((r) => [r.user_id, derivePresence(r.status, r.last_seen_at, r.activity)]));
}

export const emptyPresence = (): PresenceInfo => ({ ...OFFLINE });

/**
 * Verilen kullanıcıların bana göre sosyal durumu (arkadaşlık + takip).
 * Tek sorgu çifti ile tüm liste için çözülür.
 */
export async function socialStates(
  admin: Admin, meId: string, ids: string[]
): Promise<Map<string, SocialState>> {
  const unique = [...new Set(ids.filter((i) => i && i !== meId))];
  const out = new Map<string, SocialState>();
  if (unique.length === 0) return out;

  const [{ data: friendRows }, { data: followRows }] = await Promise.all([
    admin.from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(`requester_id.eq.${meId},addressee_id.eq.${meId}`),
    admin.from("follows")
      .select("follower_id, following_id")
      .or(`follower_id.eq.${meId},following_id.eq.${meId}`),
  ]);

  const friends = (friendRows as { id: string; requester_id: string; addressee_id: string; status: string }[]) ?? [];
  const follows = (followRows as { follower_id: string; following_id: string }[]) ?? [];

  for (const id of unique) out.set(id, { ...NO_SOCIAL });

  for (const f of friends) {
    const other = f.requester_id === meId ? f.addressee_id : f.requester_id;
    const state = out.get(other);
    if (!state) continue;
    if (f.status === "accepted") { state.friend = "friends"; state.request_id = null; }
    else if (f.status === "pending") {
      state.friend = f.requester_id === meId ? "pending_out" : "pending_in";
      state.request_id = f.id;
    }
  }
  for (const f of follows) {
    if (f.follower_id === meId) { const s = out.get(f.following_id); if (s) s.following = true; }
    if (f.following_id === meId) { const s = out.get(f.follower_id); if (s) s.followed_by = true; }
  }
  return out;
}

/** Kabul edilmiş arkadaşların zengin listesi. */
export async function listFriends(
  admin: Admin, userId: string, teammateIds: string[] = []
): Promise<FriendView[]> {
  const { data } = await admin
    .from("friendships")
    .select("requester_id, addressee_id, status, responded_at")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  const rows = (data as { requester_id: string; addressee_id: string; responded_at: string | null }[]) ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
  const sinceById = new Map(
    rows.map((r) => [r.requester_id === userId ? r.addressee_id : r.requester_id, r.responded_at])
  );

  const [{ data: profs }, { data: gam }, pres] = await Promise.all([
    admin.from("profiles").select("id, full_name, avatar_url").in("id", ids),
    admin.from("user_gamification").select("user_id, total_xp, level, current_streak").in("user_id", ids),
    presenceMap(admin, ids),
  ]);
  const profMap = new Map(((profs as { id: string; full_name: string | null; avatar_url: string | null }[]) ?? []).map((p) => [p.id, p]));
  const gamMap = new Map(((gam as { user_id: string; total_xp: number; level: number; current_streak: number }[]) ?? []).map((g) => [g.user_id, g]));
  const teammates = new Set(teammateIds);

  return ids
    .map((id) => {
      const p = profMap.get(id);
      const g = gamMap.get(id);
      return {
        user_id: id,
        name: p?.full_name ?? "Viva Sporcusu",
        avatar_url: p?.avatar_url ?? null,
        level: g?.level ?? 1,
        total_xp: g?.total_xp ?? 0,
        streak: g?.current_streak ?? 0,
        presence: pres.get(id) ?? emptyPresence(),
        since: sinceById.get(id) ?? null,
        same_team: teammates.has(id),
      };
    })
    .sort((a, b) => {
      const online = (x: FriendView) => (x.presence.status === "offline" ? 0 : 1);
      return online(b) - online(a) || b.total_xp - a.total_xp;
    });
}

/** Bekleyen arkadaşlık istekleri (gelen + giden). */
export async function listFriendRequests(admin: Admin, userId: string): Promise<FriendRequestView[]> {
  const { data } = await admin
    .from("friendships")
    .select("id, requester_id, addressee_id, created_at")
    .eq("status", "pending")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  const rows = (data as { id: string; requester_id: string; addressee_id: string; created_at: string }[]) ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
  const { data: profs } = await admin.from("profiles").select("id, full_name, avatar_url").in("id", ids);
  const profMap = new Map(((profs as { id: string; full_name: string | null; avatar_url: string | null }[]) ?? []).map((p) => [p.id, p]));

  return rows.map((r) => {
    const outgoing = r.requester_id === userId;
    const other = outgoing ? r.addressee_id : r.requester_id;
    const p = profMap.get(other);
    return {
      id: r.id,
      user_id: other,
      name: p?.full_name ?? "Viva Sporcusu",
      avatar_url: p?.avatar_url ?? null,
      created_at: r.created_at,
      outgoing,
    };
  });
}

/** Takım nabzı (online/aktif/katılım). */
export async function getTeamPulse(admin: Admin, teamId: string): Promise<TeamPulse> {
  const { data, error } = await admin.rpc("team_pulse", { p_team: teamId });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    return { online_now: 0, active_today: 0, active_week: 0, participation_pct: 0, live_session: null };
  }
  const r = row as Record<string, unknown>;
  return {
    online_now: Number(r.online_now) || 0,
    active_today: Number(r.active_today) || 0,
    active_week: Number(r.active_week) || 0,
    participation_pct: Number(r.participation_pct) || 0,
    live_session: (r.live_session as string) ?? null,
  };
}

/** Son N günlük istatistik serisi (grafikler). */
export async function getTeamSeries(admin: Admin, teamId: string, days = 30): Promise<TeamSeriesPoint[]> {
  const { data, error } = await admin.rpc("team_stats_series", { p_team: teamId, p_days: days });
  if (error || !Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    d: String(r.d),
    xp: Number(r.xp) || 0,
    workouts: Number(r.workouts) || 0,
    minutes: Number(r.minutes) || 0,
    calories: Number(r.calories) || 0,
    volume_kg: Number(r.volume_kg) || 0,
    active_users: Number(r.active_users) || 0,
  }));
}

const LIVE_COLUMNS = "id, title, status, started_at, ended_at, total_xp, host_id, team_id, visibility, activity, met";

/** Takımın aktif canlı antrenman oturumu (varsa). */
export async function getLiveSession(
  admin: Admin, teamId: string, userId: string
): Promise<LiveSessionView | null> {
  const { data: s } = await admin
    .from("team_live_sessions")
    .select(LIVE_COLUMNS)
    .eq("team_id", teamId).eq("status", "live")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!s) return null;
  return hydrateSession(admin, s as Record<string, unknown>, userId);
}

/**
 * Kullanıcının görebileceği aktif arkadaş partisi (takımsız oturum).
 *
 * Öncelik: kendi başlattığı → davet edildiği → arkadaşının açtığı.
 * Takım oturumlarından ayrı tutulur; ikisi aynı anda açık olabilir.
 */
export async function getFriendParty(admin: Admin, userId: string): Promise<LiveSessionView | null> {
  // Aday oturumlar: takımsız + canlı. Sayı doğal olarak küçüktür (aktif partiler).
  const { data: rows } = await admin
    .from("team_live_sessions")
    .select(LIVE_COLUMNS)
    .is("team_id", null).eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(40);
  const sessions = (rows as Record<string, unknown>[]) ?? [];
  if (sessions.length === 0) return null;

  // Görünürlük kararı tek yerde: `can_see_live_session()` (migration 0044).
  const mine = sessions.find((s) => s.host_id === userId);
  if (mine) return hydrateSession(admin, mine, userId);

  const checks = await Promise.all(
    sessions.map((s) => admin.rpc("can_see_live_session", { p_session: s.id as string, p_viewer: userId }))
  );
  const idx = checks.findIndex((c) => c.data === true);
  return idx >= 0 ? hydrateSession(admin, sessions[idx], userId) : null;
}

async function hydrateSession(
  admin: Admin, s: Record<string, unknown>, userId: string
): Promise<LiveSessionView> {
  const { data: partRows } = await admin
    .from("team_live_participants")
    .select("user_id, joined_at, left_at")
    .eq("session_id", s.id as string)
    .is("left_at", null);
  const parts = (partRows as { user_id: string; joined_at: string }[]) ?? [];

  const ids = [...parts.map((p) => p.user_id), (s.host_id as string) ?? ""].filter(Boolean);
  const { data: profs } = ids.length
    ? await admin.from("profiles").select("id, full_name, avatar_url").in("id", ids)
    : { data: [] as unknown };
  const profMap = new Map(((profs as { id: string; full_name: string | null; avatar_url: string | null }[]) ?? []).map((p) => [p.id, p]));
  const nameOf = (id: string) => profMap.get(id)?.full_name ?? "Viva Sporcusu";

  return {
    id: s.id as string,
    title: (s.title as string) ?? "Birlikte Antrenman",
    status: "live",
    started_at: s.started_at as string,
    ended_at: null,
    total_xp: Number(s.total_xp) || 0,
    team_id: (s.team_id as string) ?? null,
    activity: (s.activity as string) ?? "strength",
    met: Number(s.met) || 5,
    host: {
      user_id: (s.host_id as string) ?? null,
      name: s.host_id ? nameOf(s.host_id as string) : "Viva",
      avatar_url: s.host_id ? (profMap.get(s.host_id as string)?.avatar_url ?? null) : null,
    },
    participants: parts.map((p) => ({
      user_id: p.user_id,
      name: nameOf(p.user_id),
      avatar_url: profMap.get(p.user_id)?.avatar_url ?? null,
      joined_at: p.joined_at,
    })),
    im_in: parts.some((p) => p.user_id === userId),
  };
}
