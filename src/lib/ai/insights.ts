import "server-only";
import { createClient } from "@/lib/supabase/server";

// ============================================================================
// AI içgörü motoru
//
// `ai_memory` geçmiş SOHBETİ hatırlar; burası kullanıcının VERİSİNİ hatırlar.
// `insights_snapshot()` RPC'sinden gelen sayısal bulguları, koçun doğrudan
// kullanabileceği Türkçe cümlelere çevirir.
//
// Cümleler deterministik — model uydurmuyor, sadece hazır bulguyu aktarıyor.
// ============================================================================

export interface InsightSnapshot {
  vol_this_week: number;
  vol_prev_week: number;
  workouts_week: number;
  workouts_prev: number;
  minutes_week: number;
  protein_miss_streak: number;
  water_miss_streak: number;
  active_streak: number;
  last_workout_days: number | null;
  weight_delta_30: number | null;
  pr_count_30: number;
  top_muscle: string | null;
  lagging_muscle: string | null;
  fav_exercise: string | null;
  sleep_avg_7: number;
  steps_avg_7: number;
}

const num = (v: unknown, f = 0) => (Number.isFinite(Number(v)) ? Number(v) : f);

/** Ham bulguları çeker. Hata durumunda null döner (AI bağlamsız da çalışır). */
export async function getInsights(userId: string): Promise<InsightSnapshot | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("insights_snapshot", { p_user: userId });
  if (error) return null;
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!r) return null;

  return {
    vol_this_week: num(r.vol_this_week),
    vol_prev_week: num(r.vol_prev_week),
    workouts_week: num(r.workouts_week),
    workouts_prev: num(r.workouts_prev),
    minutes_week: num(r.minutes_week),
    protein_miss_streak: num(r.protein_miss_streak),
    water_miss_streak: num(r.water_miss_streak),
    active_streak: num(r.active_streak),
    last_workout_days: r.last_workout_days === null ? null : num(r.last_workout_days),
    weight_delta_30: r.weight_delta_30 === null ? null : num(r.weight_delta_30),
    pr_count_30: num(r.pr_count_30),
    top_muscle: (r.top_muscle as string) ?? null,
    lagging_muscle: (r.lagging_muscle as string) ?? null,
    fav_exercise: (r.fav_exercise as string) ?? null,
    sleep_avg_7: num(r.sleep_avg_7),
    steps_avg_7: num(r.steps_avg_7),
  };
}

/**
 * Bulguları koçun kullanabileceği cümlelere çevirir.
 * Yalnızca anlamlı olanlar döner — boş/etkisiz veriler cümleye dönüşmez.
 */
export function insightsToFacts(s: InsightSnapshot | null): string[] {
  if (!s) return [];
  const out: string[] = [];

  // Hacim trendi
  if (s.vol_prev_week > 0 && s.vol_this_week > 0) {
    const pct = Math.round(((s.vol_this_week - s.vol_prev_week) / s.vol_prev_week) * 100);
    if (Math.abs(pct) >= 10) {
      out.push(
        pct > 0
          ? `Bu hafta kaldırdığı hacim geçen haftaya göre %${pct} arttı (${Math.round(s.vol_this_week).toLocaleString("tr-TR")} kg).`
          : `Bu hafta kaldırdığı hacim geçen haftaya göre %${Math.abs(pct)} düştü.`
      );
    }
  }

  // Antrenman sıklığı
  if (s.workouts_week > 0 || s.workouts_prev > 0) {
    out.push(
      `Son 7 günde ${s.workouts_week} antrenman yaptı (önceki hafta ${s.workouts_prev}), toplam ${s.minutes_week} dakika.`
    );
  }

  // Uzun aradır antrenman yok
  if (s.last_workout_days !== null && s.last_workout_days >= 4) {
    out.push(`Son antrenmanının üzerinden ${s.last_workout_days} gün geçti.`);
  }

  // Hedef kaçırma serileri
  if (s.protein_miss_streak >= 3) {
    out.push(`${s.protein_miss_streak} gündür üst üste protein hedefini tutturamıyor.`);
  }
  if (s.water_miss_streak >= 3) {
    out.push(`${s.water_miss_streak} gündür üst üste su hedefinin altında kalıyor.`);
  }

  // Seri
  if (s.active_streak >= 3) {
    out.push(`${s.active_streak} günlük kesintisiz aktivite serisi var — bunu korumak motive edici.`);
  }

  // Kas dengesi
  if (s.top_muscle && s.lagging_muscle && s.top_muscle !== s.lagging_muscle) {
    out.push(`Son 30 günde en çok "${s.top_muscle}" çalıştı; "${s.lagging_muscle}" ihmal edilmiş durumda.`);
  }

  // Rekorlar
  if (s.pr_count_30 > 0) {
    out.push(`Son 30 günde ${s.pr_count_30} kişisel rekor kırdı.`);
  }

  // Kilo
  if (s.weight_delta_30 !== null && Math.abs(s.weight_delta_30) >= 0.5) {
    const d = Number(s.weight_delta_30.toFixed(1));
    out.push(`Son 30 günde kilosu ${d > 0 ? "+" : ""}${d} kg değişti.`);
  }

  // Favori hareket
  if (s.fav_exercise) {
    out.push(`En sık yaptığı hareket: ${s.fav_exercise}.`);
  }

  // Uyku / adım
  if (s.sleep_avg_7 > 0) {
    const h = Math.floor(s.sleep_avg_7 / 60);
    const m = s.sleep_avg_7 % 60;
    out.push(`Son 7 günün ortalama uykusu ${h} saat ${m} dakika.`);
  }
  if (s.steps_avg_7 > 0) {
    out.push(`Günlük ortalama ${s.steps_avg_7.toLocaleString("tr-TR")} adım atıyor.`);
  }

  return out;
}

/** İçgörüleri sistem promptuna eklenecek bloğa çevirir. */
export function insightsToPrompt(facts: string[]): string {
  if (facts.length === 0) return "";
  return (
    "\n\nKULLANICININ GERÇEK VERİSİ (bunlara dayanarak konuş, uydurma):\n" +
    facts.map((f) => `- ${f}`).join("\n") +
    "\nBu bulgulardan en az birine doğal biçimde değin; kullanıcı kendini tanınmış hissetsin. " +
    "Rakamları olduğu gibi kullan, tahmin ekleme."
  );
}

/** Tek adımda: veriyi çek → cümlelere çevir → prompt bloğu üret. */
export async function buildInsightBlock(userId: string): Promise<string> {
  try {
    const snap = await getInsights(userId);
    return insightsToPrompt(insightsToFacts(snap));
  } catch {
    return "";
  }
}
