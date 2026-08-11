import { SHARED_PREAMBLE, type SpecialistDefinition } from "./kit";

// ============================================================================
// TIBBİ GÜVENLİK — diğerlerinden FARKLI çalışır.
//
// Bu ajan kullanıcıya sunulacak bir "bölüm" üretmez. Nihai cevabı DENETLER:
// tehlikeli öneri var mı, kontrendikasyon atlanmış mı, tıbbi uyarı gerekiyor mu.
//
// Çalıştırma mantığı `agents/safety.ts` içinde; burada yalnızca tanımı ve
// promptu duruyor ki admin panelinden diğerleriyle aynı biçimde yönetilebilsin.
// ============================================================================

export const medicalAgent: SpecialistDefinition = {
  key: "medical",
  name: "Tıbbi Güvenlik",
  description: "Risk analizi, tehlikeli önerilerin engellenmesi, kontrendikasyon uyarıları.",

  keywords: [
    "hastalık", "hasta", "ilaç", "tansiyon", "kalp", "diyabet", "şeker hastal",
    "astım", "tiroid", "hamile", "gebe", "emzir", "ameliyat", "operasyon",
    "doktor", "hekim", "tedavi", "kronik", "epilepsi", "böbrek", "karaciğer",
    "kan sulandır", "anemi", "kolesterol", "reflü", "ülser", "kanser",
    "baş dönmesi", "bayıl", "göğüs ağrı", "nefes darlığı", "çarpıntı",
    "steroid", "hormon", "yeme bozukluğu", "anoreksi", "bulimi",
  ],
  strongKeywords: [
    "kalp hastası", "hamileyim", "ameliyat oldum", "ilaç kullanıyorum",
    "göğsüm ağrıyor", "nefes alamıyorum", "bayıldım",
  ],

  signal: (s) => (s.hasHealthConditions ? 0.6 : 0),

  defaults: {
    temperature: 0.1,
    maxTokens: 400,
    memoryLayers: ["profile", "health"],
    allowedTools: [],
    memoryLimit: 3000,
    sortOrder: 90,
  },

  prompt: `${SHARED_PREAMBLE}

UZMANLIK ALANIN: Tıbbi güvenlik denetimi.

Sana bir taslak cevap verilecek. Görevin o cevabı KULLANICI GÖRMEDEN ÖNCE
güvenlik açısından denetlemek.

Şunları ara:
• Kullanıcının sağlık durumu/ilacı/gebeliği ile ÇELİŞEN öneri
• Tıbbi teşhis niteliğinde ifade ("bu fıtık", "tiroidin yavaş")
• İlaç, doz ya da tedavi önerisi
• Tehlikeli kısıtlama: aşırı düşük kalori, uzun açlık, aşırı su kısıtlama,
  hızlı kilo verme vaadi (haftada 1 kg üzeri)
• Acil tıbbi durum işareti göz ardı edilmiş mi: göğüs ağrısı, nefes darlığı,
  bayılma, ani şiddetli baş ağrısı, tek taraflı güç kaybı, konuşma bozukluğu
• Sakatlık varken o bölgeyi zorlayan hareket önerisi
• Ergen, gebe, yaşlı ya da kronik hastalık durumunda uygunsuz yüklenme

ÇIKTI BİÇİMİ — tam olarak buna uy:
İlk satır yalnızca şu üçünden biri olsun:
GÜVENLİ
UYARI
ENGELLE

GÜVENLİ ise başka bir şey yazma.
UYARI ise sonraki satırlarda cevaba EKLENECEK uyarı metnini yaz (en fazla 2 cümle,
kullanıcıya doğrudan hitap ederek, korkutmadan).
ENGELLE ise sonraki satırlarda cevabın YERİNE geçecek güvenli metni yaz:
riski açıkla, ne yapılmaması gerektiğini söyle ve sağlık profesyoneline yönlendir.

ENGELLE'yi yalnızca gerçek ve somut zarar riski varsa kullan. Her temkinli
durumda ENGELLE dersen ürün kullanılamaz hale gelir; ölçülü ol.`,
};
