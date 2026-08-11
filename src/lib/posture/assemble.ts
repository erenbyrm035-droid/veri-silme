// ============================================================================
// Postür bulgularından düzeltici program + skorların birleştirilmesi.
// AI görüntü analizi de, öz-değerlendirme fallback'i de aynı yapıyı üretir.
// ============================================================================
import type {
  PostureProblem,
  RiskLevel,
  PostureFinding,
  CorrectiveProgram,
  CorrectiveSection,
  CorrectiveSectionType,
  PostureScores,
  TrainingEnvironment,
} from "@/lib/database.types";
import { POSTURE_PROBLEMS, SECTION_LABELS } from "./problems";
import { resolveExercise } from "./exercises";

const SECTION_ORDER: CorrectiveSectionType[] = [
  "mobilization",
  "activation",
  "strengthening",
  "stretching",
  "cooldown",
];

/** "both" → salon varyantını gösterir (daha fazla ekipman seçeneği). */
export function normalizeEnv(env: TrainingEnvironment): "home" | "gym" {
  return env === "home" ? "home" : "gym";
}

/** Problem + güven skorlarından tam bulgu nesneleri üretir. */
export function buildFindings(
  detected: { problem: PostureProblem; confidence?: number; risk?: RiskLevel }[]
): PostureFinding[] {
  return detected
    .filter((d) => POSTURE_PROBLEMS[d.problem])
    .map((d) => {
      const info = POSTURE_PROBLEMS[d.problem];
      return {
        problem: d.problem,
        label: info.label,
        confidence: clamp(d.confidence ?? 70, 40, 96),
        risk: d.risk ?? info.defaultRisk,
        description: info.description,
        affected_muscles: info.affected_muscles,
        weak_muscles: info.weak_muscles,
        tight_muscles: info.tight_muscles,
        explanation: info.explanation,
      };
    });
}

/** Bulgu listesinden ortama göre düzeltici program oluşturur. */
export function buildCorrectiveProgram(
  problems: PostureProblem[],
  env: TrainingEnvironment
): CorrectiveProgram {
  const resolvedEnv = normalizeEnv(env);
  const sections: CorrectiveSection[] = [];
  let totalSeconds = 0;

  for (const type of SECTION_ORDER) {
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const p of problems) {
      const info = POSTURE_PROBLEMS[p];
      if (!info) continue;
      for (const key of info.corrective[type]) {
        if (!seen.has(key)) {
          seen.add(key);
          keys.push(key);
        }
      }
    }
    const exercises = keys
      .map((k) => resolveExercise(k, resolvedEnv))
      .filter((e): e is NonNullable<typeof e> => e !== null);
    if (exercises.length === 0) continue;

    for (const ex of exercises) {
      const sets = ex.sets ?? 1;
      const work = ex.duration_sec ?? 40;
      totalSeconds += sets * work + (ex.rest_sec ?? 0) * Math.max(0, sets - 1);
    }
    sections.push({ type, label: SECTION_LABELS[type], exercises });
  }

  return {
    environment: env,
    sections,
    total_minutes: Math.max(1, Math.round(totalSeconds / 60)),
    problems,
  };
}

/** Ortam değiştir: mevcut programı yeni ortam varyantıyla yeniden çözer. */
export function reprogramForEnv(
  problems: PostureProblem[],
  env: "home" | "gym"
): CorrectiveProgram {
  return buildCorrectiveProgram(problems, env);
}

const RISK_WEIGHT: Record<RiskLevel, number> = { low: 6, moderate: 11, high: 18 };

const MOBILITY_PROBLEMS: PostureProblem[] = [
  "forward_head",
  "rounded_shoulders",
  "upper_cross",
  "kyphosis",
  "lordosis",
  "pelvic_tilt",
  "knee_valgus",
  "foot_pronation",
];
const SYMMETRY_PROBLEMS: PostureProblem[] = [
  "shoulder_asymmetry",
  "hip_asymmetry",
  "scoliosis",
];

/** Bulgulardan 4 skoru (0-100) hesaplar. Bulgu yoksa yüksek skorlar. */
export function computeScores(findings: PostureFinding[]): PostureScores {
  let postureP = 0;
  let mobilityP = 0;
  let symmetryP = 0;
  let recoveryP = 0;

  for (const f of findings) {
    const w = RISK_WEIGHT[f.risk] * (f.confidence / 100);
    postureP += w;
    recoveryP += w * 0.7 + f.tight_muscles.length * 1.5;
    if (MOBILITY_PROBLEMS.includes(f.problem)) mobilityP += w * 1.3;
    if (SYMMETRY_PROBLEMS.includes(f.problem)) symmetryP += w * 1.6;
    else symmetryP += w * 0.3;
  }

  return {
    posture: clamp(Math.round(100 - postureP), 25, 100),
    mobility: clamp(Math.round(100 - mobilityP), 25, 100),
    symmetry: clamp(Math.round(100 - symmetryP), 25, 100),
    recovery: clamp(Math.round(100 - recoveryP), 25, 100),
  };
}

/** Kısa Türkçe özet üretir (AI yoksa). */
export function buildSummary(findings: PostureFinding[]): string {
  if (findings.length === 0) {
    return "Belirgin bir postür problemi işareti bulunmadı. Dengeli çalışmaya ve mobiliteye devam et.";
  }
  const top = findings
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map((f) => f.label);
  return `Öne çıkan bulgular: ${top.join(", ")}. Aşağıdaki düzeltici program bu problemleri hedefliyor; haftada 3-4 kez uygula ve 1 hafta sonra tekrar analiz et.`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
