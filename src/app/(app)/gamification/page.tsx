import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getOverview, getWeeklyChallenges, getRewards, getTimeline,
  getMuscleHeatmap, getRecovery, getLeaderboard, getTeams,
} from "@/lib/gamification/queries";
import { buildMotivation } from "@/lib/gamification/motivation";
import { getSeasonState } from "@/lib/gamification/season";
import { GamificationClient } from "@/components/gamification/GamificationClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Başarılar & XP · Viva" };

export default async function GamificationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  // Önce senkronizasyon + genel bakış (diğer sorgular güncel veriye dayanır).
  const overview = await getOverview(user.id);

  const [challenges, rewards, timeline, heatmap, recovery, leaderboard, teams, season] = await Promise.all([
    getWeeklyChallenges(user.id),
    getRewards(user.id),
    getTimeline(user.id),
    getMuscleHeatmap(user.id),
    getRecovery(user.id),
    getLeaderboard({ period: "weekly", scope: "global", userId: user.id, limit: 200 }),
    getTeams(user.id),
    getSeasonState(user.id),
  ]);

  const motivation = buildMotivation(overview, challenges, leaderboard.me?.rank ?? null);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Başarılar & XP</h1>
        <p className="mt-1 text-sm text-fg-muted">Seviyeni yükselt, rozet topla, liderlik tablosunda yüksel.</p>
      </header>
      <GamificationClient
        userName={(profile as { full_name: string | null })?.full_name ?? "Sporcu"}
        overview={overview}
        challenges={challenges}
        rewards={rewards}
        timeline={timeline}
        heatmap={heatmap}
        recovery={recovery}
        leaderboard={leaderboard}
        teams={teams}
        season={season}
        motivation={motivation}
      />
    </div>
  );
}
