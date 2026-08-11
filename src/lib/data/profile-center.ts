import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getMuscleHeatmap } from "@/lib/gamification/queries";
import type { Profile } from "@/lib/database.types";

export interface ProfileStats {
  workouts: number;
  durationMin: number;
  calories: number;
  steps: number;
  waterMl: number;
  proteinG: number;
  longestStreak: number;
  topMuscle: string | null;
}

export interface ProfileGam {
  level: number;
  levelTitle: string;
  levelColor: string;
  totalXp: number;
  fitnessScore: number;
  currentStreak: number;
  longestStreak: number;
  coins: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
  badges: { name: string; tier: string }[];
  leaderboardRank: number | null;
}

export interface ProfileCenter {
  profile: Profile;
  memberSince: string | null;
  gam: ProfileGam;
  stats: ProfileStats;
}

/** Profil merkezi için tüm veriyi tek çağrıda toplar (yalnızca okuma). */
export async function getProfileCenter(userId: string): Promise<ProfileCenter | null> {
  const supabase = await createClient();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile) return null;

  const [
    { data: gamRow },
    { data: levels },
    { data: achTotal },
    { data: achDone },
    { data: workouts },
    { data: water },
    { data: nutrition },
    heatmap,
  ] = await Promise.all([
    supabase.from("user_gamification").select("total_xp, level, fitness_score, current_streak, longest_streak, coins").eq("user_id", userId).maybeSingle(),
    supabase.from("levels").select("level, title, color, min_xp").order("min_xp"),
    supabase.from("achievements").select("id").eq("enabled", true),
    supabase.from("achievement_progress").select("achievement_id, completed_at").eq("user_id", userId).eq("completed", true),
    supabase.from("workouts").select("duration_min").eq("user_id", userId).eq("status", "completed"),
    supabase.from("water_logs").select("amount_ml").eq("user_id", userId),
    supabase.from("nutrition_logs").select("calories, protein_g").eq("user_id", userId),
    getMuscleHeatmap(userId).catch(() => []),
  ]);

  const gam = (gamRow as { total_xp: number; level: number; fitness_score: number; current_streak: number; longest_streak: number; coins: number } | null) ?? null;
  const totalXp = gam?.total_xp ?? 0;
  const lv = (levels as { level: number; title: string; color: string; min_xp: number }[]) ?? [];
  const currentLevel = [...lv].reverse().find((l) => l.min_xp <= totalXp) ?? lv[0] ?? null;

  // Rozet listesi: tamamlanan başarımların bağlı olduğu rozet(ler).
  const doneIds = ((achDone as { achievement_id: string }[]) ?? []).map((a) => a.achievement_id);
  let badges: { name: string; tier: string }[] = [];
  if (doneIds.length) {
    const { data: achs } = await supabase.from("achievements").select("name, badge_id").in("id", doneIds).not("badge_id", "is", null);
    const badgeIds = ((achs as { name: string; badge_id: string }[]) ?? []).map((a) => a.badge_id);
    if (badgeIds.length) {
      const { data: badgeRows } = await supabase.from("badges").select("id, name, tier").in("id", badgeIds);
      const bmap = new Map(((badgeRows as { id: string; name: string; tier: string }[]) ?? []).map((b) => [b.id, b]));
      badges = ((achs as { name: string; badge_id: string }[]) ?? [])
        .map((a) => bmap.get(a.badge_id))
        .filter((b): b is { id: string; name: string; tier: string } => !!b)
        .map((b) => ({ name: b.name, tier: b.tier }));
    }
  }

  // Leaderboard sıralaması (all-time): benden yüksek XP'li kullanıcı sayısı + 1.
  let leaderboardRank: number | null = null;
  if (gam) {
    const { count } = await supabase.from("user_gamification").select("user_id", { count: "exact", head: true }).gt("total_xp", totalXp);
    leaderboardRank = (count ?? 0) + 1;
  }

  const durationMin = ((workouts as { duration_min: number | null }[]) ?? []).reduce((s, w) => s + (w.duration_min ?? 0), 0);
  const waterMl = ((water as { amount_ml: number }[]) ?? []).reduce((s, w) => s + (w.amount_ml ?? 0), 0);
  const nut = (nutrition as { calories: number; protein_g: number }[]) ?? [];
  const calories = nut.reduce((s, n) => s + Number(n.calories ?? 0), 0);
  const proteinG = nut.reduce((s, n) => s + Number(n.protein_g ?? 0), 0);
  const topMuscle = (heatmap as { name: string }[])[0]?.name ?? null;

  return {
    profile: profile as Profile,
    memberSince: (profile as Profile).created_at ?? null,
    gam: {
      level: gam?.level ?? currentLevel?.level ?? 1,
      levelTitle: currentLevel?.title ?? "Başlangıç",
      levelColor: currentLevel?.color ?? "#A3E635",
      totalXp,
      fitnessScore: gam?.fitness_score ?? 0,
      currentStreak: gam?.current_streak ?? 0,
      longestStreak: gam?.longest_streak ?? 0,
      coins: gam?.coins ?? 0,
      achievementsUnlocked: doneIds.length,
      achievementsTotal: ((achTotal as unknown[]) ?? []).length,
      badges,
      leaderboardRank,
    },
    stats: {
      workouts: ((workouts as unknown[]) ?? []).length,
      durationMin,
      calories: Math.round(calories),
      steps: (profile as Profile).daily_step_count ?? 0,
      waterMl,
      proteinG: Math.round(proteinG),
      longestStreak: gam?.longest_streak ?? 0,
      topMuscle,
    },
  };
}
