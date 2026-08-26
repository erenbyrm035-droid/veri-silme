#!/usr/bin/env node
// ============================================================================
// TWA kabuğunun bağlandığı alan adını değiştirir.
//
// NEDEN VAR: adres dört ayrı dosyada, farklı biçimlerde geçiyor —
// AndroidManifest'te ham host, strings.xml'de kaçırılmış tırnaklı JSON,
// bir de manifest URL'i. Elle düzeltirken birini atlamak kolay ve sonuç
// sessiz bir hata oluyor: uygulama açılıyor ama adres çubuğu kaybolmuyor,
// çünkü doğrulama tutmuyor.
//
// KULLANIM:
//   node android-twa/domain-degistir.mjs vivaapp.com
//   node android-twa/domain-degistir.mjs vivaapp.com --kuru   (denemeden göster)
//
// SONRASINDA:
//   1. Play Console'dan SHA-256 parmak izini al
//   2. public/.well-known/assetlinks.json içine yaz
//   3. Vercel'e deploy et, yeni domainde yayınlandığını doğrula
//   4. Android Studio'da versionCode'u artır, yeni AAB üret
// ============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const kok = join(dirname(fileURLToPath(import.meta.url)), "..");

const yeni = process.argv[2];
const kuru = process.argv.includes("--kuru");

if (!yeni || yeni.startsWith("-")) {
  console.error("Kullanım: node android-twa/domain-degistir.mjs <yeni-domain> [--kuru]");
  console.error("Örnek   : node android-twa/domain-degistir.mjs vivaapp.com");
  process.exit(1);
}
// Şema veya sondaki eğik çizgi verilmişse temizle
const host = yeni.replace(/^https?:\/\//, "").replace(/\/+$/, "");
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) {
  console.error(`Geçersiz alan adı: "${yeni}"`);
  process.exit(1);
}

// Mevcut host'u manifest'ten oku — sabit yazmak yerine, böylece betik
// ikinci kez de çalışır.
const manifestYolu = join(kok, "android-twa/app/src/main/AndroidManifest.xml");
const eslesme = readFileSync(manifestYolu, "utf8").match(/android:host="([^"]+)"/);
if (!eslesme) {
  console.error("AndroidManifest.xml içinde android:host bulunamadı.");
  process.exit(1);
}
const eski = eslesme[1];

if (eski === host) {
  console.log(`Zaten "${host}" — değişiklik yok.`);
  process.exit(0);
}

const dosyalar = [
  "android-twa/app/src/main/AndroidManifest.xml",
  "android-twa/app/src/main/res/values/strings.xml",
  "android-twa/README.md",
  "store/play-listing-tr.md",
  "docs/android-studio-twa-kurulum.md",
];

console.log(`${eski}  →  ${host}${kuru ? "   (KURU ÇALIŞMA)" : ""}\n`);

let toplam = 0;
for (const rel of dosyalar) {
  const yol = join(kok, rel);
  let icerik;
  try {
    icerik = readFileSync(yol, "utf8");
  } catch {
    console.log(`  atlandı (yok): ${rel}`);
    continue;
  }
  const adet = icerik.split(eski).length - 1;
  if (adet === 0) {
    console.log(`  —  ${rel}`);
    continue;
  }
  if (!kuru) writeFileSync(yol, icerik.split(eski).join(host));
  console.log(`  ${String(adet).padStart(2)} yer  ${rel}`);
  toplam += adet;
}

console.log(`\nToplam ${toplam} yer${kuru ? " değişecek" : " değişti"}.`);
if (kuru) {
  console.log("Uygulamak için --kuru olmadan tekrar çalıştır.");
} else {
  console.log(`
Sırada:
  1. Vercel'de domaini bağla, NEXT_PUBLIC_SITE_URL=https://${host} yap
  2. Supabase → Authentication → URL Configuration'ı güncelle
  3. Deploy et, şunu doğrula:
       curl -s https://${host}/.well-known/assetlinks.json
  4. Android Studio'da versionCode'u artır, yeni AAB üret ve yükle`);
}
