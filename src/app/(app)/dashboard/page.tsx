import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDashboard } from "@/lib/data/dashboard";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { WaterWidget } from "@/components/WaterWidget";
import { TrendChart } from "@/components/charts/TrendChart";
import { TodayPlanCard } from "@/components/dashboard/TodayPlanCard";
import { VitalsRow } from "@/components/dashboard/VitalsRow";
import { ForYouSection } from "@/components/dashboard/ForYouSection";
import { CoachBriefing } from "@/components/dashboard/CoachBriefing";
import { GoalTracker } from "@/components/dashboard/GoalTracker";
import { getAgentSnapshot } from "@/lib/ai/agent/context";
import { topNudges } from "@/lib/ai/agent/proactive";
import { ensureReport } from "@/lib/ai/agent/reports";
import { GOAL_LABELS } from "@/lib/constants";
import { getDailyMotivation, buildDashboardSuggestion } from "@/lib/motivation";
import {
  Sparkles, ArrowRight, TrendingDown, TrendingUp, LineChart as LineChartIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Tek çağrı — içeride Promise.all ile paralel. Eskiden 8 ardışık sorgu vardı.
  const d = await getDashboard(user!.id);
  const { summary, gam } = d;

  const motivation = getDailyMotivation(d.goal);
  const suggestion = buildDashboardSuggestion({
    hasWorkoutToday: summary.workout_planned,
    workoutCompleted: summary.workout_done,
    calories: summary.calories,
    calorieGoal: summary.calorie_goal,
    protein: summary.protein_g,
    proteinGoal: summary.protein_goal,
    waterMl: summary.water_ml,
    waterGoalMl: summary.water_goal,
  });

  const workoutHref = d.todayWorkoutId ? `/workouts/${d.todayWorkoutId}` : "/workouts/new";

  // --- Koç brifingi ---
  // Anlık görüntü tek RPC; uyarılar ondan saf fonksiyonla türetiliyor (AI çağrısı yok).
  // Rapor "tembel" üretiliyor: o gün için yoksa ve saati geldiyse bir kez üretilir,
  // sonra `unique(user_id, kind, report_date)` sayesinde tekrar üretilmez.
  // İkisi de sessizce null/boş dönebilir; o zaman blok hiç çizilmez.
  const snapshot = await getAgentSnapshot(user!.id);
  const nudges = topNudges(snapshot, 3);
  const hour = Number(
    new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Istanbul" })
  );
  const report = snapshot ? await ensureReport(user!.id, hour >= 18 ? "evening" : "morning") : null;

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <header className="animate-fade-up">
        <p className="text-sm text-fg-muted">Merhaba,</p>
        <h1 className="text-2xl font-bold">{d.firstName} 👋</h1>
        {d.goal && (
          <span className="mt-2 inline-block rounded-full border border-ink-border bg-ink-soft px-3 py-1 text-xs text-fg-muted">
            Hedef: {GOAL_LABELS[d.goal as keyof typeof GOAL_LABELS]}
          </span>
        )}
        <p className="mt-3 text-sm text-fg-muted">{motivation}</p>
      </header>

      {/* Koçun günlük raporu + proaktif uyarılar */}
      <CoachBriefing report={report} nudges={nudges} />

      {/* Günün görev merkezi */}
      <TodayPlanCard summary={summary} workoutHref={workoutHref} />

      {/* Hedef takibi — ilerleme vs. süre */}
      <GoalTracker goals={snapshot?.goals ?? []} />

      {/* Canlı göstergeler */}
      <VitalsRow gam={gam} recovery={d.recovery} readiness={d.readiness} />

      {/* AI bugün ne öneriyor */}
      <Link href={suggestion.href} className="block">
        <Card className="card-hover flex items-center justify-between border-brand/30 bg-gradient-to-br from-brand/10 to-transparent">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
              <Sparkles size={18} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-brand">AI bugün ne öneriyor</p>
              <p className="text-sm font-semibold">{suggestion.title}</p>
              <p className="text-xs text-fg-muted">{suggestion.body}</p>
            </div>
          </div>
          <ArrowRight size={18} className="shrink-0 text-brand" />
        </Card>
      </Link>

      {/* Beslenme + su detayı */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">
          Bugünkü Beslenme
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="Kalori"
            value={summary.calories.toLocaleString("tr-TR")}
            unit={`/ ${summary.calorie_goal.toLocaleString("tr-TR")}`}
            hint={summary.calories >= summary.calorie_goal ? "Hedefe ulaştın" : `${(summary.calorie_goal - summary.calories).toLocaleString("tr-TR")} kcal kaldı`}
          />
          <StatCard
            label="Protein"
            value={`${summary.protein_g} g`}
            unit={`/ ${summary.protein_goal} g`}
            accent={summary.protein_g >= summary.protein_goal}
            hint={summary.protein_g >= summary.protein_goal ? "Hedefe ulaştın" : `${summary.protein_goal - summary.protein_g} g kaldı`}
          />
          <div className="col-span-2 sm:col-span-1">
            <WaterWidget
              userId={user!.id}
              initialMl={summary.water_ml}
              goalMl={summary.water_goal}
            />
          </div>
        </div>
      </section>

      {/* İlerleme */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">
          İlerlemen
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Güncel Kilo" value={d.currentWeight || "—"} unit="kg" />
          <StatCard label="Başlangıç" value={d.startWeight || "—"} unit="kg" />
          <StatCard
            label="Değişim"
            value={d.weightDelta > 0 ? `+${d.weightDelta}` : d.weightDelta}
            unit="kg"
            accent
            icon={d.weightDelta <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
          />
          <StatCard label="Antrenman" value={d.completedWorkouts} hint="tamamlandı" />
        </div>

        {d.weightTrend.length >= 2 && (
          <Card className="mt-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <LineChartIcon size={16} className="text-brand" /> Kilo Trendi
            </p>
            <TrendChart data={d.weightTrend} unit="kg" />
          </Card>
        )}
      </section>

      {/* Bugün sana özel */}
      <ForYouSection
        readiness={d.readiness}
        hasWorkoutToday={summary.workout_planned}
        streak={gam.current_streak}
      />
    </div>
  );
}
