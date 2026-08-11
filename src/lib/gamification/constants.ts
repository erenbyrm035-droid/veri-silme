// Gamification — paylaşılan sabitler & stil eşlemeleri (client + server güvenli).
import type { BadgeTier } from "@/lib/database.types";

export const TIER_STYLE: Record<BadgeTier, { label: string; ring: string; text: string; bg: string; glow: string }> = {
  bronze:   { label: "Bronz",  ring: "ring-amber-700/40",  text: "text-amber-600",  bg: "bg-amber-700/10",   glow: "shadow-[0_0_20px_-4px_rgba(180,83,9,0.5)]" },
  silver:   { label: "Gümüş",  ring: "ring-slate-400/40",  text: "text-slate-300",  bg: "bg-slate-400/10",   glow: "shadow-[0_0_20px_-4px_rgba(148,163,184,0.5)]" },
  gold:     { label: "Altın",  ring: "ring-yellow-400/50", text: "text-yellow-400", bg: "bg-yellow-400/10",  glow: "shadow-[0_0_22px_-3px_rgba(250,204,21,0.6)]" },
  platinum: { label: "Platin", ring: "ring-cyan-300/50",   text: "text-cyan-300",   bg: "bg-cyan-300/10",    glow: "shadow-[0_0_22px_-3px_rgba(103,232,249,0.6)]" },
  diamond:  { label: "Elmas",  ring: "ring-sky-300/60",    text: "text-sky-300",    bg: "bg-sky-300/10",     glow: "shadow-[0_0_26px_-2px_rgba(125,211,252,0.7)]" },
  legend:   { label: "Efsane", ring: "ring-fuchsia-400/60",text: "text-fuchsia-400",bg: "bg-fuchsia-400/10", glow: "shadow-[0_0_30px_-2px_rgba(192,132,252,0.8)]" },
};

export const CATEGORY_LABEL: Record<string, string> = {
  workout: "Antrenman", nutrition: "Beslenme", posture: "Postür",
  ai: "AI Koç", streak: "Seri", volume: "Hacim", activity: "Aktivite",
  milestone: "Kilometre Taşı", social: "Sosyal",
};

export const METRIC_LABEL: Record<string, string> = {
  workouts_count: "Antrenman sayısı", total_volume: "Toplam hacim (kg)",
  exercises_count: "Egzersiz seti", posture_count: "Postür analizi",
  ai_count: "AI kullanımı", pr_count: "Rekor sayısı",
  water_days: "Su hedefi günü", protein_days: "Protein hedefi günü",
  streak_days: "Seri günü", active_days: "Aktif gün",
};

export const REWARD_TYPE_LABEL: Record<string, string> = {
  premium_days: "Premium Gün", profile_frame: "Profil Çerçevesi", theme: "Tema",
  ai_avatar: "AI Avatarı", badge: "Rozet", exercise_pack: "Egzersiz Paketi",
  program: "Program", diet_pack: "Diyet Paketi",
};

export const PERIOD_LABEL: Record<string, string> = {
  weekly: "Haftalık", monthly: "Aylık", yearly: "Yıllık", all_time: "Tüm Zamanlar",
};

export const STREAK_MILESTONES = [3, 7, 15, 30, 60, 100, 365];

/** Seri gün sayısına göre alev rengi. */
export function streakColor(days: number): string {
  if (days >= 365) return "#C084FC";
  if (days >= 100) return "#F472B6";
  if (days >= 30) return "#FB7185";
  if (days >= 7) return "#FBBF24";
  if (days >= 3) return "#38BDF8";
  return "#94A3B8";
}

/** Fitness skoru → etiket + renk. */
export function fitnessLabel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Mükemmel", color: "#34D399" };
  if (score >= 70) return { label: "Çok İyi", color: "#A3E635" };
  if (score >= 50) return { label: "İyi", color: "#FBBF24" };
  if (score >= 30) return { label: "Gelişmeli", color: "#FB923C" };
  return { label: "Başlangıç", color: "#FB7185" };
}

export type RecoveryStatus = "ready" | "rest" | "overloaded";
export const RECOVERY_META: Record<RecoveryStatus, { label: string; color: string; note: string }> = {
  ready:      { label: "Hazır",          color: "#34D399", note: "Vücudun antrenmana hazır. Yeni bir seansa başlayabilirsin." },
  rest:       { label: "Dinlenmeli",     color: "#FBBF24", note: "Hafif bir toparlanma dönemindesin. Hafif kardiyo veya mobilite iyi olur." },
  overloaded: { label: "Aşırı Yüklenmiş", color: "#FB7185", note: "Son günlerde yoğun çalıştın. Bir dinlenme günü toparlanmanı hızlandırır." },
};
