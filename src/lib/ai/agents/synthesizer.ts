import type { AgentFinding } from "./types";

// ============================================================================
// BİRLEŞTİRİCİ
//
// Uzman bulgularını TEK BİR KOÇ SESİNE indirir. Kullanıcı arkada 3 ajan
// çalıştığını bilmemeli — "Fizyoterapist diyor ki…" gibi bir cevap, tek bir
// koçla konuştuğu yanılsamasını bozar ve okuması yorucu olur.
//
// ÇELİŞKİ YÖNETİMİ — bu katmanın asıl işi:
// Fitness koçu "bugün ağır bacak günü" derken toparlanma uzmanı "toparlanman
// 30, dinlen" diyebilir. İkisini yan yana yapıştırmak kullanıcıyı kararsız
// bırakır. Bu yüzden birleştiriciye açık bir öncelik sırası veriliyor:
// güvenlik > toparlanma > geri kalanı. Model çelişkiyi gizlemiyor, ÇÖZÜYOR.
// ============================================================================

/** Uzman bulgularını birleştiriciye verilecek bloğa çevirir. */
export function findingsToPrompt(findings: AgentFinding[]): string {
  const ok = findings.filter((f) => f.ok && f.content.trim());
  if (ok.length === 0) return "";

  return (
    "UZMAN BULGULARI (kullanıcı bunları görmüyor — sen tek cevaba dönüştüreceksin):\n\n" +
    ok.map((f) => `--- ${f.name} ---\n${f.content}`).join("\n\n")
  );
}

/**
 * Birleştirici sistem promptu.
 *
 * `baseVoice` mevcut koç kişiliği (admin panelinden yönetilen prompt) —
 * çoklu ajan mimarisi kişiliği değiştirmiyor, yalnızca arkasını besliyor.
 */
export function buildSynthesizerPrompt(baseVoice: string, findings: AgentFinding[]): string {
  const names = findings.filter((f) => f.ok && f.content.trim()).map((f) => f.name);

  return `${baseVoice}

GÖREVİN — DİKKATLİ OKU:
Arka planda ${names.length} uzman çalıştı ve sana bulgularını verdi. Sen bunları
TEK BİR CEVABA dönüştüreceksin.

KESİN KURALLAR:
• Uzmanlardan HİÇ BAHSETME. "Fizyoterapistimiz", "beslenme uzmanına göre",
  "uzmanlarımız" gibi ifadeler YASAK. Sen tek bir koçsun ve hepsini sen biliyorsun.
• Bulguları alt alta yapıştırma. Tek bir akıcı cevap kur.
• Bulgularda OLMAYAN bilgi EKLEME. Yeni sayı, yeni öneri uydurma.
• Kullanıcının sorusuna cevap ver. Uzmanlar konuyu dağıttıysa sen topla.

ÇELİŞKİ VARSA — öncelik sırası:
1. Güvenlik ve sağlık uyarısı her şeyin üstündedir.
2. Toparlanma/dinlenme uyarısı, antrenman yoğunluğu önerisini geçersiz kılar.
3. Geri kalanında kullanıcının sorduğu konu önceliklidir.
Çelişkiyi kullanıcıya yansıtma; kararı sen ver ve tek bir net tavsiye söyle.

BİÇİM:
• Sıcak, samimi, doğrudan. Türkçe.
• Kısa-orta uzunluk. Gereksiz giriş cümlesi kurma.
• Markdown KULLANMA. Yıldız, diyez yok. Liste gerekirse satır başına "• " koy.
• En fazla bir emoji, o da gerçekten yerine oturuyorsa.`;
}

/**
 * Tek uzman çalıştıysa birleştirmeye gerek var mı?
 *
 * YOK — ve bu, mimarinin maliyet dengesinin can damarı. Mesajların çoğu tek
 * uzmanla cevaplanıyor; o durumda ikinci bir LLM çağrısı yapmak cevabı
 * iyileştirmeden maliyeti ikiye katlar. Tek uzman varsa onun çıktısı
 * doğrudan akıtılır.
 *
 * Yine de uzmanın çıktısı "bulgu" formatında (selamlamasız, kuru) olduğu için
 * ham haliyle sunulmaz — tek uzman durumunda da uzmana nihai cevabı yazdırırız
 * (bkz. `orchestrate`), birleştirici atlanır.
 */
export function needsSynthesis(findings: AgentFinding[]): boolean {
  return findings.filter((f) => f.ok && f.content.trim()).length > 1;
}

/**
 * Hiçbir uzman çalışmadıysa / hepsi patladıysa kullanılacak metin.
 * Sessiz kalmak ya da hata göstermek yerine dürüst bir cevap.
 */
export const ALL_FAILED_FALLBACK =
  "Şu anda sana özel bir değerlendirme üretemedim, teknik bir sorun oldu. " +
  "Birkaç dakika sonra tekrar dener misin? 💧";
