import { z } from "zod";

// ============================================================================
// Profil güncelleme doğrulaması.
//
// NEDEN ÖNEMLİ: bu alanlar yalnızca ekranda görünmüyor — `calcMacroTargets`
// doğrudan boy/kilo/yaş/aktivite üzerinden günlük kalori ve makro hedefi
// üretiyor (`profile/actions.ts` → recalcMacros). Aralık kontrolü olmadan
// `height_cm: 99999` gibi bir değer kullanıcıya saçma bir kalori hedefi
// yazdırırdı ve bu, uygulamanın her yerinde (beslenme, diyetisyen, koç)
// yanlış öneriye dönüşürdü.
//
// Metin alanlarında üst sınır var çünkü kolonlar `text` — sınırsız. Sunucu
// action'ları dışarıdan doğrudan POST edilebildiği için arayüzdeki maxlength
// koruma sayılmaz.
//
// Desen `features/admin/**/schema.ts` ile aynı; yeni bir kalıp icat edilmedi.
// ============================================================================

/** Boş string'i null'a çeviren yardımcı — form alanları boşaltılabilmeli. */
const bosNull = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform((v) => (v === "" ? null : v));

/** Sayısal alan: makul aralık dışı reddedilir, boş bırakılabilir. */
const sayi = (min: number, max: number) =>
  z.coerce.number().min(min).max(max).nullable().optional();

const strListe = (maxAdet: number, maxUzunluk = 120) =>
  z.array(z.string().trim().min(1).max(maxUzunluk)).max(maxAdet).optional();

export const profileUpdateSchema = z
  .object({
    full_name: z.string().trim().min(1).max(120).optional(),
    bio: bosNull(500),
    // ISO tarih; yaş buradan türetiliyor.
    birth_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG olmalı").nullable().optional(),
    gender: z.enum(["male", "female", "other"]).nullable().optional(),

    // --- Makro hesabına giren alanlar: aralıklar bilerek dar ---------------
    height_cm: sayi(80, 260),
    weight_kg: sayi(25, 400),
    target_weight_kg: sayi(25, 400),
    body_fat_pct: sayi(2, 70),
    activity_level: z.enum(["sedentary", "light", "moderate", "active", "athlete"]).nullable().optional(),
    weekly_training_days: sayi(0, 7),
    nutrition_goal: z
      .enum(["gain_muscle", "lose_fat", "maintain", "performance", "strength", "endurance", "healthy"])
      .nullable().optional(),

    occupation: bosNull(120),
    goals: strListe(10),
    experience: z.enum(["beginner", "intermediate", "advanced", "professional"]).nullable().optional(),
    training_environment: z.enum(["home", "gym", "both", "outdoor"]).nullable().optional(),
    available_equipment: strListe(50),
    preferred_workout_duration: sayi(5, 300),

    // Hedefler el ile de girilebiliyor; tavanlar fizyolojik olarak anlamsız
    // değerleri (ör. 100000 kcal) engellemek için.
    daily_calorie_goal: sayi(500, 10_000),
    daily_protein_goal: sayi(0, 1000),
    daily_carb_goal: sayi(0, 2000),
    daily_fat_goal: sayi(0, 1000),
    daily_water_goal_ml: sayi(0, 20_000),

    injuries: strListe(30),
    health_conditions: strListe(30),
    allergies: strListe(30),
    health_notes: bosNull(2000),

    daily_sitting_hours: sayi(0, 24),
    sleep_hours: sayi(0, 24),
    water_intake_ml: sayi(0, 20_000),
    // Kolon serbest metin (database.types: string | null) — enum'a daraltmak
    // mevcut kayıtları reddederdi; yalnızca uzunluk sınırı.
    smoking_status: bosNull(40),

    recalcMacros: z.boolean().optional(),
  })
  // Bilinmeyen alan reddedilir: profiles tablosuna form dışı bir kolon
  // (ör. is_premium) yazılmaya çalışılırsa istek burada durur.
  .strict();

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/**
 * Hata mesajında kolon adı yerine kullanıcının tanıdığı etiket.
 *
 * Form tüm alanları önceden doldurup geri gönderiyor; eski bir kayıtta
 * aralık dışı bir değer varsa (ör. boy 0) kullanıcı sadece biyografisini
 * düzenlemek isterken hata alır. O yüzden hangi alanın sorunlu olduğu
 * anlaşılır yazılmalı.
 */
const ALAN_ETIKET: Record<string, string> = {
  full_name: "Ad soyad", bio: "Biyografi", birth_date: "Doğum tarihi",
  gender: "Cinsiyet", height_cm: "Boy", weight_kg: "Kilo",
  target_weight_kg: "Hedef kilo", body_fat_pct: "Yağ oranı",
  activity_level: "Aktivite düzeyi", occupation: "Meslek", goals: "Hedefler",
  experience: "Deneyim", training_environment: "Antrenman ortamı",
  available_equipment: "Ekipman", preferred_workout_duration: "Antrenman süresi",
  weekly_training_days: "Haftalık gün", nutrition_goal: "Beslenme hedefi",
  daily_calorie_goal: "Kalori hedefi", daily_protein_goal: "Protein hedefi",
  daily_carb_goal: "Karbonhidrat hedefi", daily_fat_goal: "Yağ hedefi",
  daily_water_goal_ml: "Su hedefi", injuries: "Sakatlıklar",
  health_conditions: "Sağlık durumu", allergies: "Alerjiler",
  health_notes: "Sağlık notları", daily_sitting_hours: "Oturma süresi",
  sleep_hours: "Uyku", water_intake_ml: "Su tüketimi", smoking_status: "Sigara",
};

export function alanEtiketi(path: (string | number)[]): string {
  const k = String(path[0] ?? "");
  return ALAN_ETIKET[k] ?? k;
}

/**
 * Avatar adresi — ya geçerli bir http(s) adresi ya da temizleme için null.
 *
 * PROTOKOL KONTROLÜ ŞART: `z.string().url()` tek başına `javascript:alert(1)`
 * gibi değerleri GEÇİRİYOR (WHATWG'ye göre geçerli bir URL). Bu değer
 * kullanıcının avatarı olarak saklanıp arayüzde bir bağlantıya girerse
 * tıklanabilir bir betiğe dönüşür. Yalnızca http/https kabul ediliyor.
 */
export const avatarSchema = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((u) => /^https?:\/\//i.test(u), "Adres http(s) olmalı")
  .nullable();
