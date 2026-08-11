// 3D Anatomi motoru — kas bölgesi anahtarları, isim→bölge çözümleyici, renk mantığı.
// Client + server güvenli (yan etkisiz). AI Koç / Postür / Program da kullanır.

export type RegionKey =
  | "chest" | "shoulders" | "biceps" | "triceps" | "forearms"
  | "abs" | "obliques" | "traps" | "lats" | "lowerback"
  | "glutes" | "quads" | "hamstrings" | "calves" | "neck";

export type MuscleState = "primary" | "secondary" | "none";

export const REGION_KEYS: RegionKey[] = [
  "chest", "shoulders", "biceps", "triceps", "forearms",
  "abs", "obliques", "traps", "lats", "lowerback",
  "glutes", "quads", "hamstrings", "calves", "neck",
];

/** Bölge → Türkçe etiket (efsane/legend + admin). */
export const REGION_LABELS: Record<RegionKey, string> = {
  chest: "Göğüs", shoulders: "Omuz", biceps: "Biceps", triceps: "Triceps",
  forearms: "Ön Kol", abs: "Karın", obliques: "Yan Karın", traps: "Trapez",
  lats: "Sırt (Kanat)", lowerback: "Bel", glutes: "Kalça", quads: "Ön Bacak",
  hamstrings: "Arka Bacak", calves: "Baldır", neck: "Boyun",
};

/** Durum → renk (neon yeşil=ana, turuncu=yardımcı, koyu gri=pasif). */
export const STATE_COLOR: Record<MuscleState, string> = {
  primary: "#2BE86B",
  secondary: "#FB923C",
  none: "#4A5261",
};

/** Bölge → kısa görev açıklaması (tıkla-seç bilgi kartı için). */
export const REGION_INFO: Record<RegionKey, string> = {
  chest: "İtme hareketlerinin ana gücü; kolu öne ve içe getirir.",
  shoulders: "Kolu her yönde kaldırır; omuz stabilitesini sağlar.",
  biceps: "Dirseği büker, ön kolu döndürür (supinasyon).",
  triceps: "Dirseği düzeltir; itme hareketlerinin arka gücü.",
  forearms: "Bilek ve parmak hareketi; kavrama gücünün temeli.",
  abs: "Gövdeyi öne büker; kor stabilitesini sağlar.",
  obliques: "Gövde rotasyonu ve yana eğilme; bel desteği.",
  traps: "Kürek kemiğini kaldırır ve toplar; boyun-omuz desteği.",
  lats: "Kolu aşağı ve geriye çeker; çekiş hareketlerinin ana kası.",
  lowerback: "Omurgayı dik tutar; kalça menteşesinde güç sağlar.",
  glutes: "Kalçayı iter; sıçrama ve güç hareketlerinin motoru.",
  quads: "Dizi düzeltir; çömelme ve itme gücünün kaynağı.",
  hamstrings: "Dizi büker, kalçayı geri iter; sprint gücü.",
  calves: "Ayak bileğini iter; koşu ve sıçramada itiş.",
  neck: "Başı çevirir ve eğer; duruş dengesine katkı.",
};

/** Bölge → anatomi detay sayfası slug'ı (/anatomy/<slug>). */
export const REGION_SLUG: Record<RegionKey, string> = {
  chest: "gogus", shoulders: "omuz", biceps: "biceps", triceps: "triceps",
  forearms: "on-kol", abs: "karin", obliques: "yan-karin", traps: "trapez",
  lats: "sirt", lowerback: "bel", glutes: "kalca", quads: "on-bacak",
  hamstrings: "arka-bacak", calves: "baldir", neck: "boyun",
};

// Türkçe + İngilizce kas adı / kas grubu → bölge anahtarı.
const MATCHERS: { re: RegExp; region: RegionKey }[] = [
  { re: /göğüs|chest|pec(toral)?/i, region: "chest" },
  { re: /omuz|deltoid|shoulder|delt/i, region: "shoulders" },
  { re: /biceps|pazu|brachii|brachialis/i, region: "biceps" },
  { re: /triceps|arka kol/i, region: "triceps" },
  { re: /ön kol|on-kol|forearm|brachioradial|fleksör|ekstansör|flexor|extensor/i, region: "forearms" },
  { re: /karın|karin|abs|rectus abdom|core|abdom/i, region: "abs" },
  { re: /yan karın|oblik|oblique|transvers/i, region: "obliques" },
  { re: /trapez|trap(ezius)?|levator/i, region: "traps" },
  { re: /sırt|sirt|lat(issimus)?|kanat|romboid|rhomboid|teres/i, region: "lats" },
  { re: /bel|lower back|erector|lomber|lumbar/i, region: "lowerback" },
  { re: /kalça|kalca|glut(eus|e)?|basen/i, region: "glutes" },
  { re: /ön bacak|on-bacak|quad(riceps)?|vastus|femoris|uyluk ön/i, region: "quads" },
  { re: /arka bacak|hamstring|semitendin|semimembran|biceps femoris|uyluk arka/i, region: "hamstrings" },
  { re: /baldır|baldir|calf|calves|gastrocn|soleus|tibialis/i, region: "calves" },
  { re: /boyun|neck|sternocleido|scm/i, region: "neck" },
  { re: /adduktör|adductor|iç bacak/i, region: "quads" },
  { re: /kalça fleksör|iliopsoas|hip flexor/i, region: "quads" },
];

/** Tek bir kas adını bölgeye çevirir (bulunamazsa null). */
export function regionForMuscle(name: string): RegionKey | null {
  for (const m of MATCHERS) if (m.re.test(name)) return m.region;
  return null;
}

/** İsim listesini benzersiz bölge kümesine çevirir. */
export function regionsForMuscles(names: (string | null | undefined)[]): RegionKey[] {
  const set = new Set<RegionKey>();
  for (const n of names) {
    if (!n) continue;
    const r = regionForMuscle(n);
    if (r) set.add(r);
  }
  return [...set];
}

/**
 * Birincil + ikincil kas adlarından her bölgenin durumunu hesaplar.
 * Birincil, ikinciliği ezer (aynı bölge hem primary hem secondary ise → primary).
 */
export function buildMuscleStates(
  primary: (string | null | undefined)[],
  secondary: (string | null | undefined)[] = []
): Record<RegionKey, MuscleState> {
  const states = Object.fromEntries(REGION_KEYS.map((k) => [k, "none"])) as Record<RegionKey, MuscleState>;
  for (const r of regionsForMuscles(secondary)) states[r] = "secondary";
  for (const r of regionsForMuscles(primary)) states[r] = "primary";
  return states;
}

/**
 * AI Koç metninden kas bölgelerini çıkarır (ör. "göğüs ve triceps çalışacağız").
 * "yardımcı", "ikincil", "destek" geçen bölgeler secondary, diğerleri primary.
 */
export function parseMusclesFromText(text: string): Record<RegionKey, MuscleState> {
  const lower = text.toLocaleLowerCase("tr");
  const primary: string[] = [];
  const secondary: string[] = [];
  for (const m of MATCHERS) {
    const match = lower.match(m.re);
    if (!match) continue;
    const idx = match.index ?? 0;
    const window = lower.slice(Math.max(0, idx - 30), idx + 30);
    if (/yardımc|ikincil|destek|secondary/i.test(window)) secondary.push(match[0]);
    else primary.push(match[0]);
  }
  return buildMuscleStates(primary, secondary);
}
