import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  XpRule, Level, Badge, Achievement, WeeklyChallenge, Season,
  RewardCatalogItem, Leaderboard, Team,
} from "@/lib/database.types";

export interface GamAdminData {
  xpRules: XpRule[];
  levels: Level[];
  badges: Badge[];
  achievements: Achievement[];
  challenges: WeeklyChallenge[];
  seasons: Season[];
  seasonTracks: Record<string, unknown>[];
  rewards: RewardCatalogItem[];
  leaderboards: Leaderboard[];
  teams: (Team & { member_count: number })[];
  stats: { players: number; totalXp: number; badgesEarned: number; activeStreaks: number };
}

export async function getGamAdminData(): Promise<GamAdminData> {
  const s = createAdminClient();
  const [
    xpRules, levels, badges, achievements, challenges, seasons, seasonTracks, rewards, leaderboards,
    teams, teamMembers, gamRows, earned, streaks,
  ] = await Promise.all([
    s.from("xp_rules").select("*").order("sort_order"),
    s.from("levels").select("*").order("level"),
    s.from("badges").select("*").order("sort_order"),
    s.from("achievements").select("*").order("sort_order"),
    s.from("weekly_challenges").select("*").order("week_start", { ascending: false }).limit(50),
    s.from("seasons").select("*").order("number", { ascending: false }),
    s.from("season_tracks").select("*").order("tier"),
    s.from("reward_catalog").select("*").order("sort_order"),
    s.from("leaderboards").select("*").order("sort_order"),
    s.from("teams").select("*").order("points", { ascending: false }).limit(50),
    s.from("team_members").select("team_id"),
    s.from("user_gamification").select("total_xp, current_streak"),
    s.from("achievement_progress").select("id", { count: "exact", head: true }).eq("completed", true),
    s.from("user_gamification").select("user_id", { count: "exact", head: true }).gt("current_streak", 0),
  ]);

  const memberCount = new Map<string, number>();
  for (const m of (teamMembers.data as { team_id: string }[] ?? [])) memberCount.set(m.team_id, (memberCount.get(m.team_id) ?? 0) + 1);
  const gam = (gamRows.data as { total_xp: number; current_streak: number }[]) ?? [];

  return {
    xpRules: (xpRules.data as XpRule[]) ?? [],
    levels: (levels.data as Level[]) ?? [],
    badges: (badges.data as Badge[]) ?? [],
    achievements: (achievements.data as Achievement[]) ?? [],
    challenges: (challenges.data as WeeklyChallenge[]) ?? [],
    seasons: (seasons.data as Season[]) ?? [],
    seasonTracks: (seasonTracks.data as Record<string, unknown>[]) ?? [],
    rewards: (rewards.data as RewardCatalogItem[]) ?? [],
    leaderboards: (leaderboards.data as Leaderboard[]) ?? [],
    teams: ((teams.data as Team[]) ?? []).map((t) => ({ ...t, member_count: memberCount.get(t.id) ?? 0 })),
    stats: {
      players: gam.length,
      totalXp: gam.reduce((a, b) => a + (b.total_xp ?? 0), 0),
      badgesEarned: earned.count ?? 0,
      activeStreaks: streaks.count ?? 0,
    },
  };
}
