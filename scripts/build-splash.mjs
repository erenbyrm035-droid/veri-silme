#!/usr/bin/env node
// Apple PWA açılış (splash) ekranlarını üretir → public/splash/*.png
// Marka arka planı + ortalanmış "V" logosu + "Viva AI Coach" yazısı.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT = "public/splash";
mkdirSync(OUT, { recursive: true });

const BG = "#0a0a0b";
const BRAND = "#d6f84c";

// [genişlik, yükseklik] fiziksel piksel (portre) — yaygın iPhone/iPad boyutları.
const SIZES = [
  [1170, 2532], [1179, 2556], [1284, 2778], [1290, 2796],
  [1125, 2436], [1242, 2688], [828, 1792], [750, 1334], [640, 1136],
  [1536, 2048], [1668, 2224], [1668, 2388], [2048, 2732],
];

function svg(w, h) {
  const s = Math.round(Math.min(w, h) * 0.22);   // logo kutusu boyutu
  const r = Math.round(s * 0.22);                 // köşe yarıçapı
  const cx = w / 2, cy = h / 2;
  const fontLogo = Math.round(s * 0.62);
  const fontName = Math.round(Math.min(w, h) * 0.052);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${BG}"/>
  <g transform="translate(${cx}, ${cy - s * 0.35}) rotate(-6)">
    <rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="${r}" ry="${r}" fill="${BRAND}"/>
    <text x="0" y="0" font-family="Arial, sans-serif" font-weight="900" font-size="${fontLogo}"
          fill="#000" text-anchor="middle" dominant-baseline="central" transform="rotate(6)">V</text>
  </g>
  <text x="${cx}" y="${cy + s * 0.55}" font-family="Arial, sans-serif" font-weight="800" font-size="${fontName}"
        fill="#f2f4ee" text-anchor="middle" dominant-baseline="hanging">Viva AI Coach</text>
</svg>`;
}

const results = [];
for (const [w, h] of SIZES) {
  const file = `${OUT}/apple-splash-${w}x${h}.png`;
  await sharp(Buffer.from(svg(w, h))).png().toFile(file);
  results.push(`${w}x${h}`);
}
console.log(`✓ ${results.length} splash üretildi → ${OUT}`);
console.log("  " + results.join(", "));
