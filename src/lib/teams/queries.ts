import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { periodWindow } from "@/lib/gamification/queries";
import {
  presenceMap, socialStates, listFriends, listFriendRequests,
  getTeamPulse, getTeamSeries, getLiveSession, emptyPresence,
} from "@/lib/social/queries";
import { enrichPosts, profileMap, toAuthor as author, type RawPost } from "@/lib/social/feed";
import { hasFeature } from "@/lib/premium/entitlements";
import { getTeamBattles, listBattleOpponents } from "./battles";
import type { LeaderboardPeriod } from "@/lib/database.types";
import type {
  TeamHub, TeamSummary, TeamStats, TeamMemberView, TeamPost, TeamMessage,
  TeamQuest, TeamBadgeView, TeamEvent, JoinRequestView, TeamRole,
  MessageKind, QuestMetric, EventKind, BadgeTierT,
} from "./types";
import { ROLE_RANK } from "./types";

type Admin = ReturnType<typeof createAdminClient>;

/** Bir takımın istatistikleri (RPC). */
export async function getTeamStats(teamId: string): Promise<TeamStats> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("team_stats", { p_team: teamId });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    if (error) console.error("[teams] team_stats hatası:", error.message);
    return { member_count: 0, total_xp: 0, weekly_xp: 0, workouts: 0, minutes: 0, calories: 0, steps: 0, active_days_avg: 0, level: 1 };
  }
  const r = row as Record<string, number>;
  return {
    member_count: Number(r.member_count) || 0,
    total_xp: Number(r.total_xp) || 0,
    weekly_xp: Number(r.weekly_xp) || 0,
    workouts: Number(r.workouts) || 0,
    minutes: Number(r.minutes) || 0,
    calories: Number(r.calories) || 0,
    steps: Number(r.steps) || 0,
    active_days_avg: Number(r.active_days_avg) || 0,
    level: Number(r.level) || 1,
  };
}

// ---------------------------------------------------------------------------
// Keşif: takım listesi + takımlar arası sıralama
// ---------------------------------------------------------------------------
export interface TeamDirectory { teams: TeamSummary[]; myTeamId: string | null }

export async function listTeams(
  userId: string,
  opts?: { period?: LeaderboardPeriod; scope?: "global" | "country" | "city"; scopeValue?: string | null; q?: string }
): Promise<TeamDirectory> {
  const admin = createAdminClient();
  const period = opts?.period ?? "all_time";
  const scope = opts?.scope ?? "global";

  const [{ data: teamRows }, { data: memberRows }] = await Promise.all([
    admin.from("teams")
      .select("id, name, slug, description, logo_url, cover_url, color, badge, city, country, level, visibility, join_policy, member_limit, created_at, owner_id")
      .limit(200),
    admin.from("team_members").select("team_id, user_id, role"),
  ]);
  const teams = (teamRows as Record<string, unknown>[]) ?? [];
  const members = (memberRows as { team_id: string; user_id: string; role: TeamRole }[]) ?? [];
  if (teams.length === 0) return { teams: [], myTeamId: null };

  // Dönem XP'si: leaderboard_scores tek çağrı, kullanıcı → takım eşlemesi
  const win = periodWindow(period === "all_time" ? "weekly" : period);
  const [{ data: allTime }, { data: periodScores }] = await Promise.all([
    admin.from("user_gamification").select("user_id, total_xp"),
    admin.rpc("leaderboard_scores", { p_start: win.start, p_end: win.end }),
  ]);
  const totalByUser = new Map(((allTime as { user_id: string; total_xp: number }[]) ?? []).map((g) => [g.user_id, g.total_xp]));
  const periodByUser = new Map(((periodScores as { user_id: string; score: number }[]) ?? []).map((s) => [s.user_id, Number(s.score) || 0]));

  const agg = new Map<string, { count: number; total: number; period: number }>();
  for (const m of members) {
    const a = agg.get(m.team_id) ?? { count: 0, total: 0, period: 0 };
    a.count += 1;
    a.total += totalByUser.get(m.user_id) ?? 0;
    a.period += periodByUser.get(m.user_id) ?? 0;
    agg.set(m.team_id, a);
  }
  const myTeamId = members.find((m) => m.user_id === userId)?.team_id ?? null;
  const myRoleByTeam = new Map(members.filter((m) => m.user_id === userId).map((m) => [m.team_id, m.role]));

  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
  const query = norm(opts?.q);

  let list: TeamSummary[] = teams.map((t) => {
    const a = agg.get(t.id as string) ?? { count: 0, total: 0, period: 0 };
    return {
      id: t.id as string, name: t.name as string, slug: t.slug as string,
      description: (t.description as string) ?? null,
      logo_url: (t.logo_url as string) ?? null, cover_url: (t.cover_url as string) ?? null,
      color: (t.color as string) ?? null, badge: (t.badge as string) ?? null,
      city: (t.city as string) ?? null, country: (t.country as string) ?? null,
      level: (t.level as number) ?? 1, visibility: (t.visibility as string) ?? "public",
      join_policy: ((t.join_policy as string) ?? "open") as TeamSummary["join_policy"],
      member_limit: (t.member_limit as number) ?? 100,
      created_at: t.created_at as string, owner_id: (t.owner_id as string) ?? null,
      member_count: a.count, total_xp: a.total, weekly_xp: a.period, rank: 0,
      is_member: myRoleByTeam.has(t.id as string),
      my_role: myRoleByTeam.get(t.id as string) ?? null,
    };
  });

  if (scope !== "global") {
    // Bölge değeri verilmemişse kullanıcının profilinden türet
    let val = opts?.scopeValue ?? null;
    if (!val) {
      const { data: me } = await admin.from("profiles").select("country, city").eq("id", userId).maybeSingle();
      val = scope === "country" ? (me?.country ?? null) : (me?.city ?? null);
    }
    list = list.filter((t) => norm(scope === "country" ? t.country : t.city) === norm(val));
  }
  if (query) list = list.filter((t) => norm(t.name).includes(query) || norm(t.city).includes(query));

  const key = period === "all_time" ? "total_xp" : "weekly_xp";
  list = list
    .sort((a, b) => (b[key] as number) - (a[key] as number) || b.member_count - a.member_count)
    .map((t, i) => ({ ...t, rank: i + 1 }));

  return { teams: list, myTeamId };
}

/** Takımın toplam XP sıralamasındaki yeri (1 = zirve). */
async function computeTeamRank(admin: Admin, teamId: string): Promise<number> {
  const [{ data: memberRows }, { data: gamRows }] = await Promise.all([
    admin.from("team_members").select("team_id, user_id"),
    admin.from("user_gamification").select("user_id, total_xp"),
  ]);
  const xpByUser = new Map(((gamRows as { user_id: string; total_xp: number }[]) ?? []).map((g) => [g.user_id, g.total_xp]));
  const totals = new Map<string, number>();
  for (const m of ((memberRows as { team_id: string; user_id: string }[]) ?? [])) {
    totals.set(m.team_id, (totals.get(m.team_id) ?? 0) + (xpByUser.get(m.user_id) ?? 0));
  }
  const mine = totals.get(teamId) ?? 0;
  let rank = 1;
  for (const [id, xp] of totals) if (id !== teamId && xp > mine) rank++;
  return rank;
}

// ---------------------------------------------------------------------------
// Takım hub verisi
// ---------------------------------------------------------------------------
export async function getTeamHub(slug: string, userId: string): Promise<TeamHub | null> {
  const admin = createAdminClient();
  const { data: t } = await admin
    .from("teams")
    .select("id, name, slug, description, logo_url, cover_url, color, badge, city, country, level, visibility, join_policy, member_limit, created_at, owner_id, invite_code")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) return null;
  const teamId = t.id as string;

  const [
    { data: memberRows }, stats, { data: postRows }, { data: msgRows },
    { data: questRows }, { data: badgeRows }, { data: awardRows },
    { data: eventRows }, { data: reqRows },
  ] = await Promise.all([
    admin.from("team_members").select("user_id, role, joined_at").eq("team_id", teamId),
    getTeamStats(teamId),
    admin.from("team_posts").select("id, user_id, kind, body, meta, is_system, pinned, created_at")
      .eq("team_id", teamId).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(40),
    admin.from("team_messages").select("id, user_id, body, kind, attachment, reply_to, pinned, created_at")
      .eq("team_id", teamId).order("created_at", { ascending: false }).limit(60),
    admin.from("team_quests").select("*").eq("team_id", teamId).neq("status", "archived").order("created_at", { ascending: false }),
    admin.from("team_badges").select("*").order("sort_order"),
    admin.from("team_badge_awards").select("badge_id, awarded_at").eq("team_id", teamId),
    admin.from("team_events").select("*").eq("team_id", teamId).order("starts_at", { ascending: true }).limit(20),
    admin.from("team_join_requests").select("id, user_id, message, created_at").eq("team_id", teamId).eq("status", "pending"),
  ]);

  const memberList = (memberRows as { user_id: string; role: TeamRole; joined_at: string }[]) ?? [];
  const myRole = memberList.find((m) => m.user_id === userId)?.role ?? null;

  // Profiller (üyeler + gönderi/mesaj yazarları + istek sahipleri)
  const ids = [
    ...memberList.map((m) => m.user_id),
    ...((postRows as { user_id: string | null }[]) ?? []).map((p) => p.user_id ?? ""),
    ...((msgRows as { user_id: string | null }[]) ?? []).map((m) => m.user_id ?? ""),
    ...((reqRows as { user_id: string }[]) ?? []).map((r) => r.user_id),
    t.owner_id as string,
  ].filter(Boolean) as string[];
  const profs = await profileMap(admin, ids);

  // Üye XP/seviye/seri
  const memberIds = memberList.map((m) => m.user_id);
  const win = periodWindow("weekly");
  const [{ data: gamRows }, { data: weekScores }] = await Promise.all([
    memberIds.length
      ? admin.from("user_gamification").select("user_id, total_xp, level, current_streak").in("user_id", memberIds)
      : Promise.resolve({ data: [] as unknown }),
    memberIds.length
      ? admin.rpc("leaderboard_scores", { p_start: win.start, p_end: win.end })
      : Promise.resolve({ data: [] as unknown }),
  ]);
  const gamMap = new Map(((gamRows as { user_id: string; total_xp: number; level: number; current_streak: number }[]) ?? []).map((g) => [g.user_id, g]));
  const weekMap = new Map(((weekScores as { user_id: string; score: number }[]) ?? []).map((s) => [s.user_id, Number(s.score) || 0]));

  // Sosyal katman: presence, arkadaşlık/takip, kazanılan başarım sayısı
  const [presence, social, { data: achRows }] = await Promise.all([
    presenceMap(admin, memberIds),
    socialStates(admin, userId, memberIds),
    memberIds.length
      ? admin.from("achievement_progress").select("user_id").in("user_id", memberIds).eq("completed", true)
      : Promise.resolve({ data: [] as unknown }),
  ]);
  const badgeCount = new Map<string, number>();
  for (const a of ((achRows as { user_id: string }[]) ?? [])) {
    badgeCount.set(a.user_id, (badgeCount.get(a.user_id) ?? 0) + 1);
  }
  const weeklyTotal = memberIds.reduce((sum, id) => sum + (weekMap.get(id) ?? 0), 0);

  const members: TeamMemberView[] = memberList
    .map((m) => {
      const p = profs.get(m.user_id);
      const g = gamMap.get(m.user_id);
      const weekly = weekMap.get(m.user_id) ?? 0;
      return {
        user_id: m.user_id,
        name: p?.full_name ?? "Viva Sporcusu",
        avatar_url: p?.avatar_url ?? null,
        role: m.role,
        level: g?.level ?? 1,
        total_xp: g?.total_xp ?? 0,
        weekly_xp: weekly,
        streak: g?.current_streak ?? 0,
        joined_at: m.joined_at,
        is_me: m.user_id === userId,
        presence: presence.get(m.user_id) ?? emptyPresence(),
        social: social.get(m.user_id) ?? { friend: "none" as const, request_id: null, following: false, followed_by: false },
        badges: badgeCount.get(m.user_id) ?? 0,
        contribution: weeklyTotal > 0 ? Math.round((weekly / weeklyTotal) * 100) : 0,
        // Abonelik detayı istemciye gitmez; yalnızca rozet gösterilsin mi bilgisi.
        is_premium: hasFeature(p ?? undefined, "premium_badge"),
      };
    })
    .sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role] || b.total_xp - a.total_xp);

  const mvp = [...members].sort((a, b) => b.weekly_xp - a.weekly_xp)[0] ?? null;
  const canManageEarly = myRole ? ROLE_RANK[myRole] >= ROLE_RANK.admin : false;

  // Akış: tepkiler + yorumlar (ortak `enrichPosts` — kişisel akışla aynı kod yolu)
  const feed: TeamPost[] = await enrichPosts(admin, (postRows as RawPost[]) ?? [], userId, {
    profiles: profs,
  });

  // Sohbet (eskiden yeniye)
  const msgs = ((msgRows as Record<string, unknown>[]) ?? []).slice().reverse();
  const byId = new Map(msgs.map((m) => [m.id as string, m]));
  const messages: TeamMessage[] = msgs.map((m) => {
    const replyId = (m.reply_to as string) ?? null;
    const src = replyId ? byId.get(replyId) : null;
    return {
      id: m.id as string,
      body: (m.body as string) ?? null,
      kind: ((m.kind as string) ?? "text") as MessageKind,
      attachment: (m.attachment as Record<string, unknown>) ?? {},
      reply_to: replyId,
      reply_preview: src
        ? { name: author(profs, (src.user_id as string) ?? null).name, body: ((src.body as string) ?? "").slice(0, 80) }
        : null,
      pinned: !!m.pinned,
      created_at: m.created_at as string,
      author: author(profs, (m.user_id as string) ?? null),
      is_me: (m.user_id as string) === userId,
    };
  });

  // Görevler + canlı ilerleme
  const questRaw = (questRows as Record<string, unknown>[]) ?? [];
  const quests: TeamQuest[] = await Promise.all(
    questRaw.map(async (q) => {
      const { data: prog } = await admin.rpc("team_quest_progress", { p_quest: q.id as string });
      return {
        id: q.id as string,
        title: q.title as string,
        description: (q.description as string) ?? null,
        metric: ((q.metric as string) ?? "workouts") as QuestMetric,
        target: Number(q.target) || 0,
        progress: Number(prog) || 0,
        reward_xp: Number(q.reward_xp) || 0,
        reward_badge: (q.reward_badge as string) ?? null,
        starts_on: q.starts_on as string,
        ends_on: (q.ends_on as string) ?? null,
        status: (q.status as string) ?? "active",
        completed_at: (q.completed_at as string) ?? null,
      };
    })
  );

  // Rozetler
  const awarded = new Map(((awardRows as { badge_id: string; awarded_at: string }[]) ?? []).map((a) => [a.badge_id, a.awarded_at]));
  const badges: TeamBadgeView[] = ((badgeRows as Record<string, unknown>[]) ?? []).map((b) => ({
    id: b.id as string, slug: b.slug as string, name: b.name as string,
    description: (b.description as string) ?? null, icon: (b.icon as string) ?? null,
    tier: ((b.tier as string) ?? "bronze") as BadgeTierT,
    earned: awarded.has(b.id as string),
    awarded_at: awarded.get(b.id as string) ?? null,
  }));

  // Etkinlikler + katılım
  const eventsRaw = (eventRows as Record<string, unknown>[]) ?? [];
  const eventIds = eventsRaw.map((e) => e.id as string);
  const { data: partRows } = eventIds.length
    ? await admin.from("team_event_participants").select("event_id, user_id").in("event_id", eventIds)
    : { data: [] as unknown };
  const parts = (partRows as { event_id: string; user_id: string }[]) ?? [];
  const events: TeamEvent[] = eventsRaw.map((e) => {
    const id = e.id as string;
    return {
      id, title: e.title as string, description: (e.description as string) ?? null,
      kind: ((e.kind as string) ?? "challenge") as EventKind,
      starts_at: e.starts_at as string, ends_at: (e.ends_at as string) ?? null,
      location: (e.location as string) ?? null,
      participants: parts.filter((p) => p.event_id === id).length,
      im_going: parts.some((p) => p.event_id === id && p.user_id === userId),
    };
  });

  const joinRequests: JoinRequestView[] = ((reqRows as { id: string; user_id: string; message: string | null; created_at: string }[]) ?? []).map((r) => {
    const p = profs.get(r.user_id);
    return { id: r.id, user_id: r.user_id, name: p?.full_name ?? "Sporcu", avatar_url: p?.avatar_url ?? null, message: r.message, created_at: r.created_at };
  });

  // Sosyal katman: nabız, seri, canlı oturum, arkadaşlar, sıralama, savaşlar
  const [pulse, series, live, friends, friendRequests, rank, battles, battleOpponents] = await Promise.all([
    getTeamPulse(admin, teamId),
    getTeamSeries(admin, teamId, 30),
    myRole ? getLiveSession(admin, teamId, userId) : Promise.resolve(null),
    listFriends(admin, userId, memberIds),
    listFriendRequests(admin, userId),
    computeTeamRank(admin, teamId),
    getTeamBattles(teamId),
    // Rakip listesi yalnızca savaş açabilecek yöneticiye gerekiyor.
    canManageEarly ? listBattleOpponents(teamId) : Promise.resolve([]),
  ]);

  const canManage = canManageEarly;
  const team: TeamSummary = {
    id: teamId, name: t.name as string, slug: t.slug as string,
    description: (t.description as string) ?? null,
    logo_url: (t.logo_url as string) ?? null, cover_url: (t.cover_url as string) ?? null,
    color: (t.color as string) ?? null, badge: (t.badge as string) ?? null,
    city: (t.city as string) ?? null, country: (t.country as string) ?? null,
    level: stats.level, visibility: (t.visibility as string) ?? "public",
    join_policy: ((t.join_policy as string) ?? "open") as TeamSummary["join_policy"],
    member_limit: (t.member_limit as number) ?? 100,
    created_at: t.created_at as string, owner_id: (t.owner_id as string) ?? null,
    member_count: stats.member_count, total_xp: stats.total_xp, weekly_xp: stats.weekly_xp,
    rank, is_member: !!myRole, my_role: myRole,
  };

  return {
    team, stats, members,
    owner: t.owner_id ? author(profs, t.owner_id as string) : null,
    admins: members.filter((m) => m.role === "admin").map((m) => ({ user_id: m.user_id, name: m.name, avatar_url: m.avatar_url })),
    mvp,
    posts: feed,
    messages: myRole ? messages : [],
    quests,
    badges,
    events,
    joinRequests: canManage ? joinRequests : [],
    myRole,
    inviteCode: canManage ? ((t.invite_code as string) ?? null) : null,
    pulse, series, live, friends, friendRequests,
    meId: userId,
    battles, battleOpponents,
  };
}
