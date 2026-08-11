import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { presenceMap, socialStates } from "./queries";
import { getInsights, insightsToFacts } from "@/lib/ai/insights";
import { hasFeature } from "@/lib/premium/entitlements";
import type { PresenceInfo, SocialState } from "./types";
import type { PostAuthor, PostKind, ReactionKind, TeamComment, TeamPost, PostVisibility } from "@/lib/teams/types";

type Admin = ReturnType<typeof createAdminClient>;
type ProfRow = {
  id: string; full_name: string | null; avatar_url: string | null;
  is_premium?: boolean | null; membership_type?: string | null; premium_until?: string | null;
};

const EMPTY_REACTIONS: Record<ReactionKind, number> = { like: 0, fire: 0, clap: 0 };

export type FeedScope = "friends" | "public" | "mine" | "team";

/** Kullanıcı kimliklerinden isim/avatar haritası. */
export async function profileMap(admin: Admin, ids: string[]): Promise<Map<string, ProfRow>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, avatar_url, is_premium, membership_type, premium_until")
    .in("id", unique);
  return new Map(((data as ProfRow[]) ?? []).map((p) => [p.id, p]));
}

export const toAuthor = (m: Map<string, ProfRow>, id: string | null): PostAuthor => {
  const p = id ? m.get(id) : null;
  return {
    user_id: id,
    name: p?.full_name ?? "Viva Sporcusu",
    avatar_url: p?.avatar_url ?? null,
    // Abonelik detayı istemciye SIZMAZ — yalnızca boolean gider.
    is_premium: hasFeature(p ?? undefined, "premium_badge"),
  };
};

export interface RawPost {
  id: string;
  team_id?: string | null;
  user_id: string | null;
  kind: string;
  body: string | null;
  meta: Record<string, unknown> | null;
  is_system: boolean;
  pinned: boolean;
  visibility?: string | null;
  created_at: string;
}

/**
 * Ham `team_posts` satırlarını tepki + yorum + yazar bilgisiyle zenginleştirir.
 *
 * Takım hub'ı ve kişisel akış aynı fonksiyonu kullanır — tepki sayımı ve son
 * 3 yorum mantığı tek yerde durur. Tüm ek veriler tek sorgu turunda çekilir
 * (postIds üzerinden `in`), gönderi başına sorgu YOKTUR.
 */
export async function enrichPosts(
  admin: Admin,
  rows: RawPost[],
  userId: string,
  opts?: { profiles?: Map<string, ProfRow>; withTeamNames?: boolean }
): Promise<TeamPost[]> {
  if (rows.length === 0) return [];
  const postIds = rows.map((p) => p.id);
  const teamIds = [...new Set(rows.map((p) => p.team_id).filter(Boolean))] as string[];

  const [{ data: reactRows }, { data: commentRows }, { data: teamRows }] = await Promise.all([
    admin.from("team_post_reactions").select("post_id, user_id, kind").in("post_id", postIds),
    admin.from("team_post_comments").select("id, post_id, user_id, body, created_at")
      .in("post_id", postIds).order("created_at"),
    opts?.withTeamNames && teamIds.length
      ? admin.from("teams").select("id, name, slug").in("id", teamIds)
      : Promise.resolve({ data: [] as unknown }),
  ]);

  const reacts = (reactRows as { post_id: string; user_id: string; kind: ReactionKind }[]) ?? [];
  const comments = (commentRows as { id: string; post_id: string; user_id: string; body: string; created_at: string }[]) ?? [];
  const teams = new Map(
    ((teamRows as { id: string; name: string; slug: string }[]) ?? []).map((t) => [t.id, t])
  );

  // Yazar profilleri: dışarıdan verilmişse (takım hub'ı) yeniden çekilmez.
  const authorProfs =
    opts?.profiles ??
    (await profileMap(admin, [...rows.map((p) => p.user_id ?? ""), ...comments.map((c) => c.user_id)]));
  const commentProfs = opts?.profiles
    ? await profileMap(admin, comments.map((c) => c.user_id))
    : authorProfs;

  // O(n) gruplama — gönderi başına filter() taraması yapılmaz.
  const reactByPost = new Map<string, { counts: Record<ReactionKind, number>; mine: ReactionKind[] }>();
  for (const r of reacts) {
    let e = reactByPost.get(r.post_id);
    if (!e) { e = { counts: { ...EMPTY_REACTIONS }, mine: [] }; reactByPost.set(r.post_id, e); }
    e.counts[r.kind] = (e.counts[r.kind] ?? 0) + 1;
    if (r.user_id === userId) e.mine.push(r.kind);
  }
  const commentsByPost = new Map<string, typeof comments>();
  for (const c of comments) {
    const list = commentsByPost.get(c.post_id);
    if (list) list.push(c); else commentsByPost.set(c.post_id, [c]);
  }

  return rows.map((p) => {
    const r = reactByPost.get(p.id);
    const cs = commentsByPost.get(p.id) ?? [];
    const team = p.team_id ? teams.get(p.team_id) : null;
    const lastComments: TeamComment[] = cs.slice(-3).map((c) => ({
      id: c.id, body: c.body, created_at: c.created_at, author: toAuthor(commentProfs, c.user_id),
    }));
    return {
      id: p.id,
      kind: (p.kind as PostKind) ?? "post",
      body: p.body ?? null,
      meta: p.meta ?? {},
      is_system: !!p.is_system,
      pinned: !!p.pinned,
      created_at: p.created_at,
      author: toAuthor(authorProfs, p.user_id ?? null),
      reactions: r?.counts ?? { ...EMPTY_REACTIONS },
      my_reactions: r?.mine ?? [],
      comment_count: cs.length,
      comments: lastComments,
      visibility: ((p.visibility as PostVisibility) ?? "team"),
      team_name: team?.name ?? null,
      team_slug: team?.slug ?? null,
    };
  });
}

export interface FeedData {
  posts: TeamPost[];
  friendCount: number;
  meId: string;
  /** Kullanıcı bir takıma üye mi? (composer'da "Takımım" seçeneği için) */
  hasTeam: boolean;
}

/** Kişisel akış — kapsam bazlı. */
export async function getFeed(userId: string, scope: FeedScope = "friends", limit = 40): Promise<FeedData> {
  const admin = createAdminClient();

  const [{ data: idRows, error }, { count: friendCount }, { count: teamCount }] = await Promise.all([
    admin.rpc("feed_post_ids", { p_user: userId, p_scope: scope, p_limit: limit, p_offset: 0 }),
    admin.from("friendships").select("*", { count: "exact", head: true })
      .eq("status", "accepted").or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
    admin.from("team_members").select("*", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  if (error) console.error("[feed] feed_post_ids hatası:", error.message);
  const ids = ((idRows as { post_id: string }[]) ?? []).map((r) => r.post_id);
  if (ids.length === 0) {
    return { posts: [], friendCount: friendCount ?? 0, meId: userId, hasTeam: (teamCount ?? 0) > 0 };
  }

  const { data: postRows } = await admin
    .from("team_posts")
    .select("id, team_id, user_id, kind, body, meta, is_system, pinned, visibility, created_at")
    .in("id", ids)
    .order("created_at", { ascending: false });

  const posts = await enrichPosts(admin, (postRows as RawPost[]) ?? [], userId, { withTeamNames: true });
  return { posts, friendCount: friendCount ?? 0, meId: userId, hasTeam: (teamCount ?? 0) > 0 };
}

// ---------------------------------------------------------------------------
// Keşif
// ---------------------------------------------------------------------------
export interface TrendingExercise {
  exercise_id: string;
  name: string;
  slug: string;
  category: string | null;
  image_url: string | null;
  sessions: number;
  athletes: number;
  total_volume: number;
}

export interface DiscoverPerson {
  user_id: string;
  name: string;
  avatar_url: string | null;
  level: number;
  total_xp: number;
  streak: number;
  followers: number;
  social: SocialState;
  presence: PresenceInfo | null;
}

function emptyState(): SocialState {
  return { friend: "none", request_id: null, following: false, followed_by: false };
}

export interface DiscoverProgram {
  id: string; slug: string; name: string; cover_url: string | null;
  short_description: string | null; level: string; weeks: number;
  days_per_week: number; use_count: number; rating_avg: number;
}

export interface DiscoverChallenge {
  id: string; title: string; description: string | null; icon: string | null;
  metric: string; target: number; xp_reward: number;
  /** Haftanın bitişi — `week_start + 7 gün` olarak türetilir. */
  ends_on: string | null;
  progress: number; completed: boolean;
}

export interface DiscoverData {
  exercises: TrendingExercise[];
  people: DiscoverPerson[];
  programs: DiscoverProgram[];
  challenges: DiscoverChallenge[];
  /** Kullanıcının verisinden türetilen kişisel öneri cümleleri. */
  suggestions: string[];
}

/** Keşif sayfasının tüm verisi — tek `Promise.all` turu. */
export async function getDiscover(userId: string): Promise<DiscoverData> {
  const admin = createAdminClient();

  // İçgörüler `insights_snapshot()` RPC'sinden gelir (Dalga 1). Keşif sayfasındaki
  // "Senin için" bloğu AI çağrısı YAPMAZ — aynı deterministik cümleler kullanılır,
  // böylece sayfa maliyetsiz ve anında açılır.
  const [{ data: exRows }, { data: peopleRows }, { data: progRows }, { data: chalRows }, insights] =
    await Promise.all([
      admin.rpc("trending_exercises", { p_days: 14, p_limit: 12 }),
      admin.rpc("popular_users", { p_user: userId, p_limit: 12 }),
      admin.from("workout_programs")
        .select("id, slug, name, cover_url, short_description, level, weeks, days_per_week, use_count, rating_avg")
        .eq("status", "published")
        .order("use_count", { ascending: false })
        .limit(8),
      admin.from("weekly_challenges")
        .select("id, title, description, icon, metric, target, xp_reward, week_start")
        .eq("active", true)
        .order("week_start", { ascending: false })
        .limit(6),
      getInsights(userId),
    ]);

  const people = ((peopleRows as Record<string, unknown>[]) ?? []).map((p) => ({
    user_id: p.user_id as string,
    name: (p.name as string) ?? "Viva Sporcusu",
    avatar_url: (p.avatar_url as string) ?? null,
    level: Number(p.level) || 1,
    total_xp: Number(p.total_xp) || 0,
    streak: Number(p.streak) || 0,
    followers: Number(p.followers) || 0,
  }));

  const ids = people.map((p) => p.user_id);
  const chalIds = ((chalRows as { id: string }[]) ?? []).map((c) => c.id);
  const [social, presence, { data: progRowsMine }] = await Promise.all([
    socialStates(admin, userId, ids),
    presenceMap(admin, ids),
    chalIds.length
      ? admin.from("challenge_progress").select("challenge_id, progress, completed")
          .eq("user_id", userId).in("challenge_id", chalIds)
      : Promise.resolve({ data: [] as unknown }),
  ]);

  const myProg = new Map(
    ((progRowsMine as { challenge_id: string; progress: number; completed: boolean }[]) ?? [])
      .map((r) => [r.challenge_id, r])
  );

  return {
    exercises: ((exRows as Record<string, unknown>[]) ?? []).map((e) => ({
      exercise_id: e.exercise_id as string,
      name: e.name as string,
      slug: e.slug as string,
      category: (e.category as string) ?? null,
      image_url: (e.image_url as string) ?? null,
      sessions: Number(e.sessions) || 0,
      athletes: Number(e.athletes) || 0,
      total_volume: Number(e.total_volume) || 0,
    })),
    people: people.map((p) => ({
      ...p,
      social: social.get(p.user_id) ?? emptyState(),
      presence: presence.get(p.user_id) ?? null,
    })),
    programs: ((progRows as Record<string, unknown>[]) ?? []).map((p) => ({
      id: p.id as string, slug: p.slug as string, name: p.name as string,
      cover_url: (p.cover_url as string) ?? null,
      short_description: (p.short_description as string) ?? null,
      level: (p.level as string) ?? "beginner",
      weeks: Number(p.weeks) || 0, days_per_week: Number(p.days_per_week) || 0,
      use_count: Number(p.use_count) || 0, rating_avg: Number(p.rating_avg) || 0,
    })),
    challenges: ((chalRows as Record<string, unknown>[]) ?? []).map((c) => {
      const mine = myProg.get(c.id as string);
      const start = c.week_start ? new Date(c.week_start as string) : null;
      if (start) start.setDate(start.getDate() + 7);
      return {
        id: c.id as string, title: c.title as string,
        description: (c.description as string) ?? null,
        icon: (c.icon as string) ?? null,
        metric: (c.metric as string) ?? "workouts",
        target: Number(c.target) || 1,
        xp_reward: Number(c.xp_reward) || 0,
        ends_on: start ? start.toISOString() : null,
        progress: Number(mine?.progress) || 0,
        completed: !!mine?.completed,
      };
    }),
    suggestions: insightsToFacts(insights).slice(0, 4),
  };
}

// ---------------------------------------------------------------------------
// Herkese açık sporcu profili
// ---------------------------------------------------------------------------
export interface PublicProfile {
  user_id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  level: number;
  total_xp: number;
  streak: number;
  longest_streak: number;
  badges: number;
  workouts: number;
  followers: number;
  following: number;
  friends: number;
  joined_at: string | null;
  presence: import("./types").PresenceInfo | null;
  social: SocialState;
  team: { name: string; slug: string } | null;
  posts: TeamPost[];
  is_me: boolean;
}

/** Bir sporcunun herkese açık profili — akışında yalnızca görebildiği gönderiler. */
export async function getPublicProfile(targetId: string, viewerId: string): Promise<PublicProfile | null> {
  const admin = createAdminClient();

  const { data: prof } = await admin
    .from("profiles")
    .select("id, full_name, avatar_url, bio, city, created_at")
    .eq("id", targetId)
    .maybeSingle();
  if (!prof) return null;

  const [
    { data: gam }, { count: workouts }, { count: badges },
    { count: followers }, { count: following }, { count: friends },
    { data: memberRow }, social, presence,
  ] = await Promise.all([
    admin.from("user_gamification")
      .select("total_xp, level, current_streak, longest_streak").eq("user_id", targetId).maybeSingle(),
    admin.from("workouts").select("*", { count: "exact", head: true })
      .eq("user_id", targetId).eq("status", "completed"),
    admin.from("achievement_progress").select("*", { count: "exact", head: true })
      .eq("user_id", targetId).eq("completed", true),
    admin.from("follows").select("*", { count: "exact", head: true }).eq("following_id", targetId),
    admin.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", targetId),
    admin.from("friendships").select("*", { count: "exact", head: true })
      .eq("status", "accepted").or(`requester_id.eq.${targetId},addressee_id.eq.${targetId}`),
    admin.from("team_members").select("team_id, teams(name, slug)").eq("user_id", targetId).maybeSingle(),
    socialStates(admin, viewerId, [targetId]),
    presenceMap(admin, [targetId]),
  ]);

  // Gönderi görünürlüğü: RPC yerine doğrudan filtre — yalnızca bu kişinin
  // gönderileri istendiği için kapsam kontrolü tek `can_see_post` çağrısıyla
  // yapılabilir; böylece takım gönderileri de doğru şekilde elenir.
  const { data: rawPosts } = await admin
    .from("team_posts")
    .select("id, team_id, user_id, kind, body, meta, is_system, pinned, visibility, created_at")
    .eq("user_id", targetId)
    .order("created_at", { ascending: false })
    .limit(30);

  const candidates = (rawPosts as RawPost[]) ?? [];
  let visible = candidates;
  if (targetId !== viewerId && candidates.length > 0) {
    const checks = await Promise.all(
      candidates.map((p) =>
        admin.rpc("can_see_post", {
          p_team: p.team_id ?? null,
          p_author: p.user_id,
          p_visibility: p.visibility ?? "team",
          p_viewer: viewerId,
        })
      )
    );
    visible = candidates.filter((_, i) => checks[i].data === true);
  }

  const posts = await enrichPosts(admin, visible.slice(0, 20), viewerId, { withTeamNames: true });
  const team = (memberRow as { teams?: { name: string; slug: string } | null } | null)?.teams ?? null;

  return {
    user_id: targetId,
    name: (prof.full_name as string) ?? "Viva Sporcusu",
    avatar_url: (prof.avatar_url as string) ?? null,
    bio: (prof.bio as string) ?? null,
    city: (prof.city as string) ?? null,
    level: Number(gam?.level) || 1,
    total_xp: Number(gam?.total_xp) || 0,
    streak: Number(gam?.current_streak) || 0,
    longest_streak: Number(gam?.longest_streak) || 0,
    badges: badges ?? 0,
    workouts: workouts ?? 0,
    followers: followers ?? 0,
    following: following ?? 0,
    friends: friends ?? 0,
    joined_at: (prof.created_at as string) ?? null,
    presence: presence.get(targetId) ?? null,
    social: social.get(targetId) ?? emptyState(),
    team: team ? { name: team.name, slug: team.slug } : null,
    posts,
    is_me: targetId === viewerId,
  };
}
