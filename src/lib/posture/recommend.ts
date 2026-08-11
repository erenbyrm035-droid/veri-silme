// ============================================================================
// Akıllı öneri motoru — postür bulgularından:
//   • bölge puanları (yeşil/sarı/kırmızı),
//   • kas dengesizliği (kısa/zayıf/aşırı aktif/inhibe),
//   • gün bazlı düzeltici program dağıtımı,
//   • iyileşme yüzdesi.
// Saf fonksiyonlar (client + server).
// ============================================================================
import type {
  PostureProblem, PostureFinding, PostureRegion, RegionScore, RegionStatus,
  PostureMuscleAnalysis, RiskLevel, CorrectiveProgram, CorrectiveExercise, CorrectiveSectionType,
} from "@/lib/database.types";

export const REGION_LABELS: Record<PostureRegion, string> = {
  head: "Baş", neck: "Boyun", shoulders: "Omuzlar", scapula: "Skapula",
  chest: "Göğüs", thoracic: "Torakal Bölge", lower_back: "Bel", pelvis: "Pelvis",
  hip: "Kalça", knee: "Diz", foot: "Ayak", ankle: "Ayak Bileği",
};
export const REGION_ORDER: PostureRegion[] = [
  "head", "neck", "shoulders", "scapula", "chest", "thoracic",
  "lower_back", "pelvis", "hip", "knee", "foot", "ankle",
];

/** Her postür problemi hangi bölgeleri etkiler. */
export const PROBLEM_REGIONS: Record<PostureProblem, PostureRegion[]> = {
  forward_head: ["head", "neck", "thoracic"],
  rounded_shoulders: ["shoulders", "scapula", "chest"],
  upper_cross: ["head", "neck", "shoulders", "scapula", "thoracic"],
  lower_cross: ["lower_back", "pelvis", "hip"],
  kyphosis: ["thoracic", "shoulders", "chest"],
  lordosis: ["lower_back", "pelvis"],
  scoliosis: ["thoracic", "lower_back", "shoulders"],
  pelvic_tilt: ["pelvis", "lower_back", "hip"],
  anterior_pelvic_tilt: ["pelvis", "lower_back", "hip"],
  posterior_pelvic_tilt: ["pelvis", "lower_back", "hip"],
  knee_valgus: ["knee", "hip", "ankle"],
  knee_varus: ["knee", "hip", "ankle"],
  foot_pronation: ["foot", "ankle", "knee"],
  flat_feet: ["foot", "ankle", "knee"],
  winged_scapula: ["scapula", "shoulders", "thoracic"],
  shoulder_asymmetry: ["shoulders", "scapula", "neck"],
  hip_asymmetry: ["hip", "pelvis", "lower_back"],
};

const RISK_PENALTY: Record<RiskLevel, number> = { low: 12, moderate: 25, high: 42 };

function statusFromScore(score: number): RegionStatus {
  if (score >= 80) return "normal";
  if (score >= 55) return "attention";
  return "high_risk";
}

/** Bulgulardan bölge puanları (0-100 + durum). */
export function buildRegionScores(findings: PostureFinding[]): Record<PostureRegion, RegionScore> {
  const scores = {} as Record<PostureRegion, number>;
  REGION_ORDER.forEach((r) => (scores[r] = 100));
  findings.forEach((f) => {
    (PROBLEM_REGIONS[f.problem] ?? []).forEach((r) => {
      scores[r] = Math.max(0, scores[r] - RISK_PENALTY[f.risk]);
    });
  });
  const out = {} as Record<PostureRegion, RegionScore>;
  REGION_ORDER.forEach((r) => (out[r] = { score: scores[r], status: statusFromScore(scores[r]) }));
  return out;
}

const uniq = (arr: string[]) => [...new Set(arr)];

/** Kas dengesizliği analizi: kısa/zayıf/aşırı aktif/inhibe. */
export function buildPostureMuscleAnalysis(findings: PostureFinding[]): PostureMuscleAnalysis {
  const short: string[] = [], weak: string[] = [], overactive: string[] = [], inhibited: string[] = [];
  findings.forEach((f) => {
    // Gergin kaslar → kısa + aşırı aktif
    short.push(...f.tight_muscles);
    overactive.push(...f.tight_muscles);
    // Zayıf kaslar → zayıf + inhibe
    weak.push(...f.weak_muscles);
    inhibited.push(...f.weak_muscles);
  });
  return { short: uniq(short), weak: uniq(weak), overactive: uniq(overactive), inhibited: uniq(inhibited) };
}

/** Genel risk seviyesi (en yüksek bulgu riski). */
export function overallRisk(findings: PostureFinding[]): RiskLevel {
  if (findings.some((f) => f.risk === "high")) return "high";
  if (findings.some((f) => f.risk === "moderate")) return "moderate";
  return "low";
}

export interface DayPlan {
  day: number;
  exercises: (CorrectiveExercise & { day: number })[];
}

/** Düzeltici programı N güne (1/3/5/7) dağıtır. */
export function distributeByDays(program: CorrectiveProgram, days: 1 | 3 | 5 | 7): DayPlan[] {
  const all = program.sections.flatMap((s) => s.exercises);
  const plan: DayPlan[] = Array.from({ length: days }, (_, i) => ({ day: i + 1, exercises: [] }));
  all.forEach((ex, i) => {
    const d = i % days;
    plan[d].exercises.push({ ...ex, day: d + 1 });
  });
  return plan;
}

/** İyileşme yüzdesi (önceki → mevcut posture score). */
export function improvementPct(prevScore: number | null | undefined, currentScore: number): number | null {
  if (prevScore == null || prevScore <= 0) return null;
  return Math.round(((currentScore - prevScore) / prevScore) * 1000) / 10;
}

/** Kısa özet öneri metni. */
export function sectionMinutes(count: number): number {
  return Math.max(5, Math.round(count * 1.5));
}

export const RISK_TR: Record<RiskLevel, string> = { low: "Düşük", moderate: "Dikkat", high: "Yüksek Risk" };
export const STATUS_TR: Record<RegionStatus, string> = { normal: "Normal", attention: "Dikkat", high_risk: "Yüksek Risk" };
export const STATUS_COLOR: Record<RegionStatus, string> = {
  normal: "text-emerald-400", attention: "text-amber-400", high_risk: "text-coral",
};
