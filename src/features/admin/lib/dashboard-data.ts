import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { AdminDashboardData, ChartPoint } from "./sample-data";

async function countOf(supabase: ReturnType<typeof createAdminClient>, table: string, filter?: (q: any) => any): Promise<number> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

function dayLabel(d: Date) { return ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"][d.getDay()]; }
function monthLabel(d: Date) { return ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"][d.getMonth()]; }

/** Admin dashboard için GERÇEK metrikler (service_role ile). */
export async function getDashboardData(): Promise<AdminDashboardData> {
  const supabase = createAdminClient();

  // Kullanıcı kayıt tarihleri (grafikler + delta için).
  const [{ data: profs }, gifList] = await Promise.all([
    supabase.from("profiles").select("created_at, is_premium").limit(20000),
    supabase.storage.from("exercise-media").list("", { limit: 5000 }),
  ]);
  const profiles = (profs ?? []) as { created_at: string; is_premium: boolean }[];

  const [totalExercises, totalPrograms, totalDiets, totalAiChats] = await Promise.all([
    countOf(supabase, "exercises"),
    countOf(supabase, "workout_programs"),
    countOf(supabase, "diet_plans"),
    countOf(supabase, "ai_conversations"),
  ]);

  const totalUsers = profiles.length;
  const premiumUsers = profiles.filter((p) => p.is_premium).length;
  const totalGifs = (gifList.data ?? []).filter((f: { name: string }) => /\.(gif|webp|png|jpe?g)$/i.test(f.name)).length;

  // Delta: son 30 gün / önceki 30 gün kullanıcı kaydı
  const now = Date.now();
  const d30 = now - 30 * 864e5, d60 = now - 60 * 864e5;
  const last30 = profiles.filter((p) => +new Date(p.created_at) >= d30).length;
  const prev30 = profiles.filter((p) => { const t = +new Date(p.created_at); return t >= d60 && t < d30; }).length;
  const userDelta = prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 1000) / 10 : last30 > 0 ? 100 : 0;

  // --- Grafik serileri (gerçek) ---
  const dailyUsers: ChartPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now - i * 864e5);
    const key = day.toISOString().slice(0, 10);
    dailyUsers.push({ label: dayLabel(day), value: profiles.filter((p) => p.created_at.slice(0, 10) === key).length });
  }
  const weeklyUsers: ChartPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = now - (i + 1) * 7 * 864e5, end = now - i * 7 * 864e5;
    weeklyUsers.push({ label: `H${6 - i}`, value: profiles.filter((p) => { const t = +new Date(p.created_at); return t >= start && t < end; }).length });
  }
  const monthlyUsers: ChartPoint[] = [];
  const premiumGrowth: ChartPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(); m.setMonth(m.getMonth() - i); m.setDate(1); m.setHours(0, 0, 0, 0);
    const next = new Date(m); next.setMonth(next.getMonth() + 1);
    const inMonth = profiles.filter((p) => { const t = +new Date(p.created_at); return t >= +m && t < +next; });
    monthlyUsers.push({ label: monthLabel(m), value: inMonth.length });
    premiumGrowth.push({ label: monthLabel(m), value: profiles.filter((p) => p.is_premium && +new Date(p.created_at) < +next).length });
  }

  return {
    stats: [
      { key: "users", label: "Toplam Kullanıcı", value: totalUsers, delta: userDelta, icon: "users" },
      { key: "premium", label: "Premium Kullanıcı", value: premiumUsers, delta: 0, icon: "crown" },
      { key: "exercises", label: "Toplam Egzersiz", value: totalExercises, delta: 0, icon: "dumbbell" },
      { key: "programs", label: "Toplam Program", value: totalPrograms, delta: 0, icon: "calendar" },
      { key: "gifs", label: "Toplam GIF", value: totalGifs, delta: 0, icon: "film" },
      { key: "diet_plans", label: "Toplam Diyet Planı", value: totalDiets, delta: 0, icon: "apple" },
      { key: "ai_chats", label: "Toplam AI Sohbeti", value: totalAiChats, delta: 0, icon: "brain" },
    ],
    charts: { dailyUsers, weeklyUsers, monthlyUsers, premiumGrowth },
  };
}
