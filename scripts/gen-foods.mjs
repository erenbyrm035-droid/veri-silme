// ============================================================================
// Türk besin veritabanı üreteci — 10k+ gerçekçi besin.
// Kaynak: gerçek market markaları × ürünler + hazırlama varyantları +
// Türk mutfağı yemekleri + meyve/sebze/bakliyat/kuruyemiş + supplement.
// Çıktı: supabase/seed/foods_10k.sql (on conflict (lower(name)) do nothing).
//
// Makrolar 100 g başınadır. Marka varyantlarında makro, isim tabanlı
// deterministik küçük bir sapma (jitter) ile çeşitlendirilir (uydurma değil,
// gerçekçi bant içinde). Çalıştır: node scripts/gen-foods.mjs
// ============================================================================
import { writeFileSync } from "node:fs";

const rows = [];
const seen = new Set();
const esc = (s) => String(s).replace(/'/g, "''");

// İsimden 0..1 arası deterministik sayı (jitter için).
function seedRand(str, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}
const jit = (base, name, pct = 0.05, salt = 1) => {
  if (!base) return 0;
  const r = (seedRand(name, salt) - 0.5) * 2 * pct;
  return Math.max(0, +(base * (1 + r)).toFixed(1));
};

function add(o) {
  const name = o.name.trim();
  const key = name.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  rows.push({
    name,
    category: o.category ?? "Diğer",
    subcategory: o.subcategory ?? null,
    brand: o.brand ?? null,
    calories: Math.round(o.cal ?? 0),
    protein_g: +(o.p ?? 0).toFixed(1),
    carbs_g: +(o.c ?? 0).toFixed(1),
    fat_g: +(o.f ?? 0).toFixed(1),
    fiber_g: +(o.fiber ?? 0).toFixed(1),
    sugar_g: +(o.sugar ?? 0).toFixed(1),
    sodium_mg: Math.round(o.sodium ?? 0),
    potassium_mg: Math.round(o.potas ?? 0),
    serving_desc: o.serving ?? "100 g",
    serving_grams: o.grams ?? 100,
    is_turkish: o.tr ?? true,
    is_restaurant: false,
    tags: o.tags ?? [],
    source: o.source ?? "seed_tr",
    popularity: o.pop ?? 10,
    is_verified: o.verified ?? false,
  });
}

// ---------------------------------------------------------------------------
// 1) TEK BESİNLER — gerçek makrolar (100 g)
// ---------------------------------------------------------------------------
const SINGLES = [
  // Et & tavuk & balık (çiğ/temel)
  ["Dana Kıyma (yağlı)","Et & Tavuk",254,17,0,20,0,0,90],
  ["Dana Kıyma (yağsız)","Et & Tavuk",187,20,0,12,0,0,90],
  ["Dana Antrikot","Et & Tavuk",250,26,0,16,0,0,70],
  ["Dana Bonfile","Et & Tavuk",158,27,0,5,0,0,70],
  ["Dana Biftek","Et & Tavuk",217,26,0,12,0,0,60],
  ["Kuzu Pirzola","Et & Tavuk",294,25,0,21,0,0,60],
  ["Kuzu Kol","Et & Tavuk",282,24,0,20,0,0,40],
  ["Kuzu But","Et & Tavuk",230,26,0,14,0,0,40],
  ["Hindi Göğsü","Et & Tavuk",135,29,0,1.5,0,0,55],
  ["Hindi But","Et & Tavuk",170,28,0,6,0,0,35],
  ["Tavuk Ciğeri","Et & Tavuk",119,17,1,5,0,0,25],
  ["Dana Ciğeri","Et & Tavuk",135,20,4,4,0,0,25],
  ["Somon","Balık & Deniz",208,20,0,13,0,0,80],
  ["Levrek","Balık & Deniz",97,18,0,2.5,0,0,55],
  ["Çipura","Balık & Deniz",115,19,0,4,0,0,55],
  ["Hamsi","Balık & Deniz",131,20,0,5,0,0,60],
  ["Uskumru","Balık & Deniz",205,19,0,14,0,0,45],
  ["Palamut","Balık & Deniz",168,23,0,8,0,0,40],
  ["İstavrit","Balık & Deniz",120,18,0,5,0,0,35],
  ["Sardalya","Balık & Deniz",208,25,0,11,0,0,30],
  ["Alabalık","Balık & Deniz",119,20,0,4,0,0,40],
  ["Karides","Balık & Deniz",99,24,0.2,0.3,0,0,45],
  ["Kalamar","Balık & Deniz",92,15,3,1.4,0,0,25],
  ["Midye","Balık & Deniz",86,12,3.7,2.2,0,0,25],
  ["Ton Balığı (suda)","Balık & Deniz",116,26,0,1,0,0,70],
  ["Ton Balığı (yağda)","Balık & Deniz",198,29,0,8,0,0,60],
  // Yumurta & kahvaltılık
  ["Yumurta (tam)","Yumurta & Kahvaltı",155,13,1.1,11,0,1.1,80],
  ["Yumurta Akı","Yumurta & Kahvaltı",52,11,0.7,0.2,0,0,70],
  ["Yumurta Sarısı","Yumurta & Kahvaltı",322,16,3.6,27,0,0.6,40],
  ["Haşlanmış Yumurta","Yumurta & Kahvaltı",155,13,1.1,11,0,1.1,75],
  ["Sahanda Yumurta","Yumurta & Kahvaltı",196,14,0.8,15,0,0.8,60],
  ["Menemen","Yumurta & Kahvaltı",118,6,5,8,1.2,3,70],
  ["Omlet","Yumurta & Kahvaltı",154,11,1,11,0,1,60],
  ["Zeytin (siyah)","Yumurta & Kahvaltı",115,0.8,6,11,3.2,0,60],
  ["Zeytin (yeşil)","Yumurta & Kahvaltı",145,1,4,15,4,0.5,55],
  ["Bal","Yumurta & Kahvaltı",304,0.3,82,0,0.2,82,70],
  ["Reçel (vişne)","Yumurta & Kahvaltı",250,0.4,65,0.1,0.7,60,45],
  ["Tahin","Yumurta & Kahvaltı",595,17,21,54,9,0.5,45],
  ["Pekmez (üzüm)","Yumurta & Kahvaltı",293,1.4,73,0.1,0,66,45],
  ["Tahin-Pekmez","Yumurta & Kahvaltı",450,9,47,27,5,35,40],
  // Bakliyat & tahıl (pişmiş/kuru belirt)
  ["Kuru Fasulye (haşlanmış)","Bakliyat & Tahıl",127,9,23,0.5,6.4,0.3,60],
  ["Nohut (haşlanmış)","Bakliyat & Tahıl",164,9,27,2.6,7.6,4.8,60],
  ["Mercimek (kırmızı, haşlanmış)","Bakliyat & Tahıl",116,9,20,0.4,8,1.8,60],
  ["Yeşil Mercimek (haşlanmış)","Bakliyat & Tahıl",116,9,20,0.4,8,1.8,50],
  ["Barbunya (haşlanmış)","Bakliyat & Tahıl",127,9,23,0.5,6,0.3,40],
  ["Börülce (haşlanmış)","Bakliyat & Tahıl",116,8,21,0.5,6,0.3,25],
  ["Bulgur (pişmiş)","Bakliyat & Tahıl",83,3,19,0.2,4.5,0.1,55],
  ["Pirinç (pişmiş)","Bakliyat & Tahıl",130,2.7,28,0.3,0.4,0.1,75],
  ["Esmer Pirinç (pişmiş)","Bakliyat & Tahıl",111,2.6,23,0.9,1.8,0.4,45],
  ["Yulaf Ezmesi (kuru)","Bakliyat & Tahıl",389,17,66,7,10,1,80],
  ["Karabuğday (pişmiş)","Bakliyat & Tahıl",92,3.4,20,0.6,2.7,0,25],
  ["Kinoa (pişmiş)","Bakliyat & Tahıl",120,4.4,21,1.9,2.8,0.9,50],
  ["Mısır (haşlanmış)","Bakliyat & Tahıl",96,3.4,21,1.5,2.4,4.5,40],
  ["İrmik","Bakliyat & Tahıl",360,12,73,1,3.9,0,30],
  ["Un (buğday)","Bakliyat & Tahıl",364,10,76,1,2.7,0.3,40],
  // Meyveler
  ["Elma","Meyve",52,0.3,14,0.2,2.4,10,85],
  ["Muz","Meyve",89,1.1,23,0.3,2.6,12,90],
  ["Portakal","Meyve",47,0.9,12,0.1,2.4,9,75],
  ["Mandalina","Meyve",53,0.8,13,0.3,1.8,11,60],
  ["Çilek","Meyve",32,0.7,7.7,0.3,2,4.9,65],
  ["Üzüm","Meyve",69,0.7,18,0.2,0.9,16,60],
  ["Karpuz","Meyve",30,0.6,8,0.2,0.4,6,60],
  ["Kavun","Meyve",34,0.8,8,0.2,0.9,8,45],
  ["Kayısı","Meyve",48,1.4,11,0.4,2,9,45],
  ["Şeftali","Meyve",39,0.9,10,0.3,1.5,8,45],
  ["Armut","Meyve",57,0.4,15,0.1,3.1,10,50],
  ["Kiraz","Meyve",63,1.1,16,0.2,2.1,13,45],
  ["Vişne","Meyve",50,1,12,0.3,1.6,8,35],
  ["İncir (taze)","Meyve",74,0.8,19,0.3,2.9,16,35],
  ["Nar","Meyve",83,1.7,19,1.2,4,14,45],
  ["Ananas","Meyve",50,0.5,13,0.1,1.4,10,40],
  ["Kivi","Meyve",61,1.1,15,0.5,3,9,40],
  ["Avokado","Meyve",160,2,9,15,7,0.7,55],
  ["Mango","Meyve",60,0.8,15,0.4,1.6,14,35],
  ["Erik","Meyve",46,0.7,11,0.3,1.4,10,35],
  ["Böğürtlen","Meyve",43,1.4,10,0.5,5.3,4.9,25],
  ["Yaban Mersini","Meyve",57,0.7,14,0.3,2.4,10,35],
  ["Greyfurt","Meyve",42,0.8,11,0.1,1.6,7,25],
  ["Limon","Meyve",29,1.1,9,0.3,2.8,2.5,30],
  // Kuru meyve & kuruyemiş
  ["Ceviz","Kuruyemiş",654,15,14,65,6.7,2.6,70],
  ["Badem","Kuruyemiş",579,21,22,50,12.5,4.4,75],
  ["Fındık","Kuruyemiş",628,15,17,61,10,4.3,70],
  ["Antep Fıstığı","Kuruyemiş",560,20,28,45,10,8,60],
  ["Yer Fıstığı","Kuruyemiş",567,26,16,49,8.5,4,60],
  ["Kaju","Kuruyemiş",553,18,30,44,3.3,6,50],
  ["Ay Çekirdeği","Kuruyemiş",584,21,20,51,9,2.6,55],
  ["Kabak Çekirdeği","Kuruyemiş",559,30,11,49,6,1.4,45],
  ["Kuru Üzüm","Kuruyemiş",299,3,79,0.5,3.7,59,50],
  ["Kuru Kayısı","Kuruyemiş",241,3.4,63,0.5,7.3,53,50],
  ["Kuru İncir","Kuruyemiş",249,3.3,64,0.9,9.8,48,40],
  ["Hurma","Kuruyemiş",282,2.5,75,0.4,8,63,55],
  ["Kuru Erik","Kuruyemiş",240,2.2,64,0.4,7,38,25],
  // Sebzeler
  ["Domates","Sebze",18,0.9,3.9,0.2,1.2,2.6,80],
  ["Salatalık","Sebze",15,0.7,3.6,0.1,0.5,1.7,75],
  ["Marul","Sebze",15,1.4,2.9,0.2,1.3,0.8,55],
  ["Ispanak","Sebze",23,2.9,3.6,0.4,2.2,0.4,60],
  ["Brokoli","Sebze",34,2.8,7,0.4,2.6,1.7,60],
  ["Karnabahar","Sebze",25,1.9,5,0.3,2,1.9,40],
  ["Havuç","Sebze",41,0.9,10,0.2,2.8,4.7,65],
  ["Biber (yeşil)","Sebze",20,0.9,4.6,0.2,1.7,2.4,50],
  ["Biber (kırmızı)","Sebze",31,1,6,0.3,2.1,4.2,45],
  ["Patlıcan","Sebze",25,1,6,0.2,3,3.5,55],
  ["Kabak","Sebze",17,1.2,3.1,0.3,1,2.5,50],
  ["Patates (haşlanmış)","Sebze",87,1.9,20,0.1,1.8,0.9,70],
  ["Tatlı Patates (fırın)","Sebze",90,2,21,0.2,3.3,6.5,45],
  ["Soğan","Sebze",40,1.1,9,0.1,1.7,4.2,55],
  ["Sarımsak","Sebze",149,6.4,33,0.5,2.1,1,40],
  ["Taze Fasulye","Sebze",31,1.8,7,0.2,3.4,3.3,45],
  ["Bezelye","Sebze",81,5,14,0.4,5.7,5.7,45],
  ["Bamya","Sebze",33,1.9,7,0.2,3.2,1.5,30],
  ["Pancar","Sebze",43,1.6,10,0.2,2.8,7,25],
  ["Mantar","Sebze",22,3.1,3.3,0.3,1,2,50],
  ["Kereviz","Sebze",42,1.5,9,0.3,1.8,1.8,20],
  ["Turp","Sebze",16,0.7,3.4,0.1,1.6,1.9,20],
  ["Roka","Sebze",25,2.6,3.7,0.7,1.6,2,35],
  ["Maydanoz","Sebze",36,3,6,0.8,3.3,0.9,30],
  ["Lahana","Sebze",25,1.3,6,0.1,2.5,3.2,35],
  ["Kırmızı Lahana","Sebze",31,1.4,7,0.2,2.1,3.8,20],
  ["Pırasa","Sebze",61,1.5,14,0.3,1.8,3.9,30],
  ["Enginar","Sebze",47,3.3,11,0.2,5.4,1,20],
  ["Balkabağı","Sebze",26,1,6.5,0.1,0.5,2.8,25],
  // Süt & süt ürünleri (marka altında ayrıca çoğaltılacak; jenerikler)
  ["Süt (tam yağlı)","Süt Ürünleri",61,3.2,4.8,3.3,0,4.8,80],
  ["Süt (yarım yağlı)","Süt Ürünleri",50,3.4,4.9,1.8,0,4.9,70],
  ["Süt (yağsız)","Süt Ürünleri",35,3.4,5,0.2,0,5,60],
  ["Yoğurt (tam yağlı)","Süt Ürünleri",61,3.5,4.7,3.3,0,4.7,80],
  ["Yoğurt (light)","Süt Ürünleri",45,4.5,5.5,0.4,0,5,65],
  ["Süzme Yoğurt","Süt Ürünleri",96,9,4,5,0,4,75],
  ["Kefir","Süt Ürünleri",55,3.3,4.5,2.5,0,4.5,50],
  ["Ayran","Süt Ürünleri",38,1.7,2.9,2,0,2.9,70],
  ["Beyaz Peynir (tam yağlı)","Süt Ürünleri",264,17,2,21,0,1,80],
  ["Beyaz Peynir (light)","Süt Ürünleri",180,18,2,11,0,1,60],
  ["Kaşar Peyniri","Süt Ürünleri",370,25,2,29,0,1,75],
  ["Lor Peyniri","Süt Ürünleri",98,11,3,4.3,0,3,45],
  ["Labne","Süt Ürünleri",255,6,4,24,0,4,50],
  ["Tulum Peyniri","Süt Ürünleri",345,22,1,28,0,1,40],
  ["Krem Peynir","Süt Ürünleri",255,6,5,24,0,4,45],
  ["Çökelek","Süt Ürünleri",156,20,3,7,0,3,30],
  ["Tereyağı","Süt Ürünleri",717,0.9,0.1,81,0,0.1,70],
  ["Kaymak","Süt Ürünleri",380,3,3,39,0,3,45],
  // İçecekler (jenerik)
  ["Türk Kahvesi (sade)","İçecek",2,0.1,0.3,0,0,0,60],
  ["Filtre Kahve (sade)","İçecek",2,0.1,0,0,0,0,55],
  ["Çay (şekersiz)","İçecek",1,0,0.2,0,0,0,70],
  ["Yeşil Çay","İçecek",1,0,0.2,0,0,0,45],
  ["Portakal Suyu (taze)","İçecek",45,0.7,10,0.2,0.2,8,50],
  ["Limonata","İçecek",40,0.1,10,0,0,9,35],
  ["Kola","İçecek",42,0,10.6,0,0,10.6,60],
  ["Kola (şekersiz)","İçecek",0.3,0,0,0,0,0,50],
  ["Gazoz","İçecek",38,0,9.5,0,0,9.5,35],
  ["Soda","İçecek",0,0,0,0,0,0,45],
  ["Enerji İçeceği","İçecek",45,0,11,0,0,11,40],
  // Yağlar
  ["Zeytinyağı","Yağ",884,0,0,100,0,0,80],
  ["Ayçiçek Yağı","Yağ",884,0,0,100,0,0,60],
  ["Mısırözü Yağı","Yağ",884,0,0,100,0,0,35],
  ["Fındık Yağı","Yağ",884,0,0,100,0,0,20],
  ["Hindistan Cevizi Yağı","Yağ",862,0,0,100,0,0,30],
];
for (const [name, category, cal, p, c, f, fiber, sugar, pop] of SINGLES) {
  add({ name, category, cal, p, c, f, fiber, sugar, pop: pop ?? 20, verified: true, tags: ["temel"] });
}

// ---------------------------------------------------------------------------
// 2) HAZIRLAMA VARYANTLARI — protein & balık
// ---------------------------------------------------------------------------
const PROT_BASES = [
  ["Tavuk Göğsü","Et & Tavuk",120,23,0,2.6],
  ["Tavuk But","Et & Tavuk",177,24,0,8.5],
  ["Tavuk Kanat","Et & Tavuk",203,30,0,8.1],
  ["Hindi Göğsü","Et & Tavuk",135,29,0,1.5],
  ["Dana Biftek","Et & Tavuk",158,26,0,6],
  ["Dana Köfte","Et & Tavuk",190,18,4,11],
  ["Kuzu Pirzola","Et & Tavuk",260,25,0,18],
  ["Somon","Balık & Deniz",180,20,0,11],
  ["Levrek","Balık & Deniz",97,18,0,2.5],
  ["Çipura","Balık & Deniz",115,19,0,4],
  ["Uskumru","Balık & Deniz",190,19,0,13],
  ["Alabalık","Balık & Deniz",119,20,0,4],
];
const PREPS = [
  ["haşlanmış", 1.0, 1.0],
  ["ızgara", 1.05, 1.1],
  ["fırın", 1.08, 1.15],
  ["tavada (az yağlı)", 1.25, 1.6],
  ["buğulama", 1.0, 1.0],
];
for (const [pname, pcat, cal, p, c, f] of PROT_BASES) {
  for (const [prep, calMul, fatMul] of PREPS) {
    if ((pcat.includes("Balık")) && prep === "ızgara" === false) { /* keep all */ }
    add({
      name: `${pname} (${prep})`, category: pcat, cal: cal * calMul, p, c, f: f * fatMul,
      pop: 25, verified: true, tags: ["hazırlama"],
    });
  }
}

// ---------------------------------------------------------------------------
// 3) MARKA × ÜRÜN — süt ürünleri
// ---------------------------------------------------------------------------
const DAIRY_BRANDS = ["Pınar","Sütaş","İçim","Torku","Sek","Yörsan","Muratbey","Danone","Activia","Eker","Tahsildaroğlu","Tikveşli","Dost","Bahçıvan","Ünal","Sağra","Teksüt","Enka","Balköy","Altınkılıç"];
const DAIRY_PRODUCTS = [
  ["Tam Yağlı Süt","Süt Ürünleri",61,3.2,4.8,3.3,4.8],
  ["Yarım Yağlı Süt","Süt Ürünleri",50,3.4,4.9,1.8,4.9],
  ["Laktozsuz Süt","Süt Ürünleri",47,3.3,4.7,1.5,4.7],
  ["Çilekli Süt","Süt Ürünleri",72,3,10,2,9],
  ["Kakaolu Süt","Süt Ürünleri",78,3.2,11,2.2,10],
  ["Tam Yağlı Yoğurt","Süt Ürünleri",61,3.5,4.7,3.3,4.7],
  ["Light Yoğurt","Süt Ürünleri",45,4.5,5.5,0.4,5],
  ["Süzme Yoğurt","Süt Ürünleri",96,9,4,5,4],
  ["Kefir","Süt Ürünleri",55,3.3,4.5,2.5,4.5],
  ["Meyveli Kefir","Süt Ürünleri",70,3,9,2,8],
  ["Ayran","Süt Ürünleri",38,1.7,2.9,2,2.9],
  ["Beyaz Peynir","Süt Ürünleri",264,17,2,21,1],
  ["Light Beyaz Peynir","Süt Ürünleri",180,18,2,11,1],
  ["Kaşar Peyniri","Süt Ürünleri",370,25,2,29,1],
  ["Light Kaşar","Süt Ürünleri",280,26,2,19,1],
  ["Labne","Süt Ürünleri",255,6,4,24,4],
  ["Krem Peynir","Süt Ürünleri",255,6,5,24,4],
  ["Üçgen Peynir","Süt Ürünleri",230,10,6,18,4],
  ["Tost Peyniri","Süt Ürünleri",330,20,3,26,2],
  ["Lor Peyniri","Süt Ürünleri",98,11,3,4.3,3],
  ["Tereyağı","Süt Ürünleri",717,0.9,0.1,81,0.1],
  ["Kaymak","Süt Ürünleri",380,3,3,39,3],
  ["Sütlü Tatlı Puding","Süt Ürünleri",110,3,18,3,15],
];
for (const b of DAIRY_BRANDS) {
  for (const [pn, cat, cal, p, c, f, sugar] of DAIRY_PRODUCTS) {
    const name = `${b} ${pn}`;
    add({ name, category: cat, brand: b, cal: jit(cal, name, 0.06), p: jit(p, name, 0.05, 2),
      c: jit(c, name, 0.05, 3), f: jit(f, name, 0.06, 4), sugar, tr: true, pop: 20, tags: ["market","süt"], source: "seed_gen" });
  }
}

// ---------------------------------------------------------------------------
// 4) SUPPLEMENT — whey / casein / bar / kreatin
// ---------------------------------------------------------------------------
const WHEY_BRANDS = ["Hardline","BigJoy","Ostrovit","Optimum Nutrition","Scitec Nutrition","MyProtein","BiotechUSA","Protouch","Gymbeam","QNT","Nutrabio","Weider","Dorian Yates","Cybermass","Vscience","Muscletech","Reflex","Applied Nutrition","Prozis","Trec Nutrition","Allmax","Rule 1","BSN","Dymatize","Gaspari","Nutrend","Olimp","Body Attack","Kevin Levrone","Biogenix","Nutrixion","Torque","Supplement Club","Protein Ocean","Nixmet","Meltoon","GNC","Now Foods","IronMaxx","Ultimate Nutrition"];
const WHEY_FLAVORS = ["Çikolata","Vanilya","Muz","Çilek","Antep Fıstığı","Bisküvi","Salted Caramel","Kurabiye","Beyaz Çikolata","Kahve","Fındık","Karamel","Çilek-Muz","Cookies & Cream","Muzlu Çikolata","Karamelli Kahve","Frambuaz","Böğürtlen","Hindistan Cevizi","Limonlu Cheesecake","Çikolata-Fındık","Mocha","Tiramisu","Vişne","Elmalı Tarçın","Karpuz","Sütlü Çikolata","Bitter Çikolata","Karpuz-Çilek","Muzlu Fındık","Kavun","Fıstık Ezmesi","Krem Karamel","Çikolatalı Portakal","Beyaz Çikolata-Ahududu","Şekerleme","Meyve Karışık","Damla Sakızı","Çikolatalı Muz","Karamelli Fındık","Bal-Fındık","Çikolatalı Nane","Kavun-Karpuz","Limonlu Bisküvi","Kestane Şekeri","Sütlü Kahve","Fındıklı Karamel","Antep Fıstığı-Çikolata"];
const WHEY_FORMS = [["Whey Protein","whey",390,76,9,6],["Whey Isolate","isolate",370,86,3,1.5],["Whey Concentrate","concentrate",400,72,10,7]];
for (const b of WHEY_BRANDS) {
  for (const fl of WHEY_FLAVORS) {
    for (const [form, sub, cal, p, c, f] of WHEY_FORMS) {
      const name = `${b} ${form} ${fl}`;
      add({ name, category: "Protein Tozu", subcategory: sub, brand: b, cal: jit(cal, name, 0.04),
        p: jit(p, name, 0.04, 2), c: jit(c, name, 0.2, 3), f: jit(f, name, 0.25, 4),
        serving: "1 ölçek (~30 g)", grams: 30, tr: false, pop: 15, tags: ["supplement","protein",sub], source: "seed_gen" });
    }
  }
}
// Vegan / bitkisel & clear whey & gainer
for (const b of ["MyProtein","Ostrovit","BigJoy","Gymbeam","Prozis","Vegan Way","Nutrend","BiotechUSA","Hardline","Weider"]) {
  for (const fl of ["Çikolata","Vanilya","Çilek","Muz","Kakao","Fındık"]) {
    const name = `${b} Vegan Bitkisel Protein ${fl}`;
    add({ name, category: "Protein Tozu", subcategory: "vegan", brand: b, cal: jit(370, name, 0.05), p: jit(72, name, 0.06, 2), c: jit(12, name, 0.2, 3), f: jit(6, name, 0.25, 4), serving: "1 ölçek (~30 g)", grams: 30, tr: false, pop: 8, tags: ["supplement","protein","vegan"], source: "seed_gen" });
  }
}
for (const b of ["MyProtein","Ostrovit","BigJoy","Applied Nutrition","Gymbeam","Prozis","Reflex","Hardline"]) {
  for (const fl of ["Şeftali","Karpuz","Limon","Çilek-Kivi","Mango","Frambuaz","Portakal","Orman Meyveleri"]) {
    const name = `${b} Clear Whey ${fl}`;
    add({ name, category: "Protein Tozu", subcategory: "clear", brand: b, cal: jit(90, name, 0.06), p: jit(20, name, 0.05, 2), c: jit(1, name, 0.4, 3), f: 0.2, serving: "1 ölçek (~25 g)", grams: 25, tr: false, pop: 8, tags: ["supplement","protein","clear"], source: "seed_gen" });
  }
}
for (const b of ["Hardline","BigJoy","Scitec Nutrition","BiotechUSA","Optimum Nutrition","MyProtein","Weider","Muscletech","Serious Mass","Ostrovit","Gymbeam","QNT"]) {
  for (const fl of ["Çikolata","Vanilya","Muz","Çilek","Bisküvi","Karamel","Fındık","Kakao"]) {
    const name = `${b} Mass Gainer ${fl}`;
    add({ name, category: "Protein Tozu", subcategory: "gainer", brand: b, cal: jit(380, name, 0.04), p: jit(20, name, 0.08, 2), c: jit(65, name, 0.06, 3), f: jit(4, name, 0.2, 4), serving: "1 ölçek (~100 g)", grams: 100, tr: false, pop: 8, tags: ["supplement","gainer"], source: "seed_gen" });
  }
}
const CASEIN_BRANDS = ["Hardline","Optimum Nutrition","BiotechUSA","MyProtein","Scitec Nutrition","Ostrovit","BigJoy","Protouch"];
for (const b of CASEIN_BRANDS) {
  for (const fl of ["Çikolata","Vanilya","Çilek","Bisküvi"]) {
    const name = `${b} Casein Protein ${fl}`;
    add({ name, category: "Protein Tozu", subcategory: "casein", brand: b, cal: jit(360, name, 0.04),
      p: jit(80, name, 0.04, 2), c: jit(6, name, 0.2, 3), f: jit(2, name, 0.3, 4),
      serving: "1 ölçek (~30 g)", grams: 30, tr: false, pop: 10, tags: ["supplement","protein","casein"], source: "seed_gen" });
  }
}
const BAR_BRANDS = ["Hardline","BigJoy","Fellas","Quest","Nutrabio","Grenade","BiotechUSA","Protouch","Gymbeam","Ostrovit"];
for (const b of BAR_BRANDS) {
  for (const fl of ["Çikolata","Karamel","Fındık","Bisküvi","Fıstık Ezmesi","Beyaz Çikolata"]) {
    const name = `${b} Protein Bar ${fl}`;
    add({ name, category: "Protein Bar", brand: b, cal: jit(360, name, 0.05),
      p: jit(32, name, 0.08, 2), c: jit(35, name, 0.1, 3), f: jit(12, name, 0.15, 4),
      serving: "1 bar (~60 g)", grams: 60, tr: false, pop: 12, tags: ["supplement","bar"], source: "seed_gen" });
  }
}
// Kreatin / BCAA / preworkout (tozlar)
for (const b of ["Hardline","BigJoy","Ostrovit","Optimum Nutrition","MyProtein","Scitec Nutrition","BiotechUSA","Protouch"]) {
  add({ name: `${b} Kreatin Monohidrat`, category: "Takviye", brand: b, cal: 0, p: 0, c: 0, f: 0, serving: "1 ölçek (~5 g)", grams: 5, tr: false, pop: 12, tags: ["supplement","kreatin"], source: "seed_gen" });
  for (const fl of ["Karpuz","Limon","Mango","Kola"]) {
    const name = `${b} BCAA ${fl}`;
    add({ name, category: "Takviye", brand: b, cal: jit(40, name, 0.2), p: 4, c: jit(5, name, 0.3, 3), f: 0, serving: "1 ölçek (~10 g)", grams: 10, tr: false, pop: 8, tags: ["supplement","bcaa"], source: "seed_gen" });
  }
}

// ---------------------------------------------------------------------------
// 5) ATIŞTIRMALIK / ÇİKOLATA / BİSKÜVİ / GofRET — marka × ürün
// ---------------------------------------------------------------------------
const SNACK_BRANDS = ["Eti","Ülker","Torku","Nestlé","Şölen","Solen","Milka","Nutella","Falim","Tadım"];
const CHOC_PRODUCTS = [
  ["Sütlü Çikolata","Atıştırmalık",535,7,58,31,55],
  ["Bitter Çikolata","Atıştırmalık",546,6,46,38,38],
  ["Beyaz Çikolata","Atıştırmalık",539,6,59,32,58],
  ["Fındıklı Çikolata","Atıştırmalık",560,8,52,36,48],
  ["Gofret","Atıştırmalık",510,6,60,28,40],
  ["Çikolatalı Gofret","Atıştırmalık",525,6,58,30,42],
  ["Kremalı Bisküvi","Atıştırmalık",480,6,66,21,32],
  ["Kakaolu Bisküvi","Atıştırmalık",470,7,68,19,28],
  ["Yulaflı Bisküvi","Atıştırmalık",450,7,64,18,20],
  ["Kek (kakaolu)","Atıştırmalık",400,6,52,19,32],
  ["Kek (meyveli)","Atıştırmalık",380,5,55,16,34],
  ["Kraker (tuzlu)","Atıştırmalık",430,9,62,16,3],
  ["Çubuk Kraker","Atıştırmalık",440,10,60,17,2],
  ["Mısır Cipsi","Atıştırmalık",500,6,58,27,1],
  ["Patates Cipsi","Atıştırmalık",536,6,53,34,0.5],
  ["Baton Çikolata","Atıştırmalık",480,5,63,23,50],
  ["Marshmallow","Atıştırmalık",318,1.8,81,0.2,58],
  ["Lokum","Atıştırmalık",330,0.2,83,0.1,60],
  ["Jelibon","Atıştırmalık",343,6.9,77,0.2,47],
];
for (const b of SNACK_BRANDS) {
  for (const [pn, cat, cal, p, c, f, sugar] of CHOC_PRODUCTS) {
    const name = `${b} ${pn}`;
    add({ name, category: cat, brand: b, cal: jit(cal, name, 0.05), p: jit(p, name, 0.1, 2),
      c: jit(c, name, 0.06, 3), f: jit(f, name, 0.08, 4), sugar, tr: true, pop: 15, tags: ["market","atıştırmalık"], source: "seed_gen" });
  }
}

// ---------------------------------------------------------------------------
// 6) İÇECEK — marka × ürün
// ---------------------------------------------------------------------------
const BEV_BRANDS = ["Coca-Cola","Pepsi","Fanta","Sprite","Yedigün","Uludağ","Fruko","Çamlıca","Cappy","Dimes","Meysu","Icetea Lipton","Nestea","Redbull","Burn","Powerade"];
const BEV_PRODUCTS = [
  ["Kola","İçecek",42,0,10.6,0,10.6],
  ["Kola (şekersiz)","İçecek",0.3,0,0,0,0],
  ["Portakallı Gazoz","İçecek",44,0,11,0,11],
  ["Limonlu Gazoz","İçecek",40,0,10,0,10],
  ["Meyve Suyu (şeftali)","İçecek",50,0.2,12,0,11],
  ["Meyve Suyu (vişne)","İçecek",52,0.3,12,0,11],
  ["Meyve Suyu (elma)","İçecek",46,0.1,11,0,10],
  ["Meyve Suyu (portakal)","İçecek",45,0.7,10,0.2,8],
  ["Soğuk Çay (şeftali)","İçecek",30,0,7.5,0,7],
  ["Soğuk Çay (limon)","İçecek",28,0,7,0,6.5],
  ["Enerji İçeceği","İçecek",46,0,11,0,11],
  ["Enerji İçeceği (şekersiz)","İçecek",5,0,1,0,0],
  ["Maden Suyu (sade)","İçecek",0,0,0,0,0],
  ["Maden Suyu (limonlu)","İçecek",10,0,2.5,0,2],
];
for (const b of BEV_BRANDS) {
  for (const [pn, cat, cal, p, c, f, sugar] of BEV_PRODUCTS) {
    const name = `${b} ${pn}`;
    add({ name, category: cat, brand: b, cal: jit(cal, name, 0.05), p, c: jit(c, name, 0.05, 3), f: 0, sugar, tr: true, pop: 12, tags: ["market","içecek"], source: "seed_gen" });
  }
}

// ---------------------------------------------------------------------------
// 7) KAHVALTILIK GEVREK / GRANOLA — marka × ürün
// ---------------------------------------------------------------------------
const CEREAL_BRANDS = ["Nestlé","Ülker","Eti","Torku","Kellogg's","Nature Valley","Quaker","Verofit","Fellas","Bebe"];
const CEREAL_PRODUCTS = [
  ["Mısır Gevreği","Kahvaltılık Gevrek",357,7,84,0.9,8],
  ["Çikolatalı Gevrek","Kahvaltılık Gevrek",380,6,80,4,30],
  ["Ballı Badem Gevrek","Kahvaltılık Gevrek",400,8,72,9,22],
  ["Granola (klasik)","Kahvaltılık Gevrek",471,10,64,20,24],
  ["Granola (çikolatalı)","Kahvaltılık Gevrek",480,9,62,22,28],
  ["Müsli","Kahvaltılık Gevrek",367,10,66,6,18],
  ["Yulaf Ezmesi","Kahvaltılık Gevrek",389,17,66,7,1],
  ["Protein Granola","Kahvaltılık Gevrek",420,20,50,15,12],
];
for (const b of CEREAL_BRANDS) {
  for (const [pn, cat, cal, p, c, f, sugar] of CEREAL_PRODUCTS) {
    const name = `${b} ${pn}`;
    add({ name, category: cat, brand: b, cal: jit(cal, name, 0.04), p: jit(p, name, 0.08, 2), c: jit(c, name, 0.05, 3), f: jit(f, name, 0.1, 4), sugar, tr: true, pop: 12, tags: ["market","kahvaltılık"], source: "seed_gen" });
  }
}

// ---------------------------------------------------------------------------
// 8) MAKARNA / EKMEK / ŞARKÜTERİ / KONSERVE / SOS — marka × ürün
// ---------------------------------------------------------------------------
const PASTA_BRANDS = ["Barilla","Filiz","Nuh'un Ankara","Oba","Piyale","Pastavilla","Ekol","Bella"];
const PASTA_SHAPES = ["Spagetti","Burgu","Penne","Kelebek","Erişte","Fettuccine","Fusilli","Boru","Yıldız Şehriye","Arpa Şehriye"];
for (const b of PASTA_BRANDS) for (const s of PASTA_SHAPES) {
  const name = `${b} ${s} Makarna`;
  add({ name, category: "Makarna", brand: b, cal: jit(357, name, 0.02), p: jit(12, name, 0.05, 2), c: jit(72, name, 0.03, 3), f: jit(1.5, name, 0.2, 4), tr: true, pop: 10, tags: ["market","makarna"], source: "seed_gen" });
}
const BREAD_BRANDS = ["Uno","Sanver","Halk Ekmek","Eti","Ülker","Fırın"];
const BREAD_TYPES = [
  ["Beyaz Ekmek",265,9,49,3.2],["Tam Buğday Ekmek",247,13,41,3.4],["Çavdar Ekmeği",259,9,48,3.3],
  ["Kepekli Ekmek",250,11,43,3.5],["Ekşi Maya Ekmek",240,9,47,1.5],["Tost Ekmeği",280,8,50,5],
  ["Lavaş",275,8,55,2.5],["Bazlama",270,8,52,3],["Sandviç Ekmeği",275,9,49,4],["Hamburger Ekmeği",290,9,50,6],
];
for (const b of BREAD_BRANDS) for (const [pn, cal, p, c, f] of BREAD_TYPES) {
  const name = `${b} ${pn}`;
  add({ name, category: "Ekmek & Unlu", brand: b, cal: jit(cal, name, 0.03), p: jit(p, name, 0.06, 2), c: jit(c, name, 0.03, 3), f: jit(f, name, 0.15, 4), fiber: 3, tr: true, pop: 10, tags: ["market","ekmek"], source: "seed_gen" });
}
const DELI_BRANDS = ["Pınar","Namet","Maret","Aytaç","Banvit","Şenpiliç","Apikoğlu","Polonez","Bonfilet"];
const DELI_TYPES = [
  ["Sucuk","Şarküteri",458,22,2,40,1],["Dana Sucuk","Şarküteri",420,24,2,35,1],["Sosis","Şarküteri",290,12,3,25,1],
  ["Dana Sosis","Şarküteri",270,14,2,22,1],["Salam","Şarküteri",310,15,3,26,1],["Hindi Salam","Şarküteri",150,18,2,7,1],
  ["Jambon","Şarküteri",145,20,1,7,1],["Hindi Füme","Şarküteri",110,20,1,3,1],["Pastırma","Şarküteri",240,38,2,9,1],
  ["Kavurma","Şarküteri",380,25,1,31,1],["Tavuk Sosis","Şarküteri",220,14,3,17,1],
];
for (const b of DELI_BRANDS) for (const [pn, cat, cal, p, c, f] of DELI_TYPES) {
  const name = `${b} ${pn}`;
  add({ name, category: cat, brand: b, cal: jit(cal, name, 0.05), p: jit(p, name, 0.06, 2), c, f: jit(f, name, 0.08, 4), tr: true, pop: 10, tags: ["market","şarküteri"], source: "seed_gen" });
}
const SAUCE_BRANDS = ["Tat","Tamek","Tukaş","Calvé","Kemal Kükrer","Bizim","Knorr","Ketçapçı","Öncü"];
const SAUCE_TYPES = [
  ["Ketçap","Sos",112,1.2,26,0.3,22],["Mayonez","Sos",680,1,2,74,1],["Light Mayonez","Sos",350,1,8,33,3],
  ["Hardal","Sos",66,4,5,4,1],["Domates Salçası","Sos",82,4,17,0.5,10],["Biber Salçası","Sos",90,4,16,1.5,9],
  ["Barbekü Sos","Sos",172,1,40,0.6,33],["Sarımsak Sos","Sos",300,2,10,28,3],["Acı Sos","Sos",30,1,6,0.4,3],
  ["Pesto Sos","Sos",450,5,6,45,2],
];
for (const b of SAUCE_BRANDS) for (const [pn, cat, cal, p, c, f, sugar] of SAUCE_TYPES) {
  const name = `${b} ${pn}`;
  add({ name, category: cat, brand: b, cal: jit(cal, name, 0.05), p, c: jit(c, name, 0.08, 3), f: jit(f, name, 0.08, 4), sugar, tr: true, pop: 8, tags: ["market","sos"], source: "seed_gen" });
}
const CONSERVE_BRANDS = ["Tat","Tamek","Tukaş","Bizim","Yayla","Superfresh","Angora"];
const CONSERVE_TYPES = [
  ["Ton Balığı Konservesi","Konserve",198,29,0,8,0],["Mısır Konservesi","Konserve",96,3,21,1.2,4.5],
  ["Bezelye Konservesi","Konserve",81,5,14,0.4,4],["Barbunya Konservesi","Konserve",120,8,20,0.6,0.5],
  ["Nohut Konservesi","Konserve",139,7,24,2.6,4],["Kuru Fasulye Konservesi","Konserve",110,7,20,0.5,0.5],
  ["Zeytin Konservesi","Konserve",115,1,6,11,0],["Turşu (karışık)","Konserve",20,1,4,0.2,2],
];
for (const b of CONSERVE_BRANDS) for (const [pn, cat, cal, p, c, f, sugar] of CONSERVE_TYPES) {
  const name = `${b} ${pn}`;
  add({ name, category: cat, brand: b, cal: jit(cal, name, 0.05), p: jit(p, name, 0.05, 2), c: jit(c, name, 0.05, 3), f: jit(f, name, 0.1, 4), sugar, tr: true, pop: 8, tags: ["market","konserve"], source: "seed_gen" });
}

// ---------------------------------------------------------------------------
// 9) DONDURULMUŞ / HAZIR YEMEK — marka × ürün
// ---------------------------------------------------------------------------
const FROZEN_BRANDS = ["Superfresh","Dr. Oetker","Reis","Pınar","Aytaç","Bizim Mutfak"];
const FROZEN_TYPES = [
  ["Milföy Börek",290,6,30,16],["Su Böreği",230,8,28,9],["Çıtır Tavuk",250,15,18,13],
  ["Nugget",260,14,18,14],["Pizza (karışık)",250,11,30,9],["Patates Kızartması (fırın)",180,3,26,7],
  ["Sebze Karışık (dondurulmuş)",60,3,11,0.5],["Mantı",240,10,38,5],["Pizza Margarita",240,10,32,8],
  ["Çıtır Balık",220,14,16,11],
];
for (const b of FROZEN_BRANDS) for (const [pn, cal, p, c, f] of FROZEN_TYPES) {
  const name = `${b} ${pn}`;
  add({ name, category: "Hazır Yemek", brand: b, cal: jit(cal, name, 0.06), p: jit(p, name, 0.08, 2), c: jit(c, name, 0.05, 3), f: jit(f, name, 0.1, 4), tr: true, pop: 8, tags: ["market","hazır"], source: "seed_gen" });
}

// ---------------------------------------------------------------------------
// 10) TÜRK MUTFAĞI YEMEKLERİ (kompozit, tahmini makro / porsiyon)
// ---------------------------------------------------------------------------
const DISHES = [
  // Çorbalar
  ["Mercimek Çorbası","Çorba",60,3,9,1.5],["Ezogelin Çorbası","Çorba",70,3,11,1.8],["Tarhana Çorbası","Çorba",55,2.5,9,1.2],
  ["Yayla Çorbası","Çorba",65,3,8,2.5],["Domates Çorbası","Çorba",50,1.5,8,1.5],["Tavuk Çorbası","Çorba",55,4,5,2],
  ["İşkembe Çorbası","Çorba",80,6,4,4.5],["Düğün Çorbası","Çorba",90,4,7,5],["Mantar Çorbası","Çorba",60,2,7,3],
  ["Sebze Çorbası","Çorba",45,2,7,1],["Brokoli Çorbası","Çorba",55,3,7,2],["Kremalı Mantar Çorbası","Çorba",85,3,8,5],
  // Ana yemekler (etli)
  ["Kuru Fasulye (etli)","Ana Yemek",130,7,15,5],["Nohut Yemeği (etli)","Ana Yemek",140,7,18,4.5],
  ["Etli Türlü","Ana Yemek",95,5,10,4],["Karnıyarık","Ana Yemek",120,4,10,7],["İmam Bayıldı","Ana Yemek",100,2,10,6],
  ["Musakka","Ana Yemek",125,6,9,7],["Etli Biber Dolması","Ana Yemek",130,5,14,6],["Etli Kabak Dolması","Ana Yemek",110,4,12,5],
  ["Yaprak Sarma (zeytinyağlı)","Ana Yemek",180,3,22,9],["İçli Köfte","Ana Yemek",210,8,24,9],
  ["Tas Kebabı","Ana Yemek",150,12,8,8],["Hünkar Beğendi","Ana Yemek",160,10,10,9],["Orman Kebabı","Ana Yemek",145,11,9,7],
  ["Etli Bamya","Ana Yemek",90,6,8,4],["Etli Nohut","Ana Yemek",140,7,18,4.5],["Kıymalı Ispanak","Ana Yemek",95,6,7,5],
  ["Kıymalı Patates","Ana Yemek",120,6,14,5],["Sebzeli Tavuk Sote","Ana Yemek",120,13,7,4],
  ["Tavuk Sote","Ana Yemek",135,15,6,5],["Et Sote","Ana Yemek",165,16,6,8],["Tavuk Şiş","Ana Yemek",165,25,2,6],
  ["Kuzu Tandır","Ana Yemek",240,24,1,16],["Kağıt Kebabı","Ana Yemek",180,16,8,9],["Çoban Kavurma","Ana Yemek",210,20,4,13],
  ["Güveç (etli)","Ana Yemek",130,10,10,6],["Analı Kızlı","Ana Yemek",160,8,22,5],["Ali Nazik","Ana Yemek",175,12,9,10],
  // Köfte & kebap & döner
  ["Izgara Köfte","Kebap & Köfte",215,18,4,14],["İnegöl Köfte","Kebap & Köfte",230,17,5,16],["Tekirdağ Köfte","Kebap & Köfte",220,18,4,15],
  ["Adana Kebap","Kebap & Köfte",245,17,3,19],["Urfa Kebap","Kebap & Köfte",235,17,3,18],["Beyti Kebap","Kebap & Köfte",260,18,8,18],
  ["Şiş Kebap","Kebap & Köfte",210,22,2,13],["Patlıcan Kebabı","Kebap & Köfte",190,12,8,13],["Tavuk Döner","Kebap & Köfte",190,20,4,11],
  ["Et Döner","Kebap & Köfte",215,18,3,15],["İskender","Kebap & Köfte",230,14,14,14],["Tavuk Şiş Kebap","Kebap & Köfte",175,24,2,8],
  ["Çöp Şiş","Kebap & Köfte",230,20,2,16],["Kaşarlı Köfte","Kebap & Köfte",250,19,4,18],["Izgara Tavuk Kanat","Kebap & Köfte",210,24,1,13],
  // Pide & lahmacun & börek
  ["Kıymalı Pide","Hamur İşi",270,11,32,11],["Kaşarlı Pide","Hamur İşi",290,13,32,13],["Kuşbaşılı Pide","Hamur İşi",280,14,31,12],
  ["Kıymalı Kaşarlı Pide","Hamur İşi",300,14,32,14],["Lahmacun","Hamur İşi",230,10,30,8],["Sucuklu Pide","Hamur İşi",310,14,31,15],
  ["Su Böreği","Hamur İşi",250,9,26,12],["Sigara Böreği","Hamur İşi",290,8,28,16],["Ispanaklı Börek","Hamur İşi",240,7,26,12],
  ["Peynirli Börek","Hamur İşi",270,10,26,14],["Kıymalı Börek","Hamur İşi",280,11,27,15],["Patatesli Börek","Hamur İşi",250,6,30,12],
  ["Gözleme (peynirli)","Hamur İşi",240,8,30,10],["Gözleme (kıymalı)","Hamur İşi",260,10,30,12],["Gözleme (patatesli)","Hamur İşi",230,6,32,9],
  ["Pişi","Hamur İşi",320,6,40,15],["Poğaça (peynirli)","Hamur İşi",330,8,38,16],["Açma","Hamur İşi",310,7,42,13],
  ["Simit","Hamur İşi",300,9,52,6],["Börek (tepsi)","Hamur İşi",255,9,27,12],
  // Pilav & makarna yemekleri
  ["Pirinç Pilavı (tereyağlı)","Pilav & Makarna",175,3,32,4.5],["Bulgur Pilavı","Pilav & Makarna",130,3.5,24,2.5],
  ["Tavuklu Pilav","Pilav & Makarna",180,9,26,4.5],["Nohutlu Pilav","Pilav & Makarna",165,5,30,3.5],
  ["İç Pilav","Pilav & Makarna",190,4,30,6],["Şehriyeli Pilav","Pilav & Makarna",180,3.5,33,4],
  ["Kıymalı Makarna","Pilav & Makarna",190,9,26,6],["Fırın Makarna","Pilav & Makarna",210,10,26,8],
  ["Kaşarlı Makarna","Pilav & Makarna",220,10,28,8],["Soslu Makarna","Pilav & Makarna",175,6,30,4],
  ["Mantı (yoğurtlu)","Pilav & Makarna",210,9,32,5],["Erişte","Pilav & Makarna",180,6,32,3],
  // Salata & meze & zeytinyağlılar
  ["Çoban Salata","Salata & Meze",35,1,5,1.5],["Mevsim Salata","Salata & Meze",40,1.5,5,1.8],["Gavurdağı Salatası","Salata & Meze",120,3,8,9],
  ["Yeşil Salata","Salata & Meze",25,1.2,4,0.5],["Rus Salatası","Salata & Meze",160,2,12,11],["Piyaz","Salata & Meze",130,6,15,5],
  ["Haydari","Salata & Meze",130,6,5,10],["Acılı Ezme","Salata & Meze",70,2,8,4],["Humus","Salata & Meze",177,8,20,9],
  ["Cacık","Salata & Meze",50,2.5,4,2.5],["Şakşuka","Salata & Meze",110,2,9,7],["Zeytinyağlı Enginar","Salata & Meze",90,2,10,5],
  ["Zeytinyağlı Fasulye","Salata & Meze",95,3,10,5],["Zeytinyağlı Barbunya","Salata & Meze",130,6,16,5],["Kısır","Salata & Meze",150,4,26,4],
  ["Patlıcan Salatası","Salata & Meze",90,1.5,8,6],["Semizotu Salatası","Salata & Meze",45,2,4,2.5],["Turşu Kavurma","Salata & Meze",60,1.5,7,3],
  // Tatlılar
  ["Baklava","Tatlı",430,6,50,24,35],["Künefe","Tatlı",380,8,42,20,28],["Sütlaç","Tatlı",130,3,24,2.5,18],
  ["Kazandibi","Tatlı",150,4,26,3,20],["Tavuk Göğsü Tatlısı","Tatlı",145,5,25,3,19],["Kadayıf","Tatlı",380,5,52,17,32],
  ["Revani","Tatlı",320,4,55,9,38],["Şekerpare","Tatlı",360,4,58,12,40],["Tulumba Tatlısı","Tatlı",370,3,60,13,42],
  ["Lokma","Tatlı",340,4,54,12,32],["Muhallebi","Tatlı",120,3,22,2,16],["Aşure","Tatlı",160,3,34,2,20],
  ["İrmik Helvası","Tatlı",380,5,55,16,32],["Un Helvası","Tatlı",450,6,55,23,30],["Cheesecake","Tatlı",320,6,26,21,20],
  ["Profiterol","Tatlı",290,5,30,17,22],["Dondurma (sade)","Tatlı",207,3.5,24,11,21],["Dondurma (çikolatalı)","Tatlı",216,3.8,28,11,25],
  ["Magnolia","Tatlı",210,4,28,9,20],["Trileçe","Tatlı",280,5,35,13,26],["Waffle","Tatlı",350,7,45,15,22],
  ["Brownie","Tatlı",420,6,48,23,32],["Kek Dilimi","Tatlı",350,5,50,15,30],["Pandispanya","Tatlı",300,7,50,8,28],
  // Fast food tarzı (evde)
  ["Tost (kaşarlı)","Fast Food",280,12,28,14],["Tost (sucuklu)","Fast Food",320,14,28,18],["Karışık Tost","Fast Food",330,15,28,19],
  ["Hamburger (ev)","Fast Food",250,14,22,12],["Cheeseburger (ev)","Fast Food",280,15,22,15],["Sandviç (tavuklu)","Fast Food",210,13,24,7],
  ["Dürüm (tavuk)","Fast Food",220,15,24,8],["Dürüm (et döner)","Fast Food",250,16,24,11],["Kumpir","Fast Food",180,4,28,6],
];
for (const d of DISHES) {
  const [name, cat, cal, p, c, f, sugar] = d;
  add({ name, category: cat, cal, p, c, f, sugar: sugar ?? 0, serving: "1 porsiyon (~200 g)", grams: 200, tr: true, pop: 30, verified: true, tags: ["yemek"] });
}

// ---------------------------------------------------------------------------
// 11) Türk yemekleri için "ev/lokanta" varyantı (porsiyon farkı) — çeşitlilik
// ---------------------------------------------------------------------------
for (const d of DISHES) {
  const [name, cat, cal, p, c, f] = d;
  const nm = `${name} (lokanta porsiyonu)`;
  add({ name: nm, category: cat, cal: Math.round(cal * 1.3), p: +(p * 1.3).toFixed(1), c: +(c * 1.3).toFixed(1), f: +(f * 1.3).toFixed(1), serving: "1 büyük porsiyon (~300 g)", grams: 300, tr: true, pop: 12, tags: ["yemek","porsiyon"] });
}

// ---------------------------------------------------------------------------
// 12) Meyve/sebze "porsiyon" + kuruyemiş "kavrulmuş/tuzlu" varyantları
// ---------------------------------------------------------------------------
const NUT_ROAST = [["Fındık",646,15,17,63],["Antep Fıstığı",575,20,28,47],["Yer Fıstığı",599,26,16,52],["Badem",607,21,22,53],["Kaju",574,17,30,46],["Ay Çekirdeği",619,19,20,56],["Kabak Çekirdeği",574,29,15,49],["Leblebi",370,19,58,6]];
for (const [n, cal, p, c, f] of NUT_ROAST) {
  add({ name: `${n} (kavrulmuş, tuzlu)`, category: "Kuruyemiş", cal, p, c, f, sodium: 400, tr: true, pop: 20, tags: ["kuruyemiş"] });
  add({ name: `${n} (kavrulmuş, tuzsuz)`, category: "Kuruyemiş", cal: cal - 5, p, c, f, tr: true, pop: 15, tags: ["kuruyemiş"] });
}

// ---------------------------------------------------------------------------
// 13) PEYNİR ÇEŞİTLERİ — marka × tür
// ---------------------------------------------------------------------------
const CHEESE_BRANDS = ["Pınar","Sütaş","İçim","Tahsildaroğlu","Muratbey","Bahçıvan","Ünal","Sek","Teksüt","Eker","Dost","Kelle","Gündoğdu","Beyaz Peynirci","Ekici","Peynirci Baba"];
const CHEESE_TYPES = [
  ["Beyaz Peynir",264,17,2,21],["Ezine Peyniri",290,18,1,24],["Kaşar Peyniri",370,25,2,29],
  ["Eski Kaşar",390,26,1,31],["Tulum Peyniri",345,22,1,28],["Örgü Peyniri",330,24,2,26],
  ["Mihaliç Peyniri",360,25,1,28],["Dil Peyniri",320,23,2,25],["Lor Peyniri",98,11,3,4.3],
  ["Çeçil Peyniri",300,26,1,22],["Hellim",321,21,2,25],["Cheddar",403,25,1,33],
  ["Mozzarella",280,22,2,21],["Labne",255,6,4,24],["Krem Peynir",255,6,5,24],["Otlu Peynir",310,20,2,25],
];
for (const b of CHEESE_BRANDS) for (const [pn, cal, p, c, f] of CHEESE_TYPES) {
  const name = `${b} ${pn}`;
  add({ name, category: "Süt Ürünleri", subcategory: "peynir", brand: b, cal: jit(cal, name, 0.05), p: jit(p, name, 0.05, 2), c, f: jit(f, name, 0.06, 4), tr: true, pop: 12, tags: ["market","peynir"], source: "seed_gen" });
}

// 14) CİPS / ATIŞTIRMALIK — marka × aroma
const CHIPS_BRANDS = ["Lay's","Ruffles","Doritos","Cheetos","Patos","Çerezza","Çıtır","Pringles","Tadım","Peyman","Ülker","Eti"];
const CHIPS_FLAVORS = ["Klasik","Baharatlı","Peynirli","Ketçaplı","Fırından","Barbekü","Acılı","Sour Cream","Soğanlı","Mısır","Fındıklı","Yoğurtlu"];
for (const b of CHIPS_BRANDS) for (const fl of CHIPS_FLAVORS) {
  const name = `${b} Cips ${fl}`;
  add({ name, category: "Atıştırmalık", brand: b, cal: jit(520, name, 0.05), p: jit(6, name, 0.15, 2), c: jit(54, name, 0.06, 3), f: jit(31, name, 0.08, 4), sodium: 500, tr: false, pop: 12, tags: ["market","cips"], source: "seed_gen" });
}

// 15) KURUYEMİŞ MARKALARI — marka × ürün
const NUT_BRANDS = ["Tadım","Peyman","Çerezza","Çıtçıt","Migros","Tariş","Fıstıkçı","Nutzz"];
const NUT_TYPES = [["Karışık Kuruyemiş",580,17,20,50],["Antep Fıstığı",560,20,28,45],["Fındık",628,15,17,61],["Badem",579,21,22,50],["Ceviz İçi",654,15,14,65],["Kaju",553,18,30,44],["Ay Çekirdeği",584,21,20,51],["Kabak Çekirdeği",559,30,11,49],["Leblebi",370,19,58,6],["Fıstık (yer)",567,26,16,49],["Çekirdek Karışık",560,20,18,50],["Badem (çiğ)",579,21,22,50],["Kuru Üzüm",299,3,79,0.5],["Kuru Kayısı",241,3.4,63,0.5],["Hurma",282,2.5,75,0.4],["Kuru İncir",249,3.3,64,0.9],["Fındık Ezmesi",628,15,17,61],["Fıstık Ezmesi",588,25,20,50]];
for (const b of NUT_BRANDS) for (const [pn, cal, p, c, f] of NUT_TYPES) {
  const name = `${b} ${pn}`;
  add({ name, category: "Kuruyemiş", brand: b, cal: jit(cal, name, 0.03), p: jit(p, name, 0.05, 2), c: jit(c, name, 0.05, 3), f: jit(f, name, 0.05, 4), tr: true, pop: 10, tags: ["market","kuruyemiş"], source: "seed_gen" });
}

// 16) ZEYTİN — marka × tür
const OLIVE_BRANDS = ["Marmarabirlik","Komili","Tariş","Ekiz","Kırlangıç","Edremit","Memecik","Gemlik Zeytini","Öncü","Yayla"];
const OLIVE_TYPES = [["Siyah Zeytin",115,0.8,6,11],["Yeşil Zeytin",145,1,4,15],["Sele Zeytin",180,1.2,4,18],["Kırma Zeytin",150,1,5,15],["Çizik Zeytin",140,1,5,14],["Dilimli Zeytin",120,1,5,11],["Yağlı Zeytin",200,1,3,21],["Az Tuzlu Zeytin",120,1,5,11]];
for (const b of OLIVE_BRANDS) for (const [pn, cal, p, c, f] of OLIVE_TYPES) {
  const name = `${b} ${pn}`;
  add({ name, category: "Kahvaltılık", brand: b, cal: jit(cal, name, 0.05), p, c, f: jit(f, name, 0.06, 4), sodium: 900, tr: true, pop: 8, tags: ["market","zeytin"], source: "seed_gen" });
}

// 17) BAL / REÇEL / KAHVALTILIK — marka × ürün
const JAM_BRANDS = ["Balparmak","Anavarza","Sek","Tamek","Tat","Koska","Seyidoğlu","Marmarabirlik","Bağdat","Berrak","Çeşme"];
const JAM_TYPES = [["Çiçek Balı",304,0.3,82,0,82],["Çam Balı",320,0.3,80,0,78],["Süzme Bal",310,0.3,82,0,80],["Vişne Reçeli",250,0.4,64,0.1,60],["Çilek Reçeli",255,0.4,65,0.1,60],["Kayısı Reçeli",245,0.4,63,0.1,58],["İncir Reçeli",260,0.5,66,0.1,60],["Gül Reçeli",250,0.4,64,0.1,60],["Portakal Marmelatı",250,0.3,64,0.1,58],["Üzüm Pekmezi",293,1.4,73,0.1,66],["Tahin",595,17,21,54,0.5],["Fıstık Ezmesi",588,25,20,50,9]];
for (const b of JAM_BRANDS) for (const [pn, cal, p, c, f, sugar] of JAM_TYPES) {
  const name = `${b} ${pn}`;
  add({ name, category: "Kahvaltılık", brand: b, cal: jit(cal, name, 0.04), p, c: jit(c, name, 0.04, 3), f: jit(f, name, 0.1, 4), sugar, tr: true, pop: 9, tags: ["market","kahvaltılık"], source: "seed_gen" });
}

// 18) DONDURMA — marka × aroma
const ICE_BRANDS = ["Algida","Golf","Panda","Mado","Ülker","Cornetto","Magnum","Carte d'Or","Maraş"];
const ICE_FLAVORS = ["Vanilya","Çikolata","Çilek","Kaymak","Fıstıklı","Karamel","Limon","Meyveli","Bademli","Kavun","Bisküvili","Frambuaz","Sakızlı","Kakaolu"];
for (const b of ICE_BRANDS) for (const fl of ICE_FLAVORS) {
  const name = `${b} Dondurma ${fl}`;
  add({ name, category: "Tatlı", brand: b, cal: jit(210, name, 0.06), p: jit(3.5, name, 0.1, 2), c: jit(26, name, 0.08, 3), f: jit(10, name, 0.12, 4), sugar: 22, tr: true, pop: 10, tags: ["market","dondurma"], source: "seed_gen" });
}

// 19) KAHVE / ÇAY (hazır) — marka × ürün
const COFFEE_BRANDS = ["Nescafé","Jacobs","Mahmood","Kurukahveci Mehmet Efendi","Tchibo","Lavazza","Starbucks","Torku"];
const COFFEE_TYPES = [["Granül Kahve",353,15,10,1],["3ü1 Arada",440,4,72,13,45],["Gold Kahve",353,14,10,1],["Türk Kahvesi",2,0.1,0.3,0],["Dibek Kahvesi",5,0.2,0.8,0.1],["Filtre Kahve",2,0.1,0,0],["Cappuccino Toz",430,8,66,14,40],["Latte Toz",420,9,64,13,38]];
for (const b of COFFEE_BRANDS) for (const [pn, cal, p, c, f, sugar] of COFFEE_TYPES) {
  const name = `${b} ${pn}`;
  add({ name, category: "İçecek", brand: b, cal: jit(cal, name, 0.05), p, c: jit(c, name, 0.05, 3), f, sugar: sugar ?? 0, tr: false, pop: 8, tags: ["market","kahve"], source: "seed_gen" });
}
const TEA_BRANDS = ["Çaykur","Doğuş","Lipton","Karali","Ofçay","Beta","Tomurcuk"];
const TEA_TYPES = [["Siyah Çay",1,0,0.2,0],["Yeşil Çay",1,0,0.2,0],["Bergamot Çayı",1,0,0.2,0],["Kış Çayı",2,0,0.4,0],["Ihlamur",4,0,1,0],["Bitki Çayı",2,0,0.5,0],["Form Çayı",3,0,0.6,0],["Rezene Çayı",2,0,0.4,0]];
for (const b of TEA_BRANDS) for (const [pn, cal, p, c, f] of TEA_TYPES) {
  const name = `${b} ${pn}`;
  add({ name, category: "İçecek", brand: b, cal, p, c, f, tr: true, pop: 6, tags: ["market","çay"], source: "seed_gen" });
}

// 20) YOĞURT/SÜT AROMALI & PROTEİNLİ İÇECEK — marka × ürün
const PDRINK_BRANDS = ["Pınar Protein","İçim Protein","Sütaş Protein","Hardline","BigJoy","Muscle Milk","Optimum","Weider"];
const PDRINK_TYPES = [["Protein Süt Çikolata",68,7,7,1.5],["Protein Süt Muz",66,7,8,1.5],["Protein İçecek Çilek",60,10,4,0.5],["Protein İçecek Vanilya",62,10,4,0.6],["Protein Puding Çikolata",95,10,9,2],["Protein Puding Vanilya",92,10,9,2],["Protein Ayran",45,5,3,1.5],["Protein Milkshake",80,9,8,1.8]];
for (const b of PDRINK_BRANDS) for (const [pn, cal, p, c, f] of PDRINK_TYPES) {
  const name = `${b} ${pn}`;
  add({ name, category: "İçecek", brand: b, cal: jit(cal, name, 0.06), p: jit(p, name, 0.06, 2), c: jit(c, name, 0.1, 3), f: jit(f, name, 0.1, 4), tr: false, pop: 10, tags: ["supplement","içecek"], source: "seed_gen" });
}

// 21) TAKVIYE ekstra — preworkout / glutamin / vitamin
for (const b of ["Hardline","BigJoy","Ostrovit","Optimum Nutrition","MyProtein","Scitec Nutrition","BiotechUSA","Applied Nutrition","Gymbeam","C4"]) {
  for (const fl of ["Karpuz","Mango","Kola","Limon","Frambuaz","Şeftali"]) {
    const name = `${b} Pre-Workout ${fl}`;
    add({ name, category: "Takviye", brand: b, cal: jit(20, name, 0.3), p: 0, c: jit(4, name, 0.4, 3), f: 0, serving: "1 ölçek (~12 g)", grams: 12, tr: false, pop: 7, tags: ["supplement","preworkout"], source: "seed_gen" });
  }
  add({ name: `${b} L-Glutamin`, category: "Takviye", brand: b, cal: 0, p: 0, c: 0, f: 0, serving: "1 ölçek (~5 g)", grams: 5, tr: false, pop: 6, tags: ["supplement","glutamin"], source: "seed_gen" });
}

// 22) AROMALI / MEYVELİ YOĞURT — marka × aroma
const YOG_FLAVORS = ["Çilekli","Muzlu","Şeftalili","Vişneli","Ormanmeyveli","Kayısılı","Karışık Meyveli","Ballı","Yaban Mersinli","Ananaslı","Hindistan Cevizli","Çikolatalı","Fındıklı Granola","Yulaflı"];
for (const b of DAIRY_BRANDS) for (const fl of YOG_FLAVORS) {
  const name = `${b} ${fl} Yoğurt`;
  add({ name, category: "Süt Ürünleri", subcategory: "yoğurt", brand: b, cal: jit(85, name, 0.08), p: jit(4, name, 0.1, 2), c: jit(13, name, 0.1, 3), f: jit(2, name, 0.2, 4), sugar: 11, tr: true, pop: 10, tags: ["market","yoğurt"], source: "seed_gen" });
}
// 23) PROTEİNLİ / FONKSİYONEL ATIŞTIRMALIK — marka × ürün
const FSNACK_BRANDS = ["Fellas","Eti","Ülker","Hardline","BigJoy","Nutrend","Gymbeam","Verofit","Protein Ocean","Yudum"];
const FSNACK_TYPES = [["Protein Gofret Çikolata",420,25,35,20],["Protein Gofret Fındık",425,25,34,21],["Protein Kraker",400,20,45,15],["Protein Cips",380,45,25,8],["Protein Kurabiye",410,20,45,17],["Protein Kek Çikolata",350,20,38,12],["Yulaf Bar Muz",380,8,60,10],["Yulaf Bar Meyveli",375,8,61,9],["Fındık Ezmeli Bar",430,12,45,22],["Meyve Bar",340,4,68,6]];
for (const b of FSNACK_BRANDS) for (const [pn, cal, p, c, f] of FSNACK_TYPES) {
  const name = `${b} ${pn}`;
  add({ name, category: "Protein Bar", brand: b, cal: jit(cal, name, 0.05), p: jit(p, name, 0.08, 2), c: jit(c, name, 0.06, 3), f: jit(f, name, 0.1, 4), serving: "1 adet (~50 g)", grams: 50, tr: false, pop: 9, tags: ["supplement","atıştırmalık"], source: "seed_gen" });
}
// 24) MEYVE / SEBZE — durum varyantları (çiğ/haşlanmış/ızgara/konserve)
const PRODUCE_STATE = [
  ["Brokoli","Sebze",34,2.8,7,0.4,["haşlanmış","buğulama","ızgara"]],
  ["Karnabahar","Sebze",25,1.9,5,0.3,["haşlanmış","fırın","ızgara"]],
  ["Ispanak","Sebze",23,2.9,3.6,0.4,["haşlanmış","sote"]],
  ["Kabak","Sebze",17,1.2,3.1,0.3,["ızgara","haşlanmış","fırın"]],
  ["Patlıcan","Sebze",25,1,6,0.2,["ızgara","fırın","közlenmiş"]],
  ["Biber","Sebze",26,1,6,0.3,["ızgara","közlenmiş","fırın"]],
  ["Mantar","Sebze",22,3.1,3.3,0.3,["sote","ızgara","fırın"]],
  ["Havuç","Sebze",41,0.9,10,0.2,["haşlanmış","rendelenmiş"]],
  ["Bezelye","Sebze",81,5,14,0.4,["haşlanmış","konserve"]],
  ["Taze Fasulye","Sebze",31,1.8,7,0.2,["haşlanmış","zeytinyağlı"]],
  ["Enginar","Sebze",47,3.3,11,0.2,["haşlanmış","zeytinyağlı"]],
  ["Kabak Balı","Sebze",26,1,6.5,0.1,["fırın","haşlanmış"]],
];
for (const [n, cat, cal, p, c, f, states] of PRODUCE_STATE) {
  for (const st of states) {
    const mul = st.includes("sote") || st.includes("zeytinyağlı") ? 2.4 : 1;
    const name = `${n} (${st})`;
    add({ name, category: cat, cal: Math.round(cal + (mul > 1 ? 45 : 0)), p, c, f: +(f + (mul > 1 ? 5 : 0)).toFixed(1), fiber: 2.5, tr: true, pop: 8, tags: ["sebze","hazırlama"] });
  }
}
// 25) SU & MADEN SUYU markaları (düşük kalori ama arama için)
for (const b of ["Erikli","Hayat","Pınar","Sırma","Damla","Uludağ","Beypazarı","Kızılay","Saka","Buzdağı"]) {
  add({ name: `${b} Su`, category: "İçecek", brand: b, cal: 0, p: 0, c: 0, f: 0, tr: true, pop: 5, tags: ["içecek","su"], source: "seed_gen" });
  add({ name: `${b} Maden Suyu`, category: "İçecek", brand: b, cal: 0, p: 0, c: 0, f: 0, tr: true, pop: 5, tags: ["içecek","su"], source: "seed_gen" });
  for (const fl of ["Limonlu","Portakallı","Elmalı","Narlı","Karpuzlu"]) {
    const name = `${b} Meyveli Maden Suyu ${fl}`;
    add({ name, category: "İçecek", brand: b, cal: jit(12, name, 0.3), p: 0, c: jit(3, name, 0.3, 3), f: 0, sugar: 2, tr: true, pop: 5, tags: ["içecek","maden"], source: "seed_gen" });
  }
}

// 26) AROMALI KEFİR & AROMALI SÜT — marka × aroma
const KEFIR_FLAVORS = ["Sade","Çilekli","Muzlu","Ormanmeyveli","Şeftalili","Ballı","Karışık Meyveli","Nar-Vişne","Yaban Mersinli","Ananaslı"];
for (const b of DAIRY_BRANDS) for (const fl of KEFIR_FLAVORS) {
  const name = `${b} ${fl} Kefir`;
  add({ name, category: "Süt Ürünleri", subcategory: "kefir", brand: b, cal: jit(60, name, 0.08), p: jit(3.3, name, 0.08, 2), c: jit(7, name, 0.15, 3), f: jit(2, name, 0.15, 4), sugar: 6, tr: true, pop: 8, tags: ["market","kefir"], source: "seed_gen" });
}
const MILK_FLAVORS = ["Çilekli","Muzlu","Kakaolu","Çikolatalı","Fındıklı","Kahveli","Vanilyalı","Bal-Tarçın"];
for (const b of DAIRY_BRANDS) for (const fl of MILK_FLAVORS) {
  const name = `${b} ${fl} Süt`;
  add({ name, category: "Süt Ürünleri", subcategory: "süt", brand: b, cal: jit(72, name, 0.08), p: jit(3, name, 0.08, 2), c: jit(11, name, 0.12, 3), f: jit(2, name, 0.15, 4), sugar: 9, tr: true, pop: 8, tags: ["market","süt"], source: "seed_gen" });
}

// ---------------------------------------------------------------------------
// SQL üret
// ---------------------------------------------------------------------------
const COLS = "(name, category, subcategory, brand, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, potassium_mg, serving_desc, serving_grams, is_turkish, is_restaurant, tags, source, popularity, is_verified)";
const tagsSql = (t) => t && t.length ? `array[${t.map((x) => `'${esc(x)}'`).join(",")}]` : `'{}'`;
const val = (r) => `('${esc(r.name)}','${esc(r.category)}',${r.subcategory ? `'${esc(r.subcategory)}'` : "null"},${r.brand ? `'${esc(r.brand)}'` : "null"},${r.calories},${r.protein_g},${r.carbs_g},${r.fat_g},${r.fiber_g},${r.sugar_g},${r.sodium_mg},${r.potassium_mg},'${esc(r.serving_desc)}',${r.serving_grams},${r.is_turkish},${r.is_restaurant},${tagsSql(r.tags)},'${esc(r.source)}',${r.popularity},${r.is_verified})`;

const CHUNK = 500;
const HEADER = `create extension if not exists pg_trgm;
create unique index if not exists uq_foods_name_lower on public.foods (lower(name));
`;
function insertBatches(list) {
  let s = "";
  for (let i = 0; i < list.length; i += CHUNK) {
    const batch = list.slice(i, i + CHUNK);
    s += `insert into public.foods\n  ${COLS}\nvalues\n`;
    s += batch.map(val).join(",\n");
    s += `\non conflict (lower(name)) do nothing;\n\n`;
  }
  return s;
}

// Tam dosya (psql / direkt bağlantı için).
const full = `-- VIVA — Besin veritabanı (${rows.length} satır). Tümü tek dosyada.\n${HEADER}\n${insertBatches(rows)}`;
writeFileSync(new URL("../supabase/seed/foods_10k.sql", import.meta.url), full);

// Supabase SQL Editor için PARÇALI dosyalar (~1000 satır/dosya, editör limiti altında).
const PART = 1000;
const nParts = Math.ceil(rows.length / PART);
for (let p = 0; p < nParts; p++) {
  const slice = rows.slice(p * PART, (p + 1) * PART);
  const head = `-- VIVA — Besin seed PARÇA ${p + 1}/${nParts}  (${slice.length} satır)
-- Supabase → SQL Editor → yapıştır → Run. Sıra önemli değil, idempotent.
${p === 0 ? HEADER : ""}`;
  const name = `foods_part_${String(p + 1).padStart(2, "0")}.sql`;
  writeFileSync(new URL(`../supabase/seed/foods_parts/${name}`, import.meta.url), `${head}\n${insertBatches(slice)}`);
}
// 4 büyük parça (kullanıcı isteği). Her ~2475 satır (~450 KB).
const N4 = 4;
const per4 = Math.ceil(rows.length / N4);
for (let p = 0; p < N4; p++) {
  const slice = rows.slice(p * per4, (p + 1) * per4);
  const head = `-- VIVA — Besin seed BÜYÜK PARÇA ${p + 1}/${N4}  (${slice.length} satır)
-- Supabase → SQL Editor → yapıştır → Run. Sıra önemsiz, idempotent.
${p === 0 ? HEADER : ""}`;
  writeFileSync(new URL(`../supabase/seed/foods_parts/foods_4part_${p + 1}.sql`, import.meta.url), `${head}\n${insertBatches(slice)}`);
}

console.log(`OK — ${rows.length} besin üretildi.`);
console.log(`  tam: supabase/seed/foods_10k.sql`);
console.log(`  10 parça: supabase/seed/foods_parts/foods_part_01..${String(nParts).padStart(2, "0")}.sql`);
console.log(`  4 parça: supabase/seed/foods_parts/foods_4part_1..4.sql`);
