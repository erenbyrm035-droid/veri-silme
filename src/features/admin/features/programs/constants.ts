import type {
  ProgramLevel,
  ProgramGender,
  ProgramEnvironment,
  ProgramBlockType,
  ProgramRelationType,
} from "@/lib/database.types";

export const PROGRAMS_PAGE_SIZE = 20;

export const LEVEL_LABELS: Record<ProgramLevel, string> = {
  beginner: "Başlangıç",
  intermediate: "Orta",
  advanced: "İleri",
};
export const LEVEL_VALUES = Object.keys(LEVEL_LABELS) as ProgramLevel[];

export const GENDER_LABELS: Record<ProgramGender, string> = {
  male: "Erkek",
  female: "Kadın",
  both: "Herkes",
};
export const GENDER_VALUES = Object.keys(GENDER_LABELS) as ProgramGender[];

export const ENV_LABELS: Record<ProgramEnvironment, string> = {
  home: "Ev",
  gym: "Spor Salonu",
  both: "Her İkisi",
};
export const ENV_VALUES = Object.keys(ENV_LABELS) as ProgramEnvironment[];

export const BLOCK_LABELS: Record<ProgramBlockType, string> = {
  normal: "Normal",
  superset: "Superset",
  dropset: "Dropset",
  circuit: "Circuit",
  emom: "EMOM",
  amrap: "AMRAP",
  tabata: "Tabata",
};
export const BLOCK_VALUES = Object.keys(BLOCK_LABELS) as ProgramBlockType[];

export const RELATION_LABELS: Record<ProgramRelationType, string> = {
  similar: "Benzer Program",
  alternative: "Alternatif Program",
  next: "Sonraki Program",
  previous: "Önceki Program",
};
export const RELATION_VALUES = Object.keys(RELATION_LABELS) as ProgramRelationType[];

/** Kategori/hedef arama kolaylığı için sabit kategori sözlüğü (DB ile senkron). */
export const CATEGORY_FALLBACK: { slug: string; name: string }[] = [
  { slug: "weight_loss", name: "Kilo Verme" },
  { slug: "muscle_gain", name: "Kas Kazanma" },
  { slug: "fat_burn", name: "Yağ Yakımı" },
  { slug: "strength", name: "Güç" },
  { slug: "functional", name: "Fonksiyonel" },
  { slug: "crossfit", name: "CrossFit" },
  { slug: "powerlifting", name: "Powerlifting" },
  { slug: "bodybuilding", name: "Bodybuilding" },
  { slug: "hiit", name: "HIIT" },
  { slug: "calisthenics", name: "Calisthenics" },
];

export type ProgramSort = "updated_desc" | "updated_asc" | "name_asc" | "name_desc" | "rating_desc" | "popular";
export const SORT_OPTIONS: { value: ProgramSort; label: string }[] = [
  { value: "updated_desc", label: "Son güncellenen" },
  { value: "updated_asc", label: "En eski güncelleme" },
  { value: "name_asc", label: "İsim A-Z" },
  { value: "name_desc", label: "İsim Z-A" },
  { value: "rating_desc", label: "En yüksek puan" },
  { value: "popular", label: "En popüler" },
];

export function slugify(input: string): string {
  const map: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
    Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u",
  };
  return input
    .split("").map((ch) => map[ch] ?? ch).join("")
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
