import type {
  ExerciseCategory,
  Difficulty,
  ExerciseStatus,
  ExerciseRelationType,
} from "@/lib/database.types";

export const EXERCISES_PAGE_SIZE = 20;

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  isolation: "İzole",
  compound: "Compound",
  functional: "Fonksiyonel",
  mobility: "Mobilite",
  stretch: "Esneme",
  rehab: "Rehabilitasyon",
  activation: "Aktivasyon",
  warmup: "Isınma",
  cooldown: "Soğuma",
  cardio: "Kardiyo",
  plyometric: "Plyometrik",
  core: "Core",
  balance: "Denge",
  stabilization: "Stabilizasyon",
};

export const CATEGORY_VALUES = Object.keys(CATEGORY_LABELS) as ExerciseCategory[];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: "Başlangıç",
  intermediate: "Orta",
  advanced: "İleri",
};
export const DIFFICULTY_VALUES = Object.keys(DIFFICULTY_LABELS) as Difficulty[];

export const STATUS_LABELS: Record<ExerciseStatus, string> = {
  published: "Yayında",
  draft: "Taslak",
};

export const RELATION_LABELS: Record<ExerciseRelationType, string> = {
  alternative: "Alternatif",
  easier: "Daha Kolay",
  harder: "Daha Zor",
  same_muscle: "Aynı Kas Grubu",
  same_pattern: "Aynı Hareket Paterni",
  same_equipment: "Aynı Ekipman",
};
export const RELATION_VALUES = Object.keys(RELATION_LABELS) as ExerciseRelationType[];

export const MOVEMENT_PATTERNS = [
  "push",
  "pull",
  "squat",
  "hinge",
  "lunge",
  "carry",
  "rotation",
  "gait",
  "isometric",
] as const;

export type ExerciseSort =
  | "updated_desc"
  | "updated_asc"
  | "name_asc"
  | "name_desc"
  | "created_desc";

export const SORT_OPTIONS: { value: ExerciseSort; label: string }[] = [
  { value: "updated_desc", label: "Son güncellenen" },
  { value: "updated_asc", label: "En eski güncelleme" },
  { value: "name_asc", label: "İsim A-Z" },
  { value: "name_desc", label: "İsim Z-A" },
  { value: "created_desc", label: "En yeni eklenen" },
];

/** GIF eşleştirme + slug için Türkçe karakter dönüşümlü slugify. */
export function slugify(input: string): string {
  const map: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
    Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u",
  };
  return input
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
