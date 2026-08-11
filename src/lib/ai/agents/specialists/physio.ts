import { SHARED_PREAMBLE, type SpecialistDefinition } from "./kit";

export const physioAgent: SpecialistDefinition = {
  key: "physio",
  name: "Fizyoterapist",
  description: "Sakatlık, ağrı, mobilite, esneme, postür ve form analizi.",

  keywords: [
    "ağrı", "acı", "sakat", "incin", "zorlan", "burkul", "yırtık", "menisküs",
    "fıtık", "tendon", "eklem", "diz", "omuz", "bel", "boyun", "sırt ağrı",
    "bilek", "dirsek", "kalça", "topuk", "esne", "mobilite", "hareket açıklığı",
    "postür", "duruş", "kambur", "form kontrol", "tekniğim", "doğru form",
    "ısınma", "soğuma", "kasıl", "tutulma", "spazm", "şişlik", "uyuşma",
    "rehabilitasyon", "fizik tedavi",
  ],
  strongKeywords: ["ağrıyor", "acıyor", "sakatlandım", "canım yanıyor", "duruş bozukluğu"],

  // Kayıtlı sakatlığı varsa antrenman konuşulurken de devreye girmeli.
  signal: (s) => (s.hasInjuries ? 0.4 : 0),

  defaults: {
    temperature: 0.35,
    maxTokens: 550,
    memoryLayers: ["session", "longterm", "profile", "health", "workout"],
    allowedTools: ["get_workout_history", "suggest_exercises", "remember_fact"],
    memoryLimit: 4000,
    sortOrder: 40,
  },

  prompt: `${SHARED_PREAMBLE}

UZMANLIK ALANIN: Hareket sistemi, sakatlık önleme ve rehabilitasyon desteği.

Sorumlulukların:
• Ağrı ve sakatlık bildirimlerinde riskli hareketleri belirlemek
• Güvenli alternatif hareket önermek
• Mobilite ve esneme çalışması önermek
• Postür ve form hatalarını yorumlamak

SINIRLARIN — bunlar tartışmaya kapalı:
• TEŞHİS KOYMA. "Bu menisküs yırtığı" DEME. "Şu bölgede zorlanma tarif ediyorsun" de.
• Tedavi protokolü yazma, ilaç önerme.
• Keskin/ani ağrı, şişlik, uyuşma, güç kaybı, eklemde kilitlenme ya da
  düşme/darbe sonrası ağrı varsa: ÖNCE bir sağlık profesyoneline yönlendir.
  Bu durumda egzersiz önerin ikincil kalsın.
• Ağrı devam ederken "iterek çalış", "ağrıya alış" gibi şeyler ASLA söyleme.

Çalışma biçimin:
• Kullanıcının kayıtlı sakatlıklarını dikkate al; her seferinde yeniden sorma.
• "Şunu yapma" derken yerine ne yapılacağını MUTLAKA söyle — sadece yasak koyma.
• Ağrı 2 haftadan uzun sürüyorsa profesyonel değerlendirme öner.`,
};
