import { SHARED_PREAMBLE, type SpecialistDefinition } from "./kit";

export const recoveryAgent: SpecialistDefinition = {
  key: "recovery",
  name: "Toparlanma Uzmanı",
  description: "Uyku, HRV, yorgunluk, dinlenme, aşırı antrenman ve toparlanma skoru.",

  keywords: [
    "uyku", "uyuya", "uykusuz", "yorgun", "bitkin", "halsiz", "enerjim yok",
    "dinlen", "mola", "ara ver", "toparlan", "recovery", "hrv", "nabız",
    "istirahat", "overtrain", "aşırı antrenman", "kas ağrısı", "doms",
    "tükenmiş", "performansım düştü", "gerileme", "yenilenme", "deload",
    "izin günü", "off gün",
  ],
  strongKeywords: ["çok yorgunum", "uyuyamıyorum", "dinlenmeli miyim", "ara vermeli"],

  // Toparlanma skoru düşükse kullanıcı sormasa bile en önemli uzman budur.
  signal: (s) => {
    if (s.recovery !== null && s.recovery < 35) return 0.7;
    if (s.recovery !== null && s.recovery < 50) return 0.45;
    if (s.readiness !== null && s.readiness < 40) return 0.35;
    return 0;
  },

  defaults: {
    temperature: 0.35,
    maxTokens: 450,
    memoryLayers: ["session", "profile", "health", "workout"],
    allowedTools: [
      "get_workout_history", "add_rest_day",
      "adjust_program_intensity", "remember_fact",
    ],
    memoryLimit: 4000,
    sortOrder: 50,
  },

  prompt: `${SHARED_PREAMBLE}

UZMANLIK ALANIN: Toparlanma, uyku ve yüklenme yönetimi.

Sorumlulukların:
• Toparlanma ve hazır olma skorunu yorumlamak
• Uyku süresi/kalitesi ile performans ilişkisini kurmak
• Aşırı antrenman belirtilerini tanımak (performans düşüşü, sürekli yorgunluk,
  uyku bozulması, motivasyon kaybı, dinlenme nabzının yükselmesi)
• Dinlenme günü ve deload haftası önermek
• Antrenman yoğunluğunun düşürülmesi gerektiğini söylemek

Çalışma biçimin:
• Skoru olduğu gibi kullan; "toparlanma skorun 38/100" gibi. Rakamı değiştirme.
• Uyku ya da adım verisi yoksa uydurma — "bu veriyi girmemişsin" de.
• Toparlanma düşükken ağır antrenman önerisini AÇIKÇA reddet. Bu konuda
  fitness koçunun önerisini geçersiz kılma yetkin var; net konuş.
• Dinlenme önerirken suçlayıcı olma — dinlenme antrenmanın parçasıdır, ceza değil.
• Uykusuzluk sürekliyse ve yaşam düzeniyle açıklanmıyorsa hekime yönlendir.`,
};
