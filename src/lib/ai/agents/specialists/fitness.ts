import { SHARED_PREAMBLE, type SpecialistDefinition } from "./kit";

export const fitnessAgent: SpecialistDefinition = {
  key: "fitness",
  name: "Fitness Koçu",
  description: "Program oluşturma, antrenman analizi, set/tekrar, ilerleme takibi.",

  keywords: [
    "antrenman", "program", "egzersiz", "hareket", "set", "tekrar", "rep",
    "kilo ver", "kas yap", "kas kazan", "hacim", "ağırlık", "squat", "bench",
    "deadlift", "şınav", "mekik", "koşu", "kardiyo", "hiit", "split",
    "push pull", "full body", "ısınma", "spor", "salon", "gym", "dambıl",
    "barfiks", "pr ", "rekor", "ilerleme", "gelişim", "form tut", "kütle",
    // Vücut bölgeleri: "bugün bacak günü", "göğüs çalışayım mı" gibi cümleler
    // yukarıdaki köklerin hiçbirini tutturmuyordu ve fitness ajanı devre dışı
    // kalıyordu. Fizyoterapistle örtüşen bölgeler (omuz, sırt) sorun değil —
    // iki uzmanın birden devreye girmesi zaten istenen davranış.
    "bacak", "göğüs", "sırt", "omuz", "kol", "karın", "kalça", "biceps",
    "triceps", "quadriceps", "hamstring", "kalistenik", "vücut ağırlığı",
  ],
  strongKeywords: ["program yaz", "program oluştur", "antrenman planı", "kaç set", "kaç tekrar"],

  // Uzun süredir antrenman yoksa kullanıcı sormasa da devreye girsin.
  signal: (s) => {
    if (s.daysSinceWorkout === null) return 0.35;      // hiç antrenmanı yok
    if (s.daysSinceWorkout >= 5) return 0.45;
    if (s.daysSinceWorkout >= 3) return 0.2;
    return 0;
  },

  defaults: {
    temperature: 0.5,
    maxTokens: 550,
    memoryLayers: ["session", "longterm", "profile", "workout", "goals"],
    allowedTools: [
      "get_workout_history", "suggest_exercises", "get_goal_progress",
      "schedule_workout", "adjust_program_intensity", "set_goal", "remember_fact",
    ],
    memoryLimit: 5000,
    sortOrder: 20,
  },

  prompt: `${SHARED_PREAMBLE}

UZMANLIK ALANIN: Antrenman bilimi ve program tasarımı.

Sorumlulukların:
• Program oluşturma ve düzenleme (bölünme, sıklık, hacim, ilerleme)
• Set, tekrar, tempo, dinlenme süresi önerileri
• Antrenman geçmişi analizi: hacim trendi, kas grubu dengesi, durağanlık
• Aşırı yüklenme ilkesine göre ilerleme planı
• Hareket seçimi — SADECE kütüphanede olan hareketleri öner, isim UYDURMA

Çalışma biçimin:
• Somut sayı ver: "3x8-10, 90 sn dinlenme" gibi. "Biraz daha ağır çalış" deme.
• Öneriden önce kullanıcının gerçek geçmişine bak; aracı çağır.
• Kullanıcının ekipmanına ve antrenman ortamına uymayan hareket önerme.
• SAKATLIK varsa o bölgeyi zorlayan hareketi ELE ve yerine alternatif ver.
  Sakatlığın tıbbi yorumunu YAPMA — o fizyoterapistin işi.
• Toparlanma skoru düşükse hacmi kendiliğinden artırma.`,
};
