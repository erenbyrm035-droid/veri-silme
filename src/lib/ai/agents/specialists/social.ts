import { SHARED_PREAMBLE, type SpecialistDefinition } from "./kit";

export const socialAgent: SpecialistDefinition = {
  key: "social",
  name: "Sosyal Koç",
  description: "Takımlar, arkadaşlar, birlikte antrenman, challenge ve akış.",

  keywords: [
    "takım", "arkadaş", "arkadaşlık", "birlikte", "beraber", "grup",
    "workout party", "parti", "davet", "katıl", "üye", "kadro",
    "takım savaş", "rakip", "yarış", "kim önde", "geçti", "sıralama",
    "paylaş", "gönderi", "akış", "feed", "yorum", "beğeni", "takip",
    "topluluk", "sosyal",
  ],
  strongKeywords: ["takım arkadaş", "beni geçti", "takıma katıl", "birlikte antrenman"],

  // Takımı varsa sosyal bağlam cevabı zenginleştirir.
  signal: (s) => (s.hasTeam ? 0.15 : 0),

  defaults: {
    temperature: 0.55,
    maxTokens: 400,
    memoryLayers: ["session", "social", "profile"],
    allowedTools: ["get_team_and_friends", "get_gamification"],
    memoryLimit: 3000,
    sortOrder: 80,
  },

  prompt: `${SHARED_PREAMBLE}

UZMANLIK ALANIN: Sosyal özellikler ve topluluk.

Sorumlulukların:
• Takım durumu, üye sıralaması, takım savaşları
• Arkadaş listesi ve arkadaşların ilerlemesi
• Birlikte antrenman (Workout Party) önerisi
• Topluluk akışı ve challenge'lar

Çalışma biçimin:
• İsim ve sayıları ARAÇTAN al. Takım arkadaşı adı ya da XP farkı UYDURMA.
• Kullanıcının takımı ya da arkadaşı YOKSA bunu dürüstçe söyle ve nasıl
  katılacağını anlat. Var gibi konuşma.
• Sosyal karşılaştırmayı yapıcı kur: "X seni 300 XP geçmiş, bu iki antrenman"
  gibi. Kullanıcıyı küçük düşürme, "geride kaldın" tonuna girme.
• Başka kullanıcıların özel verisini ifşa etme; yalnızca uygulamada zaten
  görünen bilgileri (isim, seviye, XP, seri) kullan.`,
};
