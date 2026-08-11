import { redirect } from "next/navigation";
import { Users, Dumbbell, Apple, ScanLine, Coins, Activity } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { createAdminClient } from "@/lib/supabase/server";
import { ChartPlaceholder } from "@/features/admin/components/dashboard/chart-placeholder";
import { Card } from "@/features/admin/components/ui/card";
import { formatNumber } from "@/lib/utils";
import type { ChartPoint } from "@/features/admin/lib/sample-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics · Admin" };

async function count(s: ReturnType<typeof createAdminClient>, table: string, f?: (q: any) => any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = s.from(table).select("id", { count: "exact", head: true });
  if (f) q = f(q);
  return (await q).count ?? 0;
}
const monthLabel = (d: Date) => ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"][d.getMonth()];

export default async function AnalyticsPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  const s = createAdminClient();
  const d30 = new Date(Date.now() - 30 * 864e5).toISOString();

  const [
    totalUsers, newUsers30, totalWorkouts, completedWorkouts, nutritionLogs,
    postureRows, aiUsage, workoutRows,
  ] = await Promise.all([
    count(s, "profiles"),
    count(s, "profiles", (q) => q.gte("created_at", d30)),
    count(s, "workouts"),
    count(s, "workouts", (q) => q.eq("status", "completed")),
    count(s, "nutrition_logs"),
    s.from("posture_analyses").select("posture_score").limit(5000),
    s.from("ai_usage").select("total_tokens").limit(20000),
    s.from("workouts").select("workout_date").gte("workout_date", new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10)).limit(20000),
  ]);

  const postures = (postureRows.data ?? []) as { posture_score: number }[];
  const avgPosture = postures.length ? Math.round(postures.reduce((a, r) => a + r.posture_score, 0) / postures.length) : 0;
  const totalTokens = ((aiUsage.data ?? []) as { total_tokens: number }[]).reduce((a, r) => a + r.total_tokens, 0);

  // Aylık antrenman trendi (son 6 ay)
  const wrows = (workoutRows.data ?? []) as { workout_date: string }[];
  const workoutTrend: ChartPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(); m.setMonth(m.getMonth() - i); m.setDate(1);
    const next = new Date(m); next.setMonth(next.getMonth() + 1);
    const key = m.toISOString().slice(0, 7);
    workoutTrend.push({ label: monthLabel(m), value: wrows.filter((w) => w.workout_date.slice(0, 7) === key).length });
    void next;
  }

  const cards = [
    { label: "Toplam Kullanıcı", value: totalUsers, sub: `+${newUsers30} (30g)`, icon: Users },
    { label: "Toplam Antrenman", value: totalWorkouts, sub: `${completedWorkouts} tamamlandı`, icon: Dumbbell },
    { label: "Beslenme Kaydı", value: nutritionLogs, sub: "toplam log", icon: Apple },
    { label: "Postür Analizi", value: postures.length, sub: `ort. ${avgPosture}`, icon: ScanLine },
    { label: "AI Token", value: totalTokens, sub: "toplam kullanım", icon: Coins },
    { label: "Aktiflik", value: completedWorkouts, sub: "tamamlanan antrenman", icon: Activity },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-fg-muted">Platform genelinde toplu metrikler ve trendler.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-soft text-brand"><c.icon size={18} /></span>
            <p className="mt-3 text-2xl font-bold tracking-tight">{formatNumber(c.value)}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{c.label}</p>
            <p className="text-[11px] text-fg-muted">{c.sub}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPlaceholder title="Aylık Antrenman" data={workoutTrend} color="#38bdf8" />
        <Card className="p-5">
          <h3 className="text-sm font-semibold">Özet</h3>
          <ul className="mt-3 space-y-2 text-sm text-fg-muted">
            <li className="flex justify-between"><span>Son 30 günde yeni kullanıcı</span><span className="font-semibold text-fg">{newUsers30}</span></li>
            <li className="flex justify-between"><span>Antrenman tamamlama oranı</span><span className="font-semibold text-fg">{totalWorkouts ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0}%</span></li>
            <li className="flex justify-between"><span>Ortalama postür skoru</span><span className="font-semibold text-fg">{avgPosture}/100</span></li>
            <li className="flex justify-between"><span>Toplam AI token</span><span className="font-semibold text-fg">{formatNumber(totalTokens)}</span></li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
