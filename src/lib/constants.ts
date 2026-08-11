import type {
  Goal,
  Experience,
  TrainingEnvironment,
  Gender,
  MealType,
  Difficulty,
  ExerciseCategory,
  AltRelation,
  NutritionGoal,
  ActivityLevel,
  MealSlot,
} from "./database.types";

// Türkçe etiket eşleştirmeleri — UI genelinde tek kaynak.

export const GOAL_LABELS: Record<Goal, string> = {
  lose_weight: "Yağ Yakma",
  gain_muscle: "Kas Kazanma",
  get_fit: "Fit Görünüm",
  improve_endurance: "Kondisyon",
  gain_strength: "Güç",
};

export const GOAL_OPTIONS: { value: Goal; label: string; emoji: string }[] = [
  { value: "gain_muscle", label: "Kas Kazanma", emoji: "💪" },
  { value: "lose_weight", label: "Yağ Yakma", emoji: "🔥" },
  { value: "get_fit", label: "Fit Görünüm", emoji: "✨" },
  { value: "gain_strength", label: "Güç", emoji: "🏋️" },
  { value: "improve_endurance", label: "Kondisyon", emoji: "🏃" },
];

/**
 * Çoklu hedef seçimi (onboarding). Serbest anahtarlar `profiles.goals` text[]
 * içinde saklanır; her biri kalori/makro hesabı için bir Goal enum'una eşlenir.
 * `primary` alanı birincil (ilk seçilen) hedefin enum karşılığıdır.
 */
export const GOAL_MULTI_OPTIONS: { value: string; label: string; emoji: string; primary: Goal }[] = [
  { value: "kas-kazanma", label: "Kas Kazanma", emoji: "💪", primary: "gain_muscle" },
  { value: "yag-yakma", label: "Yağ Yakma", emoji: "🔥", primary: "lose_weight" },
  { value: "fit-gorunum", label: "Fit Görünüm", emoji: "✨", primary: "get_fit" },
  { value: "guc", label: "Güç", emoji: "🏋️", primary: "gain_strength" },
  { value: "kondisyon", label: "Kondisyon", emoji: "🫁", primary: "improve_endurance" },
  { value: "mobilite", label: "Mobilite", emoji: "🤸", primary: "get_fit" },
  { value: "esneklik", label: "Esneklik", emoji: "🧘", primary: "get_fit" },
  { value: "patlayici-kuvvet", label: "Patlayıcı Kuvvet", emoji: "⚡", primary: "gain_strength" },
  { value: "dayaniklilik", label: "Dayanıklılık", emoji: "🏃", primary: "improve_endurance" },
  { value: "postur", label: "Postür Düzeltme", emoji: "🧍", primary: "get_fit" },
  { value: "rehabilitasyon", label: "Rehabilitasyon", emoji: "🩹", primary: "get_fit" },
  { value: "fonksiyonel", label: "Fonksiyonel Fitness", emoji: "🔀", primary: "get_fit" },
  { value: "atletik-performans", label: "Atletik Performans", emoji: "🥇", primary: "improve_endurance" },
  { value: "core", label: "Core Güçlendirme", emoji: "🎯", primary: "gain_strength" },
  { value: "denge", label: "Denge", emoji: "⚖️", primary: "get_fit" },
];
export const MAX_GOALS = 3;

export const WORKOUT_DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 15, label: "15 dk" },
  { value: 30, label: "30 dk" },
  { value: 45, label: "45 dk" },
  { value: 60, label: "60 dk" },
  { value: 90, label: "90 dk+" },
];

export const SMOKING_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "Hiç" },
  { value: "quit", label: "Bıraktım" },
  { value: "occasional", label: "Ara sıra" },
  { value: "regular", label: "Düzenli" },
];

export const EXPERIENCE_LABELS: Record<Experience, string> = {
  beginner: "Başlangıç",
  intermediate: "Orta",
  advanced: "İleri",
  professional: "Profesyonel",
};

export const EXPERIENCE_OPTIONS: { value: Experience; label: string }[] = [
  { value: "beginner", label: "Başlangıç" },
  { value: "intermediate", label: "Orta" },
  { value: "advanced", label: "İleri" },
  { value: "professional", label: "Profesyonel" },
];

export const ENVIRONMENT_LABELS: Record<TrainingEnvironment, string> = {
  gym: "Salon",
  home: "Ev",
  outdoor: "Açık Alan",
  both: "Karma",
};

export const ENVIRONMENT_OPTIONS: {
  value: TrainingEnvironment;
  label: string;
  emoji: string;
}[] = [
  { value: "gym", label: "Salon", emoji: "🏋️" },
  { value: "home", label: "Ev", emoji: "🏠" },
  { value: "outdoor", label: "Açık Alan", emoji: "🌳" },
  { value: "both", label: "Karma", emoji: "🔁" },
];

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Erkek",
  female: "Kadın",
  other: "Belirtmek istemiyorum",
};

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Erkek" },
  { value: "female", label: "Kadın" },
  { value: "other", label: "Diğer" },
];

export const WEEKLY_DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export const INJURY_OPTIONS: { value: string; label: string }[] = [
  { value: "knee", label: "Diz" },
  { value: "lower_back", label: "Bel" },
  { value: "shoulder", label: "Omuz" },
  { value: "wrist", label: "Bilek" },
  { value: "ankle", label: "Ayak bileği" },
  { value: "neck", label: "Boyun" },
  { value: "elbow", label: "Dirsek" },
  { value: "hip", label: "Kalça" },
];

export const EQUIPMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "bodyweight", label: "Vücut Ağırlığı" },
  { value: "dumbbell", label: "Dambıl" },
  { value: "barbell", label: "Barbell" },
  { value: "machine", label: "Makine" },
  { value: "band", label: "Direnç Bandı" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "trx", label: "TRX" },
  { value: "cable", label: "Kablo" },
];

export const INJURY_SIMPLE_OPTIONS: { value: string; label: string }[] = [
  { value: "knee", label: "Diz" },
  { value: "lower_back", label: "Bel" },
  { value: "shoulder", label: "Omuz" },
  { value: "neck", label: "Boyun" },
];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Kahvaltı",
  lunch: "Öğle Yemeği",
  dinner: "Akşam Yemeği",
  snack: "Ara Öğün",
};

export const MEAL_OPTIONS: { value: MealType; label: string; emoji: string }[] = [
  { value: "breakfast", label: "Kahvaltı", emoji: "🍳" },
  { value: "lunch", label: "Öğle", emoji: "🍗" },
  { value: "dinner", label: "Akşam", emoji: "🍽️" },
  { value: "snack", label: "Ara Öğün", emoji: "🥜" },
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: "Başlangıç",
  intermediate: "Orta",
  advanced: "İleri",
};

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  isolation: "İzolasyon",
  compound: "Bileşik",
  functional: "Fonksiyonel",
  mobility: "Mobilizasyon",
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

export const ALT_RELATION_LABELS: Record<AltRelation, string> = {
  alternative: "Alternatif",
  similar: "Benzer",
  home: "Ev Alternatifi",
  gym: "Salon Alternatifi",
};

// Kas grupları (filtre için) — seed ile uyumlu.
export const MUSCLE_GROUPS = [
  "Göğüs",
  "Sırt",
  "Bacak",
  "Omuz",
  "Kol",
  "Karın",
  "Kalça",
  "Kardiyo",
] as const;

export const EQUIPMENT_LABELS: Record<string, string> = {
  bodyweight: "Vücut ağırlığı",
  dumbbell: "Dumbbell",
  barbell: "Barbell",
  kettlebell: "Kettlebell",
  band: "Direnç bandı",
  cable: "Kablo",
  machine: "Makine",
  smith: "Smith Machine",
  trx: "TRX",
  pullup_bar: "Barfiks barı",
};

// ============================================================================
// AI NUTRITION COACH (Sprint 10)
// ============================================================================
export const NUTRITION_GOAL_LABELS: Record<NutritionGoal, string> = {
  gain_muscle: "Kas Kazanma",
  lose_fat: "Yağ Yakma",
  maintain: "Kilo Koruma",
  performance: "Performans Artışı",
  strength: "Güç Artışı",
  endurance: "Kondisyon",
  healthy: "Sağlıklı Yaşam",
};

export const NUTRITION_GOAL_OPTIONS: {
  value: NutritionGoal;
  label: string;
  emoji: string;
}[] = [
  { value: "gain_muscle", label: "Kas Kazanma", emoji: "💪" },
  { value: "lose_fat", label: "Yağ Yakma", emoji: "🔥" },
  { value: "maintain", label: "Kilo Koruma", emoji: "⚖️" },
  { value: "performance", label: "Performans Artışı", emoji: "⚡" },
  { value: "strength", label: "Güç Artışı", emoji: "🏋️" },
  { value: "endurance", label: "Kondisyon", emoji: "🏃" },
  { value: "healthy", label: "Sağlıklı Yaşam", emoji: "🌱" },
];

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Hareketsiz",
  light: "Az Hareketli",
  moderate: "Orta Aktif",
  active: "Aktif",
  athlete: "Çok Aktif / Atlet",
};

export const ACTIVITY_LEVEL_OPTIONS: {
  value: ActivityLevel;
  label: string;
  desc: string;
}[] = [
  { value: "sedentary", label: "Hareketsiz", desc: "Masa başı, az yürüyüş" },
  { value: "light", label: "Az Hareketli", desc: "Haftada 1-2 antrenman" },
  { value: "moderate", label: "Orta Aktif", desc: "Haftada 3-4 antrenman" },
  { value: "active", label: "Aktif", desc: "Haftada 5-6 antrenman" },
  { value: "athlete", label: "Atlet", desc: "Günlük yoğun antrenman" },
];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Kahvaltı",
  snack1: "Ara Öğün",
  lunch: "Öğle",
  snack2: "Ara Öğün",
  dinner: "Akşam",
  supper: "Gece Öğünü",
};

export const MEAL_SLOT_ORDER: MealSlot[] = [
  "breakfast",
  "snack1",
  "lunch",
  "snack2",
  "dinner",
  "supper",
];

export const MEAL_SLOT_EMOJI: Record<MealSlot, string> = {
  breakfast: "🍳",
  snack1: "🍎",
  lunch: "🍽️",
  snack2: "🥜",
  dinner: "🌙",
  supper: "🥛",
};

export const DIETARY_PREFERENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "Fark etmez" },
  { value: "high_protein", label: "Yüksek Protein" },
  { value: "low_carb", label: "Düşük Karbonhidrat" },
  { value: "vegetarian", label: "Vejetaryen" },
  { value: "vegan", label: "Vegan" },
  { value: "keto", label: "Ketojenik" },
  { value: "mediterranean", label: "Akdeniz" },
  { value: "gluten_free", label: "Glutensiz" },
  { value: "lactose_free", label: "Laktozsuz" },
];

export const ALLERGY_OPTIONS: { value: string; label: string }[] = [
  { value: "gluten", label: "Gluten" },
  { value: "lactose", label: "Laktoz" },
  { value: "nuts", label: "Kuruyemiş" },
  { value: "eggs", label: "Yumurta" },
  { value: "seafood", label: "Deniz ürünleri" },
  { value: "soy", label: "Soya" },
];

// Besin & alışveriş kategorileri (Türkçe)
export const FOOD_CATEGORIES = [
  "Et & Tavuk",
  "Balık",
  "Süt Ürünleri",
  "Yumurta",
  "Bakliyat",
  "Tahıllar",
  "Sebze",
  "Meyve",
  "Kuruyemiş",
  "Türk Kahvaltısı",
  "Yemekler",
  "Atıştırmalık",
  "İçecek",
] as const;

export const SHOPPING_CATEGORIES = [
  "Et",
  "Sebze",
  "Meyve",
  "Süt Ürünleri",
  "Bakliyat",
  "Tahıllar",
  "Atıştırmalıklar",
] as const;

export interface SupplementInfo {
  name: string;
  emoji: string;
  what: string;
  when: string;
  note: string;
}

export const SUPPLEMENTS: SupplementInfo[] = [
  {
    name: "Protein Tozu",
    emoji: "🥤",
    what: "Günlük protein hedefini tamamlamaya yardımcı pratik bir kaynaktır.",
    when: "Antrenman sonrası veya protein açığını kapatmak için gün içinde.",
    note: "Öncelik gerçek gıdadır; toz yalnızca hedefe ulaşmayı kolaylaştırır.",
  },
  {
    name: "Kreatin Monohidrat",
    emoji: "⚡",
    what: "Güç ve yüksek şiddetli performans için en çok araştırılan takviyelerden.",
    when: "Günde ~3-5 g, günün herhangi bir saati (tutarlılık önemli).",
    note: "Bol su tüket. Böbrek rahatsızlığın varsa doktoruna danış.",
  },
  {
    name: "Omega-3 (Balık Yağı)",
    emoji: "🐟",
    what: "Kalp-damar ve genel sağlığı destekleyen esansiyel yağ asitleri.",
    when: "Yemekle birlikte günlük.",
    note: "Kan sulandırıcı kullanıyorsan doktoruna danışmadan ekleme.",
  },
  {
    name: "D Vitamini",
    emoji: "☀️",
    what: "Kemik sağlığı ve bağışıklık için; güneş azsa eksikliği yaygındır.",
    when: "Yağlı bir öğünle günlük.",
    note: "Doz için kan değerine göre bir sağlık profesyoneline danışman en doğrusu.",
  },
  {
    name: "Magnezyum",
    emoji: "🌿",
    what: "Kas fonksiyonu, uyku ve toparlanmayı destekler.",
    when: "Akşam / uyku öncesi tercih edilebilir.",
    note: "Fazlası sindirim sorunları yapabilir; etiket dozunu aşma.",
  },
  {
    name: "Elektrolit",
    emoji: "🧂",
    what: "Yoğun terlemede sodyum-potasyum dengesini korur.",
    when: "Uzun/yoğun antrenman sırasında veya sonrasında.",
    note: "Tansiyon rahatsızlığın varsa sodyum alımını doktorunla değerlendir.",
  },
];

export const NUTRITION_DISCLAIMER =
  "Beslenme önerileri eğitim ve genel sağlıklı yaşam amaçlıdır; tıbbi tavsiye veya tanı yerine geçmez. Hamilelik, diyabet, kronik hastalık veya özel bir sağlık durumun varsa bir diyetisyene veya doktora danış.";

/** Uygulama sürümü (about/version ekranı + hata raporları). */
export const APP_VERSION = "1.0.0";
export const APP_NAME = "Viva AI Coach";
