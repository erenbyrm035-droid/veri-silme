import type { AgentSnapshot } from "@/lib/ai/agent/context";
import type { MemoryLayer } from "./types";
import type { RouteSignals } from "./specialists/kit";
import { GOAL_LABELS, EXPERIENCE_LABELS, ENVIRONMENT_LABELS } from "@/lib/constants";

// ============================================================================
// KATMANLI ORTAK HAFIZA
//
// Tüm ajanlar AYNI kaynaktan besleniyor (`agent_snapshot` + `ai_facts` +
// konuşma geçmişi) ama her ajan yalnızca KENDİ katmanlarını görüyor.
//
// NEDEN DİLİMLEME:
//   1) Token. 8 ajana tam bağlamı vermek maliyeti 8'le çarpar. Beslenme
//      uzmanının takım savaşını bilmesi cevabı iyileştirmiyor, sadece pahalı.
//   2) Odak. Model kendi alanı dışındaki veriyi görünce oraya kayıyor;
//      "beslenme sorusu" cevabının içine takım sıralaması giriyor.
//   3) Gizlilik. Sağlık verisi yalnızca ona ihtiyaç duyan ajana gidiyor.
//
// Bu dosya `server-only` DEĞİL: saf dönüşüm yapıyor, veriyi kendi çekmiyor.
// Böylece birim testinden geçirilebiliyor.
// ============================================================================

const s = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
};
const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** `recovery_score`/`readiness_score` bileşik döner; skaler ihtimalini de karşıla. */
const scoreOf = (v: unknown): number | null =>
  v && typeof v === "object" ? n(obj(v).score) : n(v);

export interface SessionMessage {
  role: "user" | "assistant";
  content: string;
}

export interface MemoryInput {
  snapshot: AgentSnapshot | null;
  /** Konuşmanın son mesajları — kısa vadeli hafıza. */
  session: SessionMessage[];
  /** Eski serbest metin hafıza (ai_memory.summary) — geriye dönük uyumluluk. */
  legacySummary?: string | null;
}

// ---------------------------------------------------------------------------
// Katman üreticileri — her biri kendi başına bir metin bloğu döndürür.
// Veri yoksa boş string döner ve prompta hiç eklenmez.
// ---------------------------------------------------------------------------

function layerProfile(snap: AgentSnapshot): string {
  const p = obj(snap.profile);
  const goalKey = s(p.goal);
  const expKey = s(p.experience);
  const envKey = s(p.training_environment);
  const lines = [
    s(p.full_name) && `İsim: ${s(p.full_name)}`,
    n(p.age) && `Yaş: ${n(p.age)}`,
    s(p.gender) && `Cinsiyet: ${s(p.gender)}`,
    n(p.height_cm) && `Boy: ${n(p.height_cm)} cm`,
    n(p.weight_kg) && `Kilo: ${n(p.weight_kg)} kg`,
    n(p.target_weight_kg) && `Hedef kilo: ${n(p.target_weight_kg)} kg`,
    n(p.body_fat_pct) && `Yağ oranı: %${n(p.body_fat_pct)}`,
    goalKey && `Hedef: ${GOAL_LABELS[goalKey as keyof typeof GOAL_LABELS] ?? goalKey}`,
    expKey && `Deneyim: ${EXPERIENCE_LABELS[expKey as keyof typeof EXPERIENCE_LABELS] ?? expKey}`,
    envKey && `Ortam: ${ENVIRONMENT_LABELS[envKey as keyof typeof ENVIRONMENT_LABELS] ?? envKey}`,
    n(p.weekly_training_days) && `Haftada ${n(p.weekly_training_days)} gün antrenman`,
    `Premium: ${p.is_premium ? "evet" : "hayır"}`,
  ].filter(Boolean);
  return lines.length ? `PROFİL\n${lines.map((l) => `• ${l}`).join("\n")}` : "";
}

function layerHealth(snap: AgentSnapshot): string {
  const p = obj(snap.profile);
  const t = obj(snap.today);
  const injuries = arr(p.injuries).map(String).filter(Boolean);
  const conditions = arr(p.health_conditions).map(String).filter(Boolean);
  const allergies = arr(p.allergies).map(String).filter(Boolean);
  const recovery = scoreOf(t.recovery);
  const readiness = scoreOf(t.readiness);
  const sleep = n(t.sleep_minutes);

  const lines = [
    injuries.length ? `SAKATLIK (zorunlu dikkat): ${injuries.join(", ")}` : null,
    conditions.length ? `Sağlık durumu: ${conditions.join(", ")}` : null,
    allergies.length ? `ALERJİ (zorunlu dikkat): ${allergies.join(", ")}` : null,
    s(p.health_notes) && `Sağlık notu: ${s(p.health_notes)}`,
    recovery !== null ? `Toparlanma: ${recovery}/100` : null,
    readiness !== null ? `Antrenmana hazır olma: ${readiness}/100` : null,
    sleep ? `Bugünkü uyku: ${Math.floor(sleep / 60)} sa ${sleep % 60} dk` : "Bugünkü uyku: kayıt yok",
  ].filter(Boolean);
  return lines.length ? `SAĞLIK\n${lines.map((l) => `• ${l}`).join("\n")}` : "";
}

function layerNutrition(snap: AgentSnapshot): string {
  const t = obj(snap.today);
  const nut = obj(snap.nutrition_7d);
  const gap = (done: unknown, goal: unknown, unit: string) => {
    const d = n(done), g = n(goal);
    if (d === null || g === null || g <= 0) return null;
    const diff = Math.round(g - d);
    return `${Math.round(d)}/${g} ${unit}${diff > 0 ? ` (${diff} ${unit} eksik)` : " (hedef tuttu)"}`;
  };
  const logged = n(nut.logged_days) ?? 0;

  const lines = [
    gap(t.calories, t.calorie_goal, "kcal") && `Bugün kalori: ${gap(t.calories, t.calorie_goal, "kcal")}`,
    gap(t.protein_g, t.protein_goal, "g") && `Bugün protein: ${gap(t.protein_g, t.protein_goal, "g")}`,
    gap(t.water_ml, t.water_goal, "ml") && `Bugün su: ${gap(t.water_ml, t.water_goal, "ml")}`,
    logged > 0
      ? `Son 7 gün: ${logged} gün kayıt, ortalama ${n(nut.avg_calories) ?? "?"} kcal / ${n(nut.avg_protein) ?? "?"} g protein`
      : "Son 7 günde HİÇ beslenme kaydı yok — ortalama hesaplanamaz, rakam uydurma.",
  ].filter(Boolean);
  return lines.length ? `BESLENME\n${lines.map((l) => `• ${l}`).join("\n")}` : "";
}

function layerWorkout(snap: AgentSnapshot): string {
  const t = obj(snap.today);
  const recent = arr(snap.recent_workouts).map(obj);
  const monthly = arr(snap.monthly).map(obj);

  const todayLine = t.workout_done
    ? `Bugün antrenman tamamlandı${s(t.workout_title) ? ` (${s(t.workout_title)})` : ""}`
    : t.workout_planned
      ? `Bugün planlı ama YAPILMADI${s(t.workout_title) ? ` (${s(t.workout_title)})` : ""}`
      : "Bugün planlanmış antrenman yok";

  const recentLines = recent.length
    ? recent.slice(0, 8).map(
        (w) =>
          `${s(w.date)}: ${s(w.title) ?? "Antrenman"} — ${w.status === "completed" ? "tamamlandı" : String(w.status)}` +
          `${n(w.minutes) ? `, ${n(w.minutes)} dk` : ""}${n(w.volume) ? `, ${Math.round(n(w.volume)!).toLocaleString("tr-TR")} kg` : ""}`
      )
    : ["Kayıtlı antrenman yok."];

  const monthlyLine = monthly.length
    ? `Aylık özet: ${monthly.slice(-6).map((m) => `${s(m.month)} ${n(m.workouts) ?? 0} antrenman`).join(", ")}`
    : null;

  return `ANTRENMAN\n• ${todayLine}\n${recentLines.map((l) => `• ${l}`).join("\n")}${monthlyLine ? `\n• ${monthlyLine}` : ""}`;
}

function layerGoals(snap: AgentSnapshot): string {
  const goals = snap.goals ?? [];
  if (goals.length === 0) return "HEDEFLER\n• Aktif hedef yok.";
  return (
    "HEDEFLER\n" +
    goals
      .map(
        (g) =>
          `• ${g.title}: ${g.current_value ?? "?"} → ${g.target_value} · ilerleme ` +
          `${g.progress_pct === null ? "hesaplanamıyor" : `%${g.progress_pct}`}` +
          `${g.time_pct === null ? "" : `, sürenin %${g.time_pct}'i geçti`}` +
          `${g.days_left === null ? "" : `, ${g.days_left} gün kaldı`}` +
          ` · ${g.on_track ? "yolunda" : "SAPMA VAR"}`
      )
      .join("\n")
  );
}

function layerSocial(snap: AgentSnapshot): string {
  const team = snap.team ? obj(snap.team) : null;
  const soc = obj(snap.social);
  const g = obj(snap.gamification);
  const season = obj(snap.season);
  const challenges = arr(snap.challenges).map(obj);

  const lines = [
    team
      ? `Takım: ${s(team.name)} (seviye ${n(team.level) ?? "?"}, ${n(team.member_count) ?? "?"} üye${
          n(team.active_battles) ? `, ${n(team.active_battles)} aktif savaş` : ""
        })`
      : "Takım: yok",
    `Arkadaş: ${n(soc.friends) ?? 0} · Takipçi: ${n(soc.followers) ?? 0}`,
    n(soc.pending_requests) ? `Bekleyen arkadaşlık isteği: ${n(soc.pending_requests)}` : null,
    `Seviye ${n(g.level) ?? 0} · ${n(g.total_xp) ?? 0} XP · seri ${n(g.current_streak) ?? 0} gün · ${n(g.coins) ?? 0} coin`,
    season.active
      ? `Battle Pass: kademe ${n(season.tier) ?? 0}/${n(season.max_tier) ?? 0}, sonraki kademeye ${n(season.next_req_xp) ?? "?"} XP`
      : "Aktif Battle Pass sezonu yok",
    challenges.length
      ? `Haftalık görevler: ${challenges.map((c) => `${s(c.title)} ${n(c.progress) ?? 0}/${n(c.target) ?? 0}${c.completed ? " ✓" : ""}`).join(" · ")}`
      : null,
  ].filter(Boolean);

  return `SOSYAL VE İLERLEME\n${lines.map((l) => `• ${l}`).join("\n")}`;
}

function layerLongterm(snap: AgentSnapshot): string {
  const facts = snap.facts ?? [];
  if (facts.length === 0) return "";
  return (
    "KALICI HAFIZA (kullanıcı bunları daha önce söyledi)\n" +
    facts
      .slice(0, 30)
      .map((f) => `• [${f.category}] ${f.value}${f.confidence < 0.6 ? " (emin değilsin)" : ""}`)
      .join("\n")
  );
}

function layerSession(input: MemoryInput): string {
  const msgs = input.session.slice(-6);
  const legacy = s(input.legacySummary);
  const parts: string[] = [];

  if (msgs.length) {
    parts.push(
      "KONUŞMANIN SON MESAJLARI\n" +
        msgs.map((m) => `${m.role === "user" ? "Kullanıcı" : "Koç"}: ${m.content.slice(0, 400)}`).join("\n")
    );
  }
  if (legacy) parts.push(`ÖNCEKİ KONUŞMA ÖZETİ\n${legacy.slice(-600)}`);
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Dışa açık API
// ---------------------------------------------------------------------------

/** Tek bir katmanı üretir. */
export function buildLayer(layer: MemoryLayer, input: MemoryInput): string {
  const snap = input.snapshot;
  if (layer === "session") return layerSession(input);
  if (!snap) return "";
  switch (layer) {
    case "profile":   return layerProfile(snap);
    case "health":    return layerHealth(snap);
    case "nutrition": return layerNutrition(snap);
    case "workout":   return layerWorkout(snap);
    case "goals":     return layerGoals(snap);
    case "social":    return layerSocial(snap);
    case "longterm":  return layerLongterm(snap);
    default:          return "";
  }
}

/**
 * Bir ajanın göreceği bağlamı üretir.
 *
 * `limit` karakter tavanı: admin panelinden ajan başına ayarlanabiliyor.
 * Tavan aşılırsa SON katmanlar kırpılır, ilk katmanlar korunur — katman
 * sırası önem sırasıdır ve profil/sağlık her zaman girmelidir.
 */
export function buildAgentContext(
  layers: MemoryLayer[],
  input: MemoryInput,
  limit = 5000
): string {
  const blocks: string[] = [];
  let used = 0;

  for (const layer of layers) {
    const block = buildLayer(layer, input);
    if (!block) continue;
    if (used + block.length > limit) {
      const remaining = limit - used;
      // Anlamsız bir kırpıntı eklemektense katmanı tamamen atla.
      if (remaining > 200) {
        blocks.push(block.slice(0, remaining) + "\n… (bağlam sınırı)");
        used = limit;
      }
      break;
    }
    blocks.push(block);
    used += block.length;
  }

  return blocks.join("\n\n");
}

/**
 * Yönlendirici için bağlam sinyalleri.
 *
 * Kullanıcı sormasa bile hangi uzmanın gerekli olduğunu belirler:
 * toparlanma 30 ise toparlanma uzmanı, sakatlık varsa fizyoterapist.
 */
export function extractSignals(snap: AgentSnapshot | null): RouteSignals {
  if (!snap) {
    return {
      recovery: null, readiness: null, hasInjuries: false,
      hasHealthConditions: false, goalsOffTrack: 0, daysSinceWorkout: null,
      hasTeam: false, proteinGapRatio: 0, nutritionLoggedDays: 0,
    };
  }
  const p = obj(snap.profile);
  const t = obj(snap.today);
  const nut = obj(snap.nutrition_7d);
  const recent = arr(snap.recent_workouts).map(obj);

  const lastCompleted = recent.find((w) => w.status === "completed");
  let daysSinceWorkout: number | null = null;
  if (lastCompleted?.date) {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    const diff = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${String(lastCompleted.date)}T00:00:00Z`);
    if (Number.isFinite(diff)) daysSinceWorkout = Math.floor(diff / 86_400_000);
  }

  const protein = n(t.protein_g) ?? 0;
  const proteinGoal = n(t.protein_goal) ?? 0;

  return {
    recovery: scoreOf(t.recovery),
    readiness: scoreOf(t.readiness),
    hasInjuries: arr(p.injuries).filter(Boolean).length > 0,
    hasHealthConditions: arr(p.health_conditions).filter(Boolean).length > 0,
    goalsOffTrack: (snap.goals ?? []).filter((g) => !g.on_track).length,
    daysSinceWorkout,
    hasTeam: !!snap.team,
    proteinGapRatio: proteinGoal > 0 ? Math.max(0, (proteinGoal - protein) / proteinGoal) : 0,
    nutritionLoggedDays: n(nut.logged_days) ?? 0,
  };
}
