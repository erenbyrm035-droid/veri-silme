import type { AgentSnapshot } from "./context";

// ============================================================================
// SELF CHECK — halüsinasyon koruması.
//
// KABUL: Bir dil modelinin uydurmasını tamamen engelleyemezsin. Yapabileceğin
// iki şey var ve ikisini de yapıyoruz:
//
//   1) ÖNLEME (asıl iş) — modele neyi BİLMEDİĞİNİ açıkça söyle. `context.ts`
//      eksik veriyi "ELİNDE OLMAYAN VERİLER" başlığıyla listeliyor, buradaki
//      `selfCheckPrompt()` de kuralları koyuyor. Model boşluğu doldurmaya
//      çalışmak yerine soru soruyor.
//
//   2) YAKALAMA (ağ) — cevapta geçen sayıları, elimizdeki gerçek verilerle
//      karşılaştır. Kullanıcının hiç adım verisi yokken "8.400 adım atmışsın"
//      diyorsa bu deterministik olarak yakalanabilir.
//
// NE YAPMIYORUZ: Cevabı sessizce silmiyor ya da yeniden yazmıyoruz. Şüpheli
// bir iddia bulunduğunda cevabın sonuna dürüst bir not ekliyoruz. Kullanıcıyı
// yanlış bilgiden korumanın yolu bilgiyi gizlemek değil, işaretlemek.
// ============================================================================

/** Sistem promptuna eklenen davranış kuralları. */
export function selfCheckPrompt(): string {
  return `
DOĞRULUK KURALLARI (bunlara uymak diğer her şeyden önemli):
- Yalnızca sana verilen KULLANICI DURUMU bloğundaki ve araç sonuçlarındaki verilere dayan.
- Elinde OLMAYAN bir rakamı ASLA uydurma. Kullanıcının kilosunu, adımını, uykusunu, kalorisini
  bilmiyorsan "bu veri bende yok" de ve nereden gireceğini söyle.
- Bir sayıyı söylemeden önce kendine sor: bu sayı verilen bloklarda GEÇİYOR MU? Geçmiyorsa söyleme.
- Emin olmadığın bir bilgiyi kesin gibi sunma; "kaydına göre" / "girdiğin verilere göre" diyerek kaynağını belirt.
- Kullanıcı geçmişte söylediği bir şeyi sorarsa ve hafızanda yoksa, "bunu bana söylemediğini görüyorum" de,
  hatırlıyormuş gibi yapma.
- Veri eksikse önce ilgili aracı çağır. Araç da veri bulamazsa bunu kullanıcıya açıkça söyle.
- Tıbbi teşhis koyma; ağrı, sakatlık veya şüpheli belirtide sağlık profesyoneline yönlendir.`;
}

// --- Yakalama ağı ----------------------------------------------------------

export interface SelfCheckResult {
  /** Şüpheli bir iddia bulunduysa cevabın sonuna eklenecek not (yoksa null). */
  note: string | null;
  /** Hangi kontroller tetiklendi — `ai_logs`'a yazılır. */
  flags: string[];
}

const has = (v: unknown): boolean => v !== null && v !== undefined && Number(v) > 0;
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * Cevapta kullanıcıya ait olmayan metrik iddiası var mı diye bakar.
 *
 * Yöntem: veri YOKKEN o metrikten sayıyla bahsedilmişse işaretle. Tersini
 * (veri varken yanlış sayı) kontrol etmiyoruz — model bloktaki sayıyı
 * dönüştürmüş olabilir (dakika→saat gibi) ve yanlış alarm üretirdi.
 */
export function selfCheck(answer: string, snap: AgentSnapshot | null): SelfCheckResult {
  const flags: string[] = [];
  if (!snap || !answer) return { note: null, flags };

  const text = answer.toLocaleLowerCase("tr");
  const t = obj(snap.today);
  const p = obj(snap.profile);
  const nut = obj(snap.nutrition_7d);
  const workouts = Array.isArray(snap.recent_workouts) ? snap.recent_workouts : [];

  /** "12.500 adım" gibi bir kalıp var mı? */
  const numberNear = (words: string[]): boolean =>
    words.some((w) => new RegExp(`\\d[\\d.,]*\\s*(${w})|(${w})[^.!?]{0,20}?\\d`, "i").test(text));

  if (!has(t.steps) && numberNear(["adım"])) {
    flags.push("steps_without_data");
  }
  if (!has(t.sleep_minutes) && numberNear(["saat uyku", "uyku saat", "uykun"])) {
    flags.push("sleep_without_data");
  }
  if (!has(nut.logged_days) && numberNear(["kalori", "kcal", "gram protein", "g protein"])) {
    flags.push("nutrition_without_data");
  }
  if (!has(p.weight_kg) && numberNear(["kilo", "kg"])) {
    flags.push("weight_without_data");
  }
  if (workouts.length === 0 && /son antrenman|geçen antrenman|geçen hafta.{0,15}antren/i.test(text)) {
    flags.push("workout_without_data");
  }

  if (flags.length === 0) return { note: null, flags };

  const LABEL: Record<string, string> = {
    steps_without_data: "adım",
    sleep_without_data: "uyku",
    nutrition_without_data: "beslenme",
    weight_without_data: "kilo",
    workout_without_data: "antrenman geçmişi",
  };
  const subjects = [...new Set(flags.map((f) => LABEL[f]).filter(Boolean))];

  return {
    note:
      `\n\nNot: ${subjects.join(", ")} verin kayıtlı olmadığı için yukarıdaki ` +
      `ilgili rakamlar genel bir örnektir, senin gerçek verin değil. Uygulamaya girersen sana özel konuşabilirim.`,
    flags,
  };
}
