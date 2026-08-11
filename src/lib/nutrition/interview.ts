// ============================================================================
// AI Diyetisyen V3 — Görüşme motoru (interview).
// Sorular kodda tanımlı (deterministik, tek tek), akıllı hafıza ile bilinen
// bilgiler atlanır. AI yalnızca analiz + plan üretiminde devreye girer.
// Bu dosya hem client hem server tarafından kullanılır (server-only YOK).
// ============================================================================

export type QuestionKind = "choice" | "multi" | "number" | "text" | "boolean";

export interface QuestionOption {
  value: string;
  label: string;
}

export interface InterviewQuestion {
  id: string;
  /** Diyetisyenin sıcak, sohbet dilinde sorusu. */
  prompt: string;
  /** Sorunun neden sorulduğu (küçük yardımcı metin). */
  why?: string;
  kind: QuestionKind;
  options?: QuestionOption[];
  /** number için birim (kg, cm, yaş...). */
  unit?: string;
  placeholder?: string;
  /** Serbest metin/çoklu seçimde "boş geçilebilir" mi? */
  optional?: boolean;
  min?: number;
  max?: number;
}

// answers içinde tutulan tüm anahtarlar.
export type InterviewAnswers = Record<string, string | number | string[] | boolean | null>;

// ---------------------------------------------------------------------------
// 25 SORU — gerçek bir spor diyetisyeni görüşmesi akışı
// ---------------------------------------------------------------------------
export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: "goal",
    prompt: "Öncelikle en önemlisi: şu an temel hedefin ne?",
    why: "Tüm planın kalori ve makro dengesi buna göre kurulur.",
    kind: "choice",
    options: [
      { value: "gain_muscle", label: "Kas kazanmak" },
      { value: "lose_fat", label: "Yağ yakmak" },
      { value: "gain_weight", label: "Kilo almak" },
      { value: "lose_weight", label: "Kilo vermek" },
      { value: "maintain", label: "Formu korumak" },
    ],
  },
  { id: "height_cm", prompt: "Boyun kaç cm?", why: "Enerji ihtiyacını hesaplamak için gerekli.", kind: "number", unit: "cm", min: 120, max: 230, placeholder: "175" },
  { id: "weight_kg", prompt: "Peki kaç kilosun?", why: "Kalori ve protein hedefin buna göre belirlenir.", kind: "number", unit: "kg", min: 35, max: 250, placeholder: "72" },
  { id: "age", prompt: "Yaşın kaç?", why: "Metabolizma hızı yaşla değişir.", kind: "number", unit: "yaş", min: 14, max: 90, placeholder: "27" },
  {
    id: "gender", prompt: "Cinsiyetin?", why: "Bazal metabolizma hesabı için.", kind: "choice",
    options: [{ value: "male", label: "Erkek" }, { value: "female", label: "Kadın" }],
  },
  { id: "training_days", prompt: "Haftada kaç gün spor yapıyorsun?", why: "Aktivite seviyeni ve dinlenme günü beslenmeni ayarlarım.", kind: "number", unit: "gün", min: 0, max: 7, placeholder: "4" },
  {
    id: "training_time", prompt: "Antrenmanların genelde günün hangi saatinde?", why: "Antrenman öncesi/sonrası öğünleri doğru zamanlarım.", kind: "choice",
    options: [
      { value: "morning", label: "Sabah" }, { value: "noon", label: "Öğlen" },
      { value: "evening", label: "Akşam" }, { value: "none", label: "Sabit değil / yapmıyorum" },
    ],
  },
  { id: "wake_time", prompt: "Sabah genelde kaçta uyanıyorsun?", why: "Öğün saatlerini günlük ritmine oturtmak için.", kind: "text", placeholder: "07:30" },
  { id: "sleep_time", prompt: "Gece kaçta uyuyorsun?", why: "Son öğün ve gece atıştırması planı için.", kind: "text", placeholder: "23:30" },
  {
    id: "meals_per_day", prompt: "Günde kaç öğün yemeyi tercih edersin?", why: "Planı öğün sayına göre bölerim.", kind: "choice",
    options: [
      { value: "3", label: "3 öğün" }, { value: "4", label: "4 öğün" },
      { value: "5", label: "5 öğün" }, { value: "6", label: "6 öğün" },
    ],
  },
  {
    id: "breakfast", prompt: "Kahvaltı yapar mısın?", why: "Bazı kişiler sabah aç kalmayı tercih eder; ona göre kurgularım.", kind: "choice",
    options: [{ value: "yes", label: "Evet, her sabah" }, { value: "sometimes", label: "Bazen" }, { value: "no", label: "Genelde atlıyorum" }],
  },
  { id: "favorites", prompt: "En sevdiğin yiyecekler neler? (birkaç tane yaz)", why: "Planı sevdiğin tatlar üzerine kurarsam sürdürebilirsin.", kind: "text", optional: true, placeholder: "tavuk, makarna, yoğurt…" },
  { id: "dislikes", prompt: "Hiç sevmediğin, ‘bunu koyma’ dediğin yiyecekler?", why: "Bunları plana asla koymam.", kind: "text", optional: true, placeholder: "karnabahar, ciğer…" },
  { id: "allergies", prompt: "Gıda alerjin var mı? Varsa yaz.", why: "Güvenlik için alerjenleri tamamen dışlarım.", kind: "text", optional: true, placeholder: "yoksa boş bırak" },
  {
    id: "intolerances", prompt: "Aşağıdakilerden sende olan var mı?", why: "İntoleransları plandan çıkarırım.", kind: "multi",
    options: [
      { value: "lactose", label: "Laktoz" }, { value: "gluten", label: "Gluten" },
      { value: "nuts", label: "Fındık/ceviz" }, { value: "peanut", label: "Yer fıstığı" },
      { value: "shellfish", label: "Kabuklu deniz ürünleri" }, { value: "egg", label: "Yumurta" },
    ],
    optional: true,
  },
  { id: "conditions", prompt: "Bilmem gereken bir sağlık durumun var mı? (diyabet, tansiyon vb.)", why: "Beslenmeyi buna göre daha dikkatli kurgular, gerekirse doktoruna yönlendiririm.", kind: "text", optional: true, placeholder: "yoksa boş bırak" },
  {
    id: "supplements", prompt: "Şu an kullandığın takviye var mı?", why: "Planı takviyelerinle uyumlu hale getiririm.", kind: "multi",
    options: [
      { value: "protein", label: "Protein tozu" }, { value: "creatine", label: "Kreatin" },
      { value: "omega3", label: "Omega 3" }, { value: "vitamin", label: "Vitamin/mineral" },
      { value: "none", label: "Hiçbiri" },
    ],
    optional: true,
  },
  {
    id: "budget", prompt: "Günlük yemek bütçen yaklaşık ne kadar?", why: "Önerileri bütçene uygun ürünlerden seçerim.", kind: "choice",
    options: [
      { value: "100", label: "~100 TL" }, { value: "250", label: "~250 TL" },
      { value: "500", label: "~500 TL" }, { value: "free", label: "Serbest" },
    ],
  },
  {
    id: "cooking", prompt: "Yemeği evde mi yapıyorsun, dışarıdan mı?", why: "Pratik tarifler mi yoksa dışarıda seçim rehberi mi vereceğimi belirler.", kind: "choice",
    options: [
      { value: "home", label: "Evde yaparım" }, { value: "mixed", label: "Karışık" }, { value: "out", label: "Çoğunlukla dışarıdan" },
    ],
  },
  {
    id: "pantry", prompt: "Evde sürekli bulunan malzemeler neler?", why: "Planı elindeki malzemeler üzerine kurarım, israf olmaz.", kind: "multi",
    options: [
      { value: "chicken", label: "Tavuk" }, { value: "rice", label: "Pirinç" }, { value: "oats", label: "Yulaf" },
      { value: "yogurt", label: "Yoğurt" }, { value: "egg", label: "Yumurta" }, { value: "tuna", label: "Ton balığı" },
      { value: "veggies", label: "Sebze" }, { value: "legumes", label: "Kuru baklagil" }, { value: "pasta", label: "Makarna" },
    ],
    optional: true,
  },
  { id: "water_l", prompt: "Günde kaç litre su içiyorsun?", why: "Hidrasyon hedefini ve tuz dengesini ayarlarım.", kind: "number", unit: "litre", min: 0, max: 8, placeholder: "2" },
  { id: "sitting_hours", prompt: "Günde kaç saat oturarak vakit geçiriyorsun?", why: "Gerçek aktivite seviyeni doğru hesaplamak için.", kind: "number", unit: "saat", min: 0, max: 16, placeholder: "8" },
  { id: "occupation", prompt: "Ne iş yapıyorsun?", why: "Günlük hareketliliğin ve öğün düzenin işine göre değişir.", kind: "text", optional: true, placeholder: "ör. ofis, sağlık, esnaf…" },
  {
    id: "weekend_diff", prompt: "Hafta sonları beslenmen değişir mi?", why: "Hafta sonu için daha esnek bir düzen kurabilirim.", kind: "choice",
    options: [{ value: "yes", label: "Evet, farklı olur" }, { value: "no", label: "Hayır, aynı" }],
  },
  {
    id: "cheat", prompt: "Cheat meal (serbest öğün) ister misin?", why: "Sürdürülebilirlik için plana esneklik eklerim.", kind: "choice",
    options: [{ value: "1", label: "Haftada 1" }, { value: "2", label: "Haftada 2" }, { value: "0", label: "İstemem" }],
  },
];

export const TOTAL_QUESTIONS = INTERVIEW_QUESTIONS.length;

/** Bir cevabın "dolu" sayılıp sayılmadığı. */
export function isAnswered(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return !Number.isNaN(v);
  if (typeof v === "boolean") return true;
  return false;
}

/**
 * Sıradaki cevaplanmamış soruyu döndürür. Optional sorular boş bırakılmışsa
 * "cevaplandı" işaretiyle atlanabilmesi için answers[id] anahtarı set edilir
 * (boş string/dizi de olsa). Yani answers'ta anahtar varsa soru sorulmaz.
 */
export function nextQuestion(answers: InterviewAnswers): InterviewQuestion | null {
  for (const q of INTERVIEW_QUESTIONS) {
    const has = Object.prototype.hasOwnProperty.call(answers, q.id);
    if (!has) return q;
  }
  return null;
}

/** Cevaplanan soru sayısı (ilerleme çubuğu için). */
export function answeredCount(answers: InterviewAnswers): number {
  return INTERVIEW_QUESTIONS.filter((q) => Object.prototype.hasOwnProperty.call(answers, q.id)).length;
}

export const GOAL_LABEL: Record<string, string> = {
  gain_muscle: "Kas kazanmak", lose_fat: "Yağ yakmak", gain_weight: "Kilo almak",
  lose_weight: "Kilo vermek", maintain: "Formu korumak",
};

// ---------------------------------------------------------------------------
// PLAN tipleri (AI JSON çıktısı ile birebir; frontend kartları buradan çizer)
// ---------------------------------------------------------------------------
export interface DietMeal {
  slot: string;          // Kahvaltı / Ara Öğün / Öğle / Akşam ...
  name: string;          // Yemek adı
  grams: string;         // Gramaj/porsiyon açıklaması (ör. "150 g tavuk + 1 kase pirinç")
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prep_min: number;      // Hazırlama süresi (dk)
  recipe: string;        // Kısa tarif (düz metin)
  alternatives: string[]; // Alternatif öneriler
}

export interface DietDay {
  day: number;
  meals: DietMeal[];
}

export interface ShoppingGroup {
  category: string;
  items: string[];
}

export interface DietTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DietPlan {
  span: number;            // 7 | 14 | 30
  analysis: string;        // diyetisyenin analizi (düz metin)
  days: DietDay[];
  shopping: ShoppingGroup[];
  targets: DietTargets;
  created_at?: string;
}
