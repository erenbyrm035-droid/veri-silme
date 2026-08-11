#!/usr/bin/env node
// ============================================================================
// Nutrition AI PRO — büyük besin/marka/restoran/tarif seed üreticisi.
// Çıktı: supabase/seed/nutrition_pro.sql  (migration 0035 SONRASI çalıştırılır)
//
// Üretilen veriler:
//   • food_brands   — supplement + market + restoran markaları
//   • foods         — Türk mutfağı + temel besinler + marka ürünleri (kombinatoryal)
//                     + supplement ürünleri (marka × tür × aroma)
//   • restaurant_foods — fast-food / restoran menüleri (yaklaşık değerler)
//   • recipes       — 500+ fit tarif (şablon × varyant)
//
// Not: Marka/supplement/aroma varyantlarının makroları temel profilden türetilir;
// yaklaşık değerlerdir (source='seed_gen'). Gerçek/doğrulanmış değerler CMS'ten
// veya harici API (TÜRKOMP/OpenFoodFacts) ile güncellenebilir.
// ============================================================================
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const OUT = "supabase/seed/nutrition_pro.sql";
const q = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const arr = (a) => (a && a.length ? `array[${a.map(q).join(",")}]` : "'{}'");
const num = (n) => (n == null || Number.isNaN(n) ? "0" : String(Math.round(n * 10) / 10));
const slug = (s) =>
  s.toLowerCase().replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u")
   .replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const foods = [];   // {name, category, subcategory, brand, cal, p, c, f, fiber, sugar, sodium, potassium, serving_desc, serving_grams, is_turkish, is_restaurant, tags, source, popularity}
const seen = new Set();
function addFood(o) {
  const key = o.name.toLowerCase().trim();
  if (seen.has(key)) return;
  seen.add(key);
  foods.push(o);
}
const F = (name, category, cal, p, c, f, extra = {}) =>
  addFood({ name, category, cal, p, c, f, fiber: 0, sugar: 0, sodium: 0, potassium: 0,
    serving_desc: "100 g", serving_grams: 100, is_turkish: true, is_restaurant: false,
    subcategory: null, brand: null, tags: [], source: "seed_tr", popularity: 0, ...extra });

// ---------------------------------------------------------------------------
// 1) TÜRK MUTFAĞI & TEMEL BESİNLER  (per 100 g)
// ---------------------------------------------------------------------------
// Et & Tavuk
F("Tavuk Göğsü (haşlanmış)","Et & Tavuk",165,31,0,3.6,{popularity:95});
F("Tavuk Göğsü (ızgara)","Et & Tavuk",165,31,0,3.6,{popularity:90});
F("Tavuk But (derisiz)","Et & Tavuk",177,24,0,8.5,{popularity:60});
F("Tavuk Kanat","Et & Tavuk",203,30,0,8.1,{popularity:50});
F("Hindi Göğsü","Et & Tavuk",135,30,0,1,{popularity:40});
F("Dana Bonfile","Et & Tavuk",158,27,0,5,{popularity:55});
F("Kırmızı Et (dana, yağsız)","Et & Tavuk",217,26,0,12,{popularity:70});
F("Kıyma (dana %15 yağ)","Et & Tavuk",250,26,0,17,{popularity:80});
F("Kuzu Pirzola","Et & Tavuk",294,25,0,21,{popularity:45});
F("Kuzu İncik","Et & Tavuk",243,28,0,14,{popularity:30});
F("Sucuk","Et & Tavuk",400,22,2,34,{is_turkish:true,popularity:75});
F("Pastırma","Et & Tavuk",240,38,1,9,{popularity:40});
F("Salam","Et & Tavuk",310,15,3,26,{popularity:35});
F("Jambon (hindi)","Et & Tavuk",110,18,2,3,{popularity:30});
F("Ciğer (dana)","Et & Tavuk",135,20,4,4,{popularity:20});
// Balık & Deniz
F("Somon","Balık & Deniz",208,20,0,13,{popularity:70});
F("Somon (füme)","Balık & Deniz",117,18,0,4.3,{popularity:35});
F("Ton Balığı (suda)","Balık & Deniz",116,26,0,1,{popularity:65});
F("Ton Balığı (yağda)","Balık & Deniz",198,29,0,8,{popularity:40});
F("Hamsi","Balık & Deniz",131,20,0,5,{is_turkish:true,popularity:45});
F("Levrek","Balık & Deniz",124,24,0,2.5,{popularity:40});
F("Çipura","Balık & Deniz",115,21,0,3.5,{popularity:38});
F("Uskumru","Balık & Deniz",205,19,0,14,{popularity:30});
F("Sardalya","Balık & Deniz",208,25,0,11,{popularity:25});
F("Karides","Balık & Deniz",99,24,0.2,0.3,{popularity:35});
F("Alabalık","Balık & Deniz",119,20,0,3.5,{popularity:30});
// Yumurta & Süt Ürünleri
F("Yumurta","Yumurta",155,13,1.1,11,{serving_desc:"1 adet (~50 g)",popularity:99});
F("Yumurta Beyazı","Yumurta",52,11,0.7,0.2,{popularity:70});
F("Yumurta Sarısı","Yumurta",322,16,3.6,27,{popularity:40});
F("Yoğurt (tam yağlı)","Süt Ürünleri",61,3.5,4.7,3.3,{popularity:85});
F("Yoğurt (light)","Süt Ürünleri",45,4.5,5,0.5,{popularity:60});
F("Süzme Yoğurt","Süt Ürünleri",97,10,3.6,5,{popularity:80});
F("Kefir","Süt Ürünleri",55,3.3,4.5,2.5,{popularity:45});
F("Ayran","Süt Ürünleri",38,1.7,3,1.5,{is_turkish:true,serving_desc:"1 bardak (200 ml)",popularity:75});
F("Süt (tam yağlı)","Süt Ürünleri",61,3.2,4.8,3.3,{serving_desc:"1 bardak (200 ml)",popularity:80});
F("Süt (yarım yağlı)","Süt Ürünleri",47,3.4,4.9,1.6,{popularity:65});
F("Beyaz Peynir (tam yağlı)","Süt Ürünleri",264,17,2,21,{is_turkish:true,popularity:85});
F("Beyaz Peynir (light)","Süt Ürünleri",180,20,2,10,{popularity:55});
F("Kaşar Peyniri","Süt Ürünleri",330,25,2,25,{is_turkish:true,popularity:80});
F("Lor Peyniri","Süt Ürünleri",98,11,3,4,{popularity:40});
F("Çökelek","Süt Ürünleri",162,25,3,5,{popularity:25});
F("Labne","Süt Ürünleri",255,6,4,24,{popularity:35});
F("Ezine Peyniri","Süt Ürünleri",280,18,1.5,22,{popularity:40});
F("Tulum Peyniri","Süt Ürünleri",355,22,1,29,{popularity:35});
F("Cheddar Peyniri","Süt Ürünleri",402,25,1.3,33,{popularity:40});
F("Mozzarella","Süt Ürünleri",280,22,2.2,20,{popularity:45});
F("Kaymak","Süt Ürünleri",340,3,3,35,{is_turkish:true,popularity:30});
// Baklagiller
F("Mercimek (kırmızı, pişmiş)","Baklagiller",116,9,20,0.4,{is_turkish:true,popularity:70});
F("Mercimek (yeşil, pişmiş)","Baklagiller",116,9,20,0.4,{popularity:45});
F("Nohut (haşlanmış)","Baklagiller",164,9,27,2.6,{popularity:65});
F("Kuru Fasulye (pişmiş)","Baklagiller",127,9,23,0.5,{is_turkish:true,popularity:70});
F("Barbunya (pişmiş)","Baklagiller",127,9,22,0.5,{popularity:40});
F("Bakla","Baklagiller",88,8,18,0.7,{popularity:20});
F("Soya Fasulyesi","Baklagiller",173,17,10,9,{popularity:30});
F("Edamame","Baklagiller",121,12,9,5,{popularity:25});
// Tahıllar
F("Pirinç Pilavı","Tahıllar",130,2.7,28,0.3,{is_turkish:true,popularity:90});
F("Bulgur Pilavı","Tahıllar",83,3,19,0.2,{is_turkish:true,popularity:75});
F("Bulgur (çiğ)","Tahıllar",342,12,76,1.3,{popularity:40});
F("Makarna (haşlanmış)","Tahıllar",131,5,25,1.1,{popularity:85});
F("Tam Buğday Makarna","Tahıllar",124,5,26,0.8,{popularity:45});
F("Yulaf Ezmesi","Tahıllar",389,17,66,7,{popularity:88});
F("Kinoa (pişmiş)","Tahıllar",120,4.4,21,1.9,{popularity:50});
F("Karabuğday","Tahıllar",343,13,72,3.4,{popularity:25});
F("Mısır (haşlanmış)","Tahıllar",96,3.4,21,1.5,{popularity:40});
F("Ekmek (beyaz)","Tahıllar",265,9,49,3.2,{popularity:85});
F("Tam Buğday Ekmeği","Tahıllar",247,13,41,3.4,{popularity:70});
F("Çavdar Ekmeği","Tahıllar",259,9,48,3.3,{popularity:45});
F("Simit","Tahıllar",330,9,55,7,{is_turkish:true,serving_desc:"1 adet (~100 g)",popularity:80});
F("Lavaş","Tahıllar",275,8,52,2,{popularity:40});
F("Yufka","Tahıllar",274,9,55,1,{popularity:35});
F("Galeta Unu","Tahıllar",380,13,72,4,{popularity:20});
// Sebzeler
F("Domates","Sebzeler",18,0.9,3.9,0.2,{popularity:80});
F("Salatalık","Sebzeler",15,0.7,3.6,0.1,{popularity:75});
F("Marul","Sebzeler",15,1.4,2.9,0.2,{popularity:60});
F("Ispanak","Sebzeler",23,2.9,3.6,0.4,{popularity:55});
F("Brokoli","Sebzeler",34,2.8,7,0.4,{popularity:65});
F("Karnabahar","Sebzeler",25,1.9,5,0.3,{popularity:45});
F("Kabak","Sebzeler",17,1.2,3.1,0.3,{popularity:45});
F("Patlıcan","Sebzeler",25,1,6,0.2,{is_turkish:true,popularity:50});
F("Biber (yeşil)","Sebzeler",20,0.9,4.6,0.2,{popularity:50});
F("Patates (haşlanmış)","Sebzeler",87,1.9,20,0.1,{popularity:75});
F("Tatlı Patates","Sebzeler",86,1.6,20,0.1,{popularity:50});
F("Havuç","Sebzeler",41,0.9,10,0.2,{popularity:60});
F("Soğan","Sebzeler",40,1.1,9,0.1,{popularity:55});
F("Sarımsak","Sebzeler",149,6,33,0.5,{popularity:40});
F("Mantar","Sebzeler",22,3.1,3.3,0.3,{popularity:45});
F("Bezelye","Sebzeler",81,5,14,0.4,{popularity:40});
F("Taze Fasulye","Sebzeler",31,1.8,7,0.2,{popularity:40});
F("Pancar","Sebzeler",43,1.6,10,0.2,{popularity:20});
F("Turp","Sebzeler",16,0.7,3.4,0.1,{popularity:20});
F("Avokado","Sebzeler",160,2,9,15,{popularity:70});
// Meyveler
F("Elma","Meyveler",52,0.3,14,0.2,{popularity:85});
F("Muz","Meyveler",89,1.1,23,0.3,{popularity:90});
F("Portakal","Meyveler",47,0.9,12,0.1,{popularity:70});
F("Mandalina","Meyveler",53,0.8,13,0.3,{popularity:55});
F("Çilek","Meyveler",32,0.7,7.7,0.3,{popularity:65});
F("Üzüm","Meyveler",69,0.7,18,0.2,{popularity:60});
F("Karpuz","Meyveler",30,0.6,7.6,0.2,{is_turkish:true,popularity:60});
F("Kavun","Meyveler",34,0.8,8,0.2,{popularity:45});
F("Kayısı","Meyveler",48,1.4,11,0.4,{popularity:40});
F("Şeftali","Meyveler",39,0.9,10,0.3,{popularity:45});
F("Armut","Meyveler",57,0.4,15,0.1,{popularity:45});
F("Kiraz","Meyveler",63,1.1,16,0.2,{popularity:40});
F("İncir (taze)","Meyveler",74,0.8,19,0.3,{popularity:35});
F("Nar","Meyveler",83,1.7,19,1.2,{popularity:45});
F("Ananas","Meyveler",50,0.5,13,0.1,{popularity:40});
F("Kivi","Meyveler",61,1.1,15,0.5,{popularity:40});
F("Yaban Mersini","Meyveler",57,0.7,14,0.3,{popularity:45});
F("Hurma","Meyveler",282,2.5,75,0.4,{popularity:40});
F("Kuru Üzüm","Meyveler",299,3.1,79,0.5,{popularity:35});
F("Kuru Kayısı","Meyveler",241,3.4,63,0.5,{popularity:35});
// Kuruyemiş & Yağlar
F("Badem","Kuruyemiş",579,21,22,50,{popularity:75});
F("Ceviz","Kuruyemiş",654,15,14,65,{popularity:70});
F("Fındık","Kuruyemiş",628,15,17,61,{is_turkish:true,popularity:65});
F("Antep Fıstığı","Kuruyemiş",560,20,28,45,{is_turkish:true,popularity:55});
F("Kaju","Kuruyemiş",553,18,30,44,{popularity:50});
F("Yer Fıstığı","Kuruyemiş",567,26,16,49,{popularity:60});
F("Fıstık Ezmesi","Kuruyemiş",588,25,20,50,{popularity:70});
F("Ay Çekirdeği","Kuruyemiş",584,21,20,51,{popularity:40});
F("Kabak Çekirdeği","Kuruyemiş",559,30,11,49,{popularity:35});
F("Chia Tohumu","Kuruyemiş",486,17,42,31,{popularity:45});
F("Keten Tohumu","Kuruyemiş",534,18,29,42,{popularity:35});
F("Zeytinyağı","Yağlar",884,0,0,100,{serving_desc:"1 yemek kaşığı (~13 g)",popularity:70});
F("Tereyağı","Yağlar",717,0.9,0.1,81,{popularity:60});
F("Ayçiçek Yağı","Yağlar",884,0,0,100,{popularity:50});
F("Hindistan Cevizi Yağı","Yağlar",862,0,0,100,{popularity:35});
F("Zeytin (siyah)","Yağlar",115,0.8,6,11,{is_turkish:true,popularity:55});
F("Zeytin (yeşil)","Yağlar",145,1,4,15,{popularity:50});
F("Tahin","Yağlar",595,17,21,54,{is_turkish:true,popularity:45});
// Türk Yemekleri
F("Mercimek Çorbası","Türk Mutfağı",55,3,9,1,{serving_desc:"1 kase (~250 g)",popularity:85});
F("Ezogelin Çorbası","Türk Mutfağı",60,3,10,1.2,{popularity:55});
F("Yayla Çorbası","Türk Mutfağı",50,2.5,7,1.5,{popularity:40});
F("Menemen","Türk Mutfağı",120,6,5,8,{serving_desc:"1 porsiyon (~200 g)",popularity:75});
F("Kuru Fasulye (yemek)","Türk Mutfağı",140,7,18,4,{popularity:70});
F("Nohut Yemeği","Türk Mutfağı",150,7,20,4.5,{popularity:55});
F("İmam Bayıldı","Türk Mutfağı",130,1.5,10,9,{popularity:40});
F("Karnıyarık","Türk Mutfağı",160,7,12,9,{popularity:45});
F("Dolma (zeytinyağlı)","Türk Mutfağı",180,3,25,7,{popularity:50});
F("Sarma (yaprak)","Türk Mutfağı",190,3,26,8,{popularity:50});
F("Köfte (ızgara)","Türk Mutfağı",240,18,6,16,{popularity:80});
F("İçli Köfte","Türk Mutfağı",250,8,28,12,{popularity:45});
F("Mantı","Türk Mutfağı",190,8,28,5,{serving_desc:"1 porsiyon (~200 g)",popularity:70});
F("Lahmacun","Türk Mutfağı",210,10,30,6,{serving_desc:"1 adet (~120 g)",popularity:75});
F("Pide (kıymalı)","Türk Mutfağı",270,12,35,9,{popularity:70});
F("Pide (kaşarlı)","Türk Mutfağı",290,13,34,12,{popularity:65});
F("Döner (et)","Türk Mutfağı",280,20,8,19,{popularity:85});
F("Tavuk Döner","Türk Mutfağı",220,22,7,11,{popularity:85});
F("İskender","Türk Mutfağı",250,15,18,13,{serving_desc:"1 porsiyon (~300 g)",popularity:75});
F("Adana Kebap","Türk Mutfağı",290,19,4,22,{popularity:70});
F("Urfa Kebap","Türk Mutfağı",270,19,4,20,{popularity:55});
F("Şiş Kebap","Türk Mutfağı",210,26,2,11,{popularity:60});
F("Tavuk Şiş","Türk Mutfağı",180,25,3,7,{popularity:65});
F("Çiğ Köfte (etsiz)","Türk Mutfağı",160,4,32,2,{popularity:60});
F("Gözleme (peynirli)","Türk Mutfağı",250,9,32,10,{popularity:55});
F("Börek (peynirli)","Türk Mutfağı",290,9,30,15,{popularity:60});
F("Su Böreği","Türk Mutfağı",270,10,30,12,{popularity:45});
F("Pilav (bulgurlu)","Türk Mutfağı",120,3,22,2,{popularity:55});
F("Kısır","Türk Mutfağı",150,3.5,26,4,{popularity:50});
F("Tarhana Çorbası","Türk Mutfağı",65,2.5,11,1.5,{popularity:35});
F("Cacık","Türk Mutfağı",45,2,4,2.5,{popularity:45});
F("Haydari","Türk Mutfağı",120,5,4,9,{popularity:35});
F("Humus","Türk Mutfağı",166,8,14,10,{popularity:50});
// Kahvaltılık & Tatlı & İçecek
F("Bal","Türk Kahvaltısı",304,0.3,82,0,{is_turkish:true,popularity:60});
F("Reçel (vişne)","Türk Kahvaltısı",250,0.4,65,0,{popularity:40});
F("Pekmez","Türk Kahvaltısı",293,0,74,0,{is_turkish:true,popularity:35});
F("Tahin-Pekmez","Türk Kahvaltısı",450,8,45,25,{popularity:35});
F("Poğaça","Fırın",320,7,40,14,{is_turkish:true,serving_desc:"1 adet (~70 g)",popularity:60});
F("Açma","Fırın",340,8,45,14,{popularity:45});
F("Baklava","Tatlı",430,6,50,23,{is_turkish:true,serving_desc:"1 dilim (~60 g)",popularity:60});
F("Sütlaç","Tatlı",130,3.5,22,3,{popularity:50});
F("Künefe","Tatlı",350,7,40,18,{popularity:45});
F("Kazandibi","Tatlı",150,4,26,3,{popularity:30});
F("Lokum","Tatlı",330,0.2,83,0.1,{popularity:35});
F("Helva (tahin)","Tatlı",520,12,50,30,{popularity:40});
F("Dondurma (sade)","Tatlı",207,3.5,24,11,{popularity:55});
F("Çay (şekersiz)","İçecekler",1,0,0.2,0,{serving_desc:"1 bardak",popularity:70});
F("Türk Kahvesi (sade)","İçecekler",2,0.1,0.3,0,{popularity:55});
F("Filtre Kahve (sade)","İçecekler",2,0.3,0,0,{popularity:60});
F("Portakal Suyu","İçecekler",45,0.7,10,0.2,{popularity:50});
F("Kola","İçecekler",42,0,10.6,0,{serving_desc:"1 kutu (330 ml)",popularity:60});
F("Kola (şekersiz)","İçecekler",0.3,0,0,0,{popularity:55});
F("Soda","İçecekler",0,0,0,0,{popularity:45});
F("Şalgam","İçecekler",8,0.5,1.5,0,{is_turkish:true,popularity:30});
F("Limonata","İçecekler",40,0.1,10,0,{popularity:40});

// ---------------------------------------------------------------------------
// 2) MARKALAR
// ---------------------------------------------------------------------------
const brands = [
  // Supplement
  ["Optimum Nutrition","supplement"],["Hardline","supplement"],["BigJoy","supplement"],
  ["Proteinocean","supplement"],["Scitec Nutrition","supplement"],["Olimp","supplement"],
  ["MyProtein","supplement"],["Dymatize","supplement"],["BSN","supplement"],
  ["Muscletech","supplement"],["Weider","supplement"],["Supplementler","supplement"],
  // Market
  ["Pınar","supermarket"],["Sütaş","supermarket"],["İçim","supermarket"],["Torku","supermarket"],
  ["Eti","supermarket"],["Ülker","supermarket"],["Migros","supermarket"],["A101","supermarket"],
  ["BİM","supermarket"],["ŞOK","supermarket"],["Tarım Kredi","supermarket"],["Namet","supermarket"],
  ["Banvit","supermarket"],["Dr. Oetker","supermarket"],["Yayla","supermarket"],
  // Restoran
  ["Burger King","restaurant"],["McDonald's","restaurant"],["KFC","restaurant"],
  ["Popeyes","restaurant"],["Tavuk Dünyası","restaurant"],["HD İskender","restaurant"],
  ["Köfteci Yusuf","restaurant"],["Domino's","restaurant"],["Little Caesars","restaurant"],
  ["Subway","restaurant"],["Starbucks","restaurant"],["Simit Sarayı","restaurant"],
];

// ---------------------------------------------------------------------------
// 3) SUPPLEMENT ÜRÜNLERİ (marka × tür × aroma) — yaklaşık makrolar (porsiyon başı → 100g'a normalize edilir)
// ---------------------------------------------------------------------------
const suppBrands = brands.filter((b) => b[1] === "supplement").map((b) => b[0]);
const wheyFlavors = ["Çikolata","Vanilya","Çilek","Muz","Bisküvi","Fındık","Karamel","Cookies & Cream","Kahve","Beyaz Çikolata","Muzlu Çikolata","Frambuaz","Antep Fıstıklı","Hindistan Cevizi","Tiramisu","Salted Caramel","Çikolata-Fındık","Limonlu Cheesecake","Kavun","Şeftali"];
// Whey Protein: ~ per 100g: 400 kcal, 78 p, 8 c, 6 f (aromaya göre ufak varyasyon)
for (const b of suppBrands) {
  for (const fl of wheyFlavors) {
    const cal = 400 + (fl.includes("Çikolata") ? 8 : 0);
    F(`${b} Whey Protein ${fl}`,"Protein Tozu",cal,78,8,6,
      {brand:b,subcategory:"whey",serving_desc:"1 ölçek (~30 g)",serving_grams:30,is_turkish:false,tags:["supplement","protein","whey"],source:"seed_gen",popularity:30});
  }
  // Izole
  for (const fl of wheyFlavors.slice(0,12)) {
    F(`${b} İzole Whey ${fl}`,"Protein Tozu",370,88,2,1,
      {brand:b,subcategory:"isolate",serving_desc:"1 ölçek (~30 g)",serving_grams:30,is_turkish:false,tags:["supplement","protein","isolate"],source:"seed_gen",popularity:20});
  }
  // Casein
  for (const fl of wheyFlavors.slice(0,8)) {
    F(`${b} Casein ${fl}`,"Protein Tozu",360,75,10,3,
      {brand:b,subcategory:"casein",serving_desc:"1 ölçek (~30 g)",serving_grams:30,is_turkish:false,tags:["supplement","protein","casein"],source:"seed_gen",popularity:12});
  }
  // Vegan protein
  for (const fl of wheyFlavors.slice(0,6)) {
    F(`${b} Vegan Protein ${fl}`,"Protein Tozu",380,75,10,5,
      {brand:b,subcategory:"vegan",serving_desc:"1 ölçek (~30 g)",serving_grams:30,is_turkish:false,tags:["supplement","protein","vegan"],source:"seed_gen",popularity:10});
  }
  // Mass gainer aromalar
  for (const fl of ["Çikolata","Vanilya","Muz","Çilek","Bisküvi"]) {
    F(`${b} Mass Gainer ${fl}`,"Protein Tozu",380,20,60,6,
      {brand:b,subcategory:"gainer",serving_desc:"1 ölçek (~100 g)",serving_grams:100,is_turkish:false,tags:["supplement","gainer"],source:"seed_gen",popularity:12});
  }
}
// Protein Bar (marka × aroma)
const barFlavors = ["Çikolata","Fıstık Ezmesi","Karamel","Bisküvi","Fındık","Brownie","Cookies & Cream","Beyaz Çikolata","Muz","Frambuaz"];
for (const b of suppBrands) {
  for (const fl of barFlavors) {
    F(`${b} Protein Bar ${fl}`,"Protein Bar",360,32,36,10,
      {brand:b,subcategory:"bar",serving_desc:"1 bar (~60 g)",serving_grams:60,is_turkish:false,tags:["supplement","bar"],source:"seed_gen",popularity:18});
  }
}
// Diğer supplementler (marka × ürün)
const suppProducts = [
  ["Kreatin Monohidrat","Supplement",0,0,0,0,{sub:"creatine",serving:"5 g",g:5}],
  ["BCAA","Supplement",40,8,2,0,{sub:"bcaa",serving:"10 g",g:10}],
  ["Glutamin","Supplement",0,0,0,0,{sub:"glutamine",serving:"5 g",g:5}],
  ["Pre-Workout","Supplement",20,1,4,0,{sub:"preworkout",serving:"12 g",g:12}],
  ["Mass Gainer Çikolata","Protein Tozu",380,20,60,6,{sub:"gainer",serving:"100 g",g:100}],
  ["L-Carnitine","Supplement",5,1,0,0,{sub:"carnitine",serving:"5 ml",g:5}],
  ["Omega-3 Balık Yağı","Supplement",900,0,0,100,{sub:"omega3",serving:"1 kapsül",g:1}],
  ["Multivitamin","Supplement",0,0,0,0,{sub:"vitamin",serving:"1 tablet",g:1}],
  ["ZMA","Supplement",0,0,0,0,{sub:"zma",serving:"1 kapsül",g:1}],
  ["Whey Protein (aromasız)","Protein Tozu",395,80,6,6,{sub:"whey",serving:"30 g",g:30}],
];
for (const b of suppBrands) {
  for (const [pname,cat,cal,p,c,f,ex] of suppProducts) {
    F(`${b} ${pname}`,cat,cal,p,c,f,
      {brand:b,subcategory:ex.sub,serving_desc:ex.serving,serving_grams:ex.g,is_turkish:false,tags:["supplement",ex.sub],source:"seed_gen",popularity:10});
  }
}

// ---------------------------------------------------------------------------
// 4) MARKET MARKA ÜRÜNLERİ (marka × ürün) — yaklaşık makrolar
// ---------------------------------------------------------------------------
const dairyBrands = ["Pınar","Sütaş","İçim","Torku","Tarım Kredi","Yayla"];
const dairyProducts = [
  ["Tam Yağlı Süt","Süt Ürünleri",61,3.2,4.8,3.3],
  ["Yarım Yağlı Süt","Süt Ürünleri",47,3.4,4.9,1.6],
  ["Laktozsuz Süt","Süt Ürünleri",46,3.3,4.7,1.5],
  ["Tam Yağlı Yoğurt","Süt Ürünleri",61,3.5,4.7,3.3],
  ["Light Yoğurt","Süt Ürünleri",45,4.5,5,0.5],
  ["Süzme Yoğurt","Süt Ürünleri",97,10,3.6,5],
  ["Kefir","Süt Ürünleri",55,3.3,4.5,2.5],
  ["Ayran","Süt Ürünleri",38,1.7,3,1.5],
  ["Beyaz Peynir","Süt Ürünleri",264,17,2,21],
  ["Light Beyaz Peynir","Süt Ürünleri",180,20,2,10],
  ["Kaşar Peyniri","Süt Ürünleri",330,25,2,25],
  ["Labne","Süt Ürünleri",255,6,4,24],
  ["Tereyağı","Yağlar",717,0.9,0.1,81],
];
for (const b of dairyBrands) {
  for (const [pname,cat,cal,p,c,f] of dairyProducts) {
    F(`${b} ${pname}`,cat,cal,p,c,f,
      {brand:b,serving_desc:"100 g",serving_grams:100,tags:["market","dairy"],source:"seed_gen",popularity:15});
  }
}
// Et/şarküteri markaları
const meatBrands = ["Namet","Pınar","Banvit"];
const meatProducts = [
  ["Hindi Salam","Et & Tavuk",110,15,3,4],["Hindi Jambon","Et & Tavuk",95,17,2,2.5],
  ["Dana Sucuk","Et & Tavuk",380,20,2,32],["Tavuk Sosis","Et & Tavuk",230,13,4,18],
  ["Dana Sosis","Et & Tavuk",290,12,3,26],["Pastırma","Et & Tavuk",240,38,1,9],
  ["Tavuk Göğsü Füme","Et & Tavuk",120,23,1,3],
];
for (const b of meatBrands) {
  for (const [pname,cat,cal,p,c,f] of meatProducts) {
    F(`${b} ${pname}`,cat,cal,p,c,f,{brand:b,tags:["market","meat"],source:"seed_gen",popularity:12});
  }
}
// Atıştırmalık / bisküvi (Eti, Ülker)
const snackBrands = ["Eti","Ülker"];
const snackProducts = [
  ["Çikolatalı Gofret","Atıştırmalık",520,6,60,28,"1 paket (~35 g)",35],
  ["Kremalı Bisküvi","Atıştırmalık",480,6,68,20,"1 paket (~40 g)",40],
  ["Sütlü Çikolata","Atıştırmalık",540,7,58,31,"1 bar (~30 g)",30],
  ["Bitter Çikolata","Atıştırmalık",530,5,50,34,"1 bar (~30 g)",30],
  ["Kek (kakaolu)","Fırın",400,5,55,17,"1 adet (~40 g)",40],
  ["Grissini","Atıştırmalık",420,12,72,8,"1 paket (~30 g)",30],
  ["Tuzlu Kraker","Atıştırmalık",450,9,68,15,"1 paket (~30 g)",30],
  ["Yulaf Bar","Atıştırmalık",380,7,60,12,"1 bar (~35 g)",35],
];
for (const b of snackBrands) {
  for (const [pname,cat,cal,p,c,f,sd,g] of snackProducts) {
    F(`${b} ${pname}`,cat,cal,p,c,f,{brand:b,serving_desc:sd,serving_grams:g,tags:["market","snack"],source:"seed_gen",popularity:14});
  }
}

// ---------------------------------------------------------------------------
// 5) RESTORAN / FAST-FOOD MENÜLERİ  (yaklaşık; is_estimated=true)
// ---------------------------------------------------------------------------
const restaurantFoods = [];
const R = (rest, item, cat, cal, p, c, f, sd) =>
  restaurantFoods.push({ rest, item, cat, cal, p, c, f, sd });
// Burger King
R("Burger King","Whopper","burger",657,28,49,40,"1 adet");
R("Burger King","Whopper Menü","menu",1100,35,120,52,"orta boy");
R("Burger King","Double Whopper","burger",900,48,50,58,"1 adet");
R("Burger King","Chicken Royale","burger",560,25,49,29,"1 adet");
R("Burger King","King Chicken","burger",620,30,52,32,"1 adet");
R("Burger King","Patates (orta)","yan",340,4,44,17,"orta");
R("Burger King","Soğan Halkası","yan",410,6,50,20,"9 adet");
R("Burger King","Sundae Çikolata","tatlı",280,5,45,9,"1 adet");
// McDonald's
R("McDonald's","Big Mac","burger",563,26,45,33,"1 adet");
R("McDonald's","Big Mac Menü","menu",1080,33,128,48,"orta boy");
R("McDonald's","McChicken","burger",400,14,39,21,"1 adet");
R("McDonald's","Cheeseburger","burger",303,15,30,13,"1 adet");
R("McDonald's","Double Cheeseburger","burger",445,25,34,23,"1 adet");
R("McDonald's","McNuggets (9)","tavuk",417,24,26,25,"9 parça");
R("McDonald's","Patates (orta)","yan",330,4,42,16,"orta");
R("McDonald's","McFlurry","tatlı",340,8,54,11,"1 adet");
// KFC
R("KFC","Original Recipe Göğüs","tavuk",320,29,11,18,"1 parça");
R("KFC","Kanat (2 adet)","tavuk",260,18,10,17,"2 parça");
R("KFC","Twister","burger",480,22,45,24,"1 adet");
R("KFC","Kova (8 parça)","tavuk",1600,110,55,95,"8 parça");
R("KFC","Popcorn Tavuk","tavuk",400,20,28,24,"orta");
R("KFC","Patates (orta)","yan",320,4,40,16,"orta");
// Popeyes
R("Popeyes","Tavuk Göğüs","tavuk",380,30,16,22,"1 parça");
R("Popeyes","Chicken Sandwich","burger",700,28,50,42,"1 adet");
R("Popeyes","Tenders (3)","tavuk",340,24,20,18,"3 parça");
// Tavuk Dünyası / Tavuk Döner
R("Tavuk Dünyası","Tavuk Döner Dürüm","dürüm",520,30,55,18,"1 adet");
R("Tavuk Dünyası","Izgara Tavuk Menü","menu",650,45,60,22,"1 porsiyon");
R("Tavuk Dünyası","Kanat Basket","tavuk",560,35,30,32,"1 porsiyon");
// HD İskender
R("HD İskender","İskender (1 porsiyon)","yemek",780,38,50,45,"1 porsiyon");
R("HD İskender","İskender (1.5 porsiyon)","yemek",1100,55,72,64,"1.5 porsiyon");
// Köfteci Yusuf
R("Köfteci Yusuf","Köfte Ekmek","yemek",550,28,45,28,"1 porsiyon");
R("Köfteci Yusuf","Köfte Porsiyon","yemek",620,35,30,40,"1 porsiyon");
// Domino's / Little Caesars (pizza dilim)
R("Domino's","Margarita Pizza (dilim)","pizza",210,9,26,8,"1 dilim");
R("Domino's","Sucuklu Pizza (dilim)","pizza",260,11,27,12,"1 dilim");
R("Little Caesars","Pepperoni Pizza (dilim)","pizza",280,12,30,13,"1 dilim");
// Subway
R("Subway","Ton Balıklı Sub (15cm)","sandviç",470,20,44,22,"15 cm");
R("Subway","Izgara Tavuk Sub (15cm)","sandviç",330,26,45,6,"15 cm");
R("Subway","Hindi Füme Sub (15cm)","sandviç",280,18,46,4,"15 cm");
// Starbucks / Simit Sarayı
R("Starbucks","Caffe Latte (Grande)","içecek",190,10,19,7,"grande süt");
R("Starbucks","Cappuccino (Grande)","içecek",120,8,12,4,"grande");
R("Simit Sarayı","Simit","fırın",300,9,52,6,"1 adet");
R("Simit Sarayı","Peynirli Poğaça","fırın",320,8,38,15,"1 adet");

// ---------------------------------------------------------------------------
// 6) TARİFLER (500+) — şablon × varyant
// ---------------------------------------------------------------------------
const recipes = [];
const seenR = new Set();
function addRecipe(name, category, cal, p, c, f, tags, servings = 1, prep = 10, cook = 15) {
  const s = slug(name);
  if (seenR.has(s)) return;
  seenR.add(s);
  recipes.push({ name, slug: s, category, cal, p, c, f, tags, servings, prep, cook });
}
// Kahvaltı — yulaf/omlet bazlı varyantlar
const oatToppings = ["Muz","Çilek","Yaban Mersini","Fıstık Ezmesi","Bal","Hurma","Elma-Tarçın","Kakao","Ceviz","Badem","Chia","Antep Fıstığı"];
for (const t of oatToppings) addRecipe(`${t}lı Protein Yulaf`,"breakfast",350,24,45,8,["kahvaltı","yulaf","protein"]);
const omeletKinds = ["Peynirli","Ispanaklı","Mantarlı","Domatesli","Sebzeli","Ton Balıklı","Hindi Jambonlu","Brokolili","Biberli","Kaşarlı"];
for (const t of omeletKinds) addRecipe(`${t} Protein Omlet`,"breakfast",300,26,6,20,["kahvaltı","yumurta","protein"]);
const smoothieBase = ["Muz","Çilek","Yaban Mersini","Mango","Ananas","Şeftali","Vişne","Karışık Meyve","Ispanak-Elma","Fıstık Ezmeli Muz","Kakaolu","Hurma-Tarçın"];
for (const t of smoothieBase) addRecipe(`${t} Protein Smoothie`,"smoothie",280,25,35,4,["smoothie","protein"]);
// Öğle/Akşam — protein × garnitür
const proteins = ["Izgara Tavuk","Izgara Köfte","Fırın Somon","Izgara Hindi","Dana Bonfile","Izgara Ton","Tavuk Sote","Etli Sebze","Fırın Tavuk But","Izgara Levrek","Fırın Köfte","Tavuk Şiş","Kıymalı Sebze","Izgara Çipura","Hindi Sote","Fırın Hindi"];
const sides = ["Bulgur Pilavı","Kinoa","Fırın Sebze","Yeşil Salata","Haşlanmış Brokoli","Tatlı Patates","Esmer Pirinç","Közlenmiş Sebze","Nohut Salatası","Mercimek","Fırın Patates","Sebzeli Kuskus","Ispanak Sote","Karnabahar Pürezi","Avokadolu Salata","Bulgurlu Kısır"];
for (const pr of proteins) {
  for (const sd of sides) {
    addRecipe(`${pr} & ${sd}`, "lunch", 450, 38, 35, 15, ["öğle","yüksek protein"], 1, 15, 20);
  }
}
// Kase (bowl) tarifleri — baz × sos
const bowlBase = ["Tavuklu Buddha Bowl","Ton Balıklı Bowl","Kinoa Bowl","Falafel Bowl","Somonlu Poke Bowl","Hindili Bowl","Etli Burrito Bowl","Yumurtalı Kahvaltı Bowl"];
const bowlSauce = ["Yoğurt Soslu","Tahinli","Avokadolu","Acılı","Zeytinyağlı","Limonlu"];
for (const b of bowlBase) for (const s of bowlSauce) addRecipe(`${s} ${b}`, "lunch", 480, 32, 45, 16, ["bowl","dengeli"]);
// Wrap / sandviç
const wraps = ["Izgara Tavuklu Wrap","Ton Balıklı Wrap","Hindi Füme Wrap","Falafel Wrap","Köfteli Wrap","Sebzeli Wrap","Yumurtalı Wrap","Peynirli Wrap"];
for (const w of wraps) addRecipe(w, "lunch", 400, 28, 40, 13, ["wrap","pratik"]);
// Akşam hafif
const dinners = ["Sebzeli Tavuk Sote","Fırın Sebzeli Somon","Zeytinyağlı Enginar","Mercimek Köftesi","Izgara Sebze Tabağı","Tavuklu Salata","Ton Balıklı Salata","Yumurtalı Ispanak","Karnabahar Pilavı","Sebzeli Omlet","Fırın Köfte Sebze","Kabak Mücver (fırın)"];
for (const d of dinners) addRecipe(d, "dinner", 380, 30, 25, 16, ["akşam","hafif"]);
// Snack
const snacks = ["Süzme Yoğurt & Ceviz","Yumurta & Salatalık","Protein Bar (ev yapımı)","Badem & Elma","Humus & Havuç","Peynir & Domates","Fıstık Ezmeli Pirinç Patlağı","Lor & Bal","Muz & Fıstık Ezmesi","Yoğurt & Yaban Mersini","Haşlanmış Yumurta (2)","Cottage Cheese Kase"];
for (const s of snacks) addRecipe(s, "snack", 200, 15, 15, 9, ["snack","ara öğün"]);
// Tatlı (fit)
const desserts = ["Protein Cheesecake","Muzlu Protein Kek","Yulaflı Kurabiye","Chia Puding","Kakaolu Protein Puding","Elmalı Tarçınlı Kek","Fıstık Ezmeli Top","Protein Brownie","Yoğurtlu Dondurma","Hurmalı Enerji Topu"];
for (const d of desserts) addRecipe(d, "dessert", 250, 18, 28, 9, ["tatlı","fit"]);
// Protein tarifleri
const proteinRecipes = ["Protein Pancake","Protein Waffle","Protein Muffin","Yüksek Proteinli Wrap","Protein Pizza (tavuk bazlı)","Skyr Protein Kase","Protein Böreği","Fıstık Ezmeli Protein Bar","Peynirli Protein Ekmek","Protein Muhallebi"];
for (const d of proteinRecipes) addRecipe(d, "protein", 320, 30, 25, 11, ["protein","yüksek protein"]);
// Çorbalar (fit)
const soups = ["Mercimek Çorbası","Ezogelin Çorbası","Yayla Çorbası","Domates Çorbası","Brokoli Çorbası","Tavuk Suyu Çorba","Sebze Çorbası","Kabak Çorbası","Karnabahar Çorbası","Tarhana Çorbası","Mantar Çorbası","Nohut Çorbası"];
for (const s of soups) addRecipe(`Fit ${s}`, "dinner", 120, 8, 16, 3, ["çorba","hafif","akşam"]);
// Dünya mutfağı (protein odaklı fit uyarlamalar)
const world = ["Tavuklu Teriyaki","Fit Tavuklu Fajita","Izgara Tavuklu Sezar Salata","Karidesli Sote","Tavuklu Curry (light)","Ton Balıklı Niçe Salata","Etli Chili con Carne","Sebzeli Stir-Fry","Fit Tavuklu Şavurma","Somonlu Teriyaki","Hindi Köftesi (İtalyan)","Tavuklu Pad Thai (light)","Falafel Tabağı","Izgara Biftek Salata","Tavuklu Enchilada (fit)","Karnıbahar Pizza"];
for (const w of world) addRecipe(w, "dinner", 420, 34, 30, 16, ["dünya mutfağı","protein"]);
// Ek smoothie/kahvaltı
const extraBreakfast = ["Yumurtalı Avokado Tost","Peynirli Yulaf Kase","Chia Yulaf Puding","Cottage Cheese Tost","Menemen (light)","Şakşuka Yumurta","Labneli Kahvaltı Kase","Fıstık Ezmeli Muzlu Tost","Yoğurtlu Granola Kase","Proteinli French Toast"];
for (const b of extraBreakfast) addRecipe(b, "breakfast", 330, 22, 30, 13, ["kahvaltı"]);
// Salatalar (protein × yeşillik)
const saladProt = ["Izgara Tavuklu","Ton Balıklı","Hindi Füme","Yumurtalı","Peynirli","Nohutlu","Somonlu","Köfteli"];
const saladBase = ["Sezar Salata","Akdeniz Salata","Yeşil Salata","Avokadolu Salata","Kinoa Salata","Mevsim Salata"];
for (const p of saladProt) for (const s of saladBase) addRecipe(`${p} ${s}`, "lunch", 320, 26, 18, 15, ["salata","hafif"]);
// Ek tatlı & snack & smoothie
const extraDessert = ["Muzlu Yulaf Kurabiye","Protein Sufle","Yoğurtlu Meyve Kase","Cheesecake Kavanoz","Kabaklı Brownie","Hurmalı Tahin Topu","Elmalı Yulaf Krep","Protein Mousse","Fırında Elma","Kakaolu Chia Puding"];
for (const d of extraDessert) addRecipe(d, "dessert", 220, 14, 26, 8, ["tatlı","fit"]);
const extraSnack = ["Enerji Topu (hurma-ceviz)","Protein Smoothie Kase","Közlenmiş Nohut","Yoğurtlu Meyve Bar","Tam Buğday Kraker & Peynir","Fıstık Ezmeli Elma Dilim","Süzme Yoğurt & Granola","Haşlanmış Yumurta & Avokado","Edamame Atıştırmalık","Protein Popcorn"];
for (const s of extraSnack) addRecipe(s, "snack", 190, 12, 18, 8, ["snack"]);
const extraSmoothie = ["Yeşil Detoks Smoothie","Tropikal Protein Smoothie","Kahveli Protein Shake","Böğürtlenli Smoothie","Fındık Ezmeli Kakao Shake","Avokadolu Yeşil Shake"];
for (const s of extraSmoothie) addRecipe(s, "smoothie", 260, 22, 30, 6, ["smoothie","protein"]);

// ---------------------------------------------------------------------------
// SQL üretimi
// ---------------------------------------------------------------------------
let sql = `-- ============================================================================
-- Nutrition AI PRO — seed verisi (OTOMATİK ÜRETİLDİ: scripts/build-nutrition-seed.mjs)
-- Migration 0035 SONRASI çalıştırılır. Idempotent (upsert / on conflict).
-- Besin: ${foods.length} · Marka: ${brands.length} · Restoran öğe: ${restaurantFoods.length} · Tarif: ${recipes.length}
-- ============================================================================
begin;

-- Idempotentlik: lower(name) benzersiz olmalı (upsert için). Önce yinelenenleri temizle.
delete from public.foods a using public.foods b
  where a.ctid < b.ctid and lower(a.name) = lower(b.name);
create unique index if not exists uq_foods_name_lower on public.foods (lower(name));

`;

// Markalar
sql += "-- Markalar --------------------------------------------------------------------\n";
sql += "insert into public.food_brands (slug, name, category) values\n";
sql += brands.map(([n, c]) => `  (${q(slug(n))}, ${q(n)}, ${q(c)})`).join(",\n");
sql += "\non conflict (slug) do update set name = excluded.name, category = excluded.category;\n\n";

// Foods
sql += "-- Besinler --------------------------------------------------------------------\n";
const foodCols = "(name, category, subcategory, brand, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, potassium_mg, serving_desc, serving_grams, is_turkish, is_restaurant, tags, source, popularity, is_verified)";
// Toplu insert'i parça parça (her 500 satır) yaz — tek dev statement yerine.
const chunk = 400;
for (let i = 0; i < foods.length; i += chunk) {
  const slice = foods.slice(i, i + chunk);
  sql += `insert into public.foods\n  ${foodCols}\nvalues\n`;
  sql += slice.map((o) =>
    `  (${q(o.name)}, ${q(o.category)}, ${q(o.subcategory)}, ${q(o.brand)}, ${num(o.cal)}, ${num(o.p)}, ${num(o.c)}, ${num(o.f)}, ${num(o.fiber)}, ${num(o.sugar)}, ${num(o.sodium)}, ${num(o.potassium)}, ${q(o.serving_desc)}, ${num(o.serving_grams)}, ${o.is_turkish}, ${o.is_restaurant}, ${arr(o.tags)}, ${q(o.source)}, ${o.popularity}, ${o.source === "seed_tr"})`
  ).join(",\n");
  sql += `\non conflict (lower(name)) do update set
    category = excluded.category, brand = excluded.brand, calories = excluded.calories,
    protein_g = excluded.protein_g, carbs_g = excluded.carbs_g, fat_g = excluded.fat_g,
    serving_desc = excluded.serving_desc, serving_grams = excluded.serving_grams,
    tags = excluded.tags, popularity = excluded.popularity;\n\n`;
}

// foods.brand_id'yi marka adına göre bağla
sql += `-- Besinleri markalara bağla ---------------------------------------------------
update public.foods f set brand_id = b.id
  from public.food_brands b where f.brand is not null and lower(f.brand) = lower(b.name) and f.brand_id is null;\n\n`;

// Restaurant foods
sql += "-- Restoran menüleri -----------------------------------------------------------\n";
sql += "insert into public.restaurant_foods (restaurant, item_name, category, calories, protein_g, carbs_g, fat_g, serving_desc, is_estimated) values\n";
sql += restaurantFoods.map((r) =>
  `  (${q(r.rest)}, ${q(r.item)}, ${q(r.cat)}, ${num(r.cal)}, ${num(r.p)}, ${num(r.c)}, ${num(r.f)}, ${q(r.sd)}, true)`
).join(",\n");
sql += "\non conflict (lower(restaurant), lower(item_name)) do update set\n";
sql += "  calories = excluded.calories, protein_g = excluded.protein_g, carbs_g = excluded.carbs_g, fat_g = excluded.fat_g;\n\n";
// Restoran öğelerini foods'a da ekle (arama tek noktadan)
sql += `-- Restoran öğelerini foods'a yansıt (aramada çıksın) --------------------------
insert into public.foods (name, category, brand, calories, protein_g, carbs_g, fat_g, serving_desc, serving_grams, is_turkish, is_restaurant, tags, source, popularity)
select rf.item_name || ' (' || rf.restaurant || ')', 'Restoran', rf.restaurant,
       rf.calories, rf.protein_g, rf.carbs_g, rf.fat_g, coalesce(rf.serving_desc,'1 porsiyon'),
       coalesce(rf.serving_grams, 200), false, true, array['restoran','fastfood'], 'seed_rest', 8
from public.restaurant_foods rf
on conflict (lower(name)) do nothing;\n\n`;

// Recipes
sql += "-- Tarifler --------------------------------------------------------------------\n";
for (let i = 0; i < recipes.length; i += chunk) {
  const slice = recipes.slice(i, i + chunk);
  sql += "insert into public.recipes (slug, name, category, calories, protein_g, carbs_g, fat_g, servings, prep_minutes, cook_minutes, tags, status) values\n";
  sql += slice.map((r) =>
    `  (${q(r.slug)}, ${q(r.name)}, ${q(r.category)}, ${num(r.cal)}, ${num(r.p)}, ${num(r.c)}, ${num(r.f)}, ${r.servings}, ${r.prep}, ${r.cook}, ${arr(r.tags)}, 'published')`
  ).join(",\n");
  sql += "\non conflict (slug) do update set name = excluded.name, category = excluded.category,\n";
  sql += "  calories = excluded.calories, protein_g = excluded.protein_g, carbs_g = excluded.carbs_g, fat_g = excluded.fat_g, status = 'published';\n\n";
}

sql += "commit;\n";

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, sql);
console.log(`✓ ${OUT} yazıldı`);
console.log(`  Besin: ${foods.length} | Marka: ${brands.length} | Restoran: ${restaurantFoods.length} | Tarif: ${recipes.length}`);
