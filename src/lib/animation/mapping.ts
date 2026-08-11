// ============================================================================
// Animasyon eşleme motoru.
// Bir egzersizin adından yeniden kullanılabilir animasyon anahtarını çözer.
// DB'de animation_mapping kaydı yoksa bu statik kurallar devreye girer.
// Örn: "Eğik Bench Press" / "Decline Bench Press" → bench_press
//      "Machine Chest Press" → bench_press_machine
// Client + server tarafında güvenle kullanılır (server-only bağımlılığı yok).
// ============================================================================

interface Rule {
  key: string;
  match: (s: string) => boolean;
}

const has = (s: string, ...tokens: string[]) => tokens.every((t) => s.includes(t));
const any = (s: string, ...tokens: string[]) => tokens.some((t) => s.includes(t));

// Sıra ÖNEMLİ — özel kurallar önce gelir.
const RULES: Rule[] = [
  { key: "bench_press_machine", match: (s) => has(s, "machine", "chest") || has(s, "pec deck") },
  { key: "push_up", match: (s) => any(s, "push-up", "push up", "sinav") },
  { key: "bench_press", match: (s) => has(s, "bench", "press") || has(s, "chest", "press") || any(s, "chest fly", "cable crossover", "pullover") },
  { key: "lat_pulldown", match: (s) => any(s, "pulldown") },
  { key: "pull_up", match: (s) => any(s, "pull-up", "pull up", "chin-up", "chin up", "barfiks", "muscle-up") },
  { key: "row", match: (s) => s.includes("row") },
  { key: "deadlift", match: (s) => s.includes("deadlift") },
  { key: "shoulder_press", match: (s) => has(s, "shoulder", "press") || any(s, "overhead press", "arnold", "push press", "landmine press", "log press") },
  { key: "lateral_raise", match: (s) => any(s, "lateral raise", "front raise", "rear delt", "upright row") },
  { key: "triceps_extension", match: (s) => any(s, "triceps", "pushdown", "skullcrusher", "kickback") },
  { key: "biceps_curl", match: (s) => s.includes("curl") },
  { key: "leg_press", match: (s) => any(s, "leg press", "hack squat") },
  { key: "squat", match: (s) => s.includes("squat") },
  { key: "lunge", match: (s) => any(s, "lunge", "split squat", "step-up", "step up") },
  { key: "hip_thrust", match: (s) => any(s, "hip thrust", "glute bridge", "pull-through", "kickback") },
  { key: "calf_raise", match: (s) => s.includes("calf") },
  { key: "plank", match: (s) => any(s, "plank", "hollow", "bird dog", "dead bug", "bear crawl") },
  { key: "crunch", match: (s) => any(s, "crunch", "sit-up", "sit up", "leg raise", "russian twist", "mekik") },
];

/** Egzersiz adından animasyon anahtarını çözer. Eşleşme yoksa 'generic_idle'. */
export function resolveAnimationKey(name: string, englishName?: string | null): string {
  const s = `${englishName ?? ""} ${name}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.match(s)) return rule.key;
  }
  return "generic_idle";
}
