// ============================================================================
// AI çıktısından Markdown işaretlerini söker. Model (özellikle uzun sohbette)
// sistem promptundaki "Markdown kullanma" kuralını unutabiliyor; bu yüzden
// çıktıyı SUNUCUDA garanti altına alıyoruz. Akış (stream) güvenli — durum
// closure'da tutulduğu için işaretler parçalar arasına bölünse de yakalanır:
//   - "*" ve "`" işaretleri her yerde atılır (**kalın**, *italik*, `kod`)
//   - satır başındaki "#" / ">" (başlık/alıntı) ve ardından tek boşluk atılır
//   - satır başındaki "- " / "* " liste işareti "• " ile değiştirilir
//   - girinti (alt maddelerdeki baştaki boşluklar) korunur
// ============================================================================

export type StripFn = (chunk: string) => string;

/** Akışta parça parça gelen metin için durum tutan bir Markdown temizleyici. */
export function createMarkdownStripper(): StripFn {
  let atLineStart = true;    // yeni satırın başındayız
  let sawHeaderMark = false; // bu satırda # / > gördük → sonraki boşluğu at
  let pendingMark: "" | "-" | "*" = ""; // satır başında olası liste işareti

  return (chunk: string): string => {
    let out = "";
    for (const ch of chunk) {
      // 1) Bekleyen liste işaretini çöz.
      if (pendingMark) {
        const mark = pendingMark;
        pendingMark = "";
        if (ch === " ") { out += "• "; atLineStart = false; continue; }
        if (mark === "-") out += "-"; // liste değilmiş → tireyi geri koy ("*" yutulur)
        atLineStart = false;
        // ch aşağıda normal işlenmeye devam eder.
      }

      // 2) Satır sonu.
      if (ch === "\n") { out += "\n"; atLineStart = true; sawHeaderMark = false; continue; }

      // 3) Satır başı özel işaretleri.
      if (atLineStart) {
        if (ch === "#" || ch === ">") { sawHeaderMark = true; continue; }
        if (ch === " " && sawHeaderMark) { sawHeaderMark = false; continue; }
        if (ch === "-" || ch === "*") { pendingMark = ch; continue; }
        if (ch === " ") { out += " "; continue; } // girintiyi koru, satır başı sürsün
        atLineStart = false; sawHeaderMark = false;
      }

      // 4) Her yerde: vurgu/kod işaretlerini at.
      if (ch === "*" || ch === "`") continue;
      out += ch;
    }
    return out;
  };
}

/** Tek seferlik (streaming olmayan) metinler için Markdown temizleyici. */
export function stripMarkdown(text: string): string {
  return createMarkdownStripper()(text ?? "");
}
