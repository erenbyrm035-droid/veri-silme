// ============================================================================
// AI uçlarının gecikme profili — ANA KOŞUDAN AYRI, seri ve düşük hacimli.
//
// NEDEN AYRI: AI uçları gerçek para harcıyor ve OpenAI'ın kendi hız sınırına
// tabi. 5.000 VU altında AI'ı tam ağırlıkla sürmek, Viva'nın kapasitesini
// değil OpenAI'ın kotasını ölçmek olur — ve faturayı üç haneye çıkarır.
//
// TOKEN SAYISI BURADAN OKUNMAZ, ve bu bir eksiklik değil bir tespit:
// uygulama 14 AI route'undan yalnızca /api/coach için ai_usage'a yazıyor,
// o da estTokens() ile TAHMİN ediyor (src/app/api/coach/route.ts:256).
// OpenAI'ın döndürdüğü gerçek `usage` alanı kodda hiç okunmuyor.
// Bu yüzden gerçek token sayısı OpenAI panelinden, bu betiğin bastığı
// ZAMAN PENCERESİNE bakılarak okunur. Betik pencereyi başta ve sonda yazar.
//
// Kullanım:
//   LOADTEST_RUN=... TABAN=https://... node loadtest/ai-mikro.mjs
// ============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { gerekli, istege, kosuKimligi, kullaniciDosyasi } from "./config.mjs";

const TABAN = gerekli("TABAN", "Test edilecek adres, örn. https://veri-silme.vercel.app");
const TEKRAR = Number(istege("AI_TEKRAR", "20"));
const runId = kosuKimligi();

const { kullanicilar } = JSON.parse(readFileSync(kullaniciDosyasi(runId), "utf-8"));
if (!kullanicilar?.length) { console.error("Kullanıcı havuzu boş. Önce seed.mjs."); process.exit(1); }

const UCLAR = [
  ["coach",              "/api/coach",                  { message: "Bugün ne çalışmalıyım?" }],
  ["dietitian",          "/api/ai/dietitian",           { message: "Bugün ne yiyeyim?" }],
  ["dietitian_plan",     "/api/ai/dietitian/plan",      {}],
  ["workout_coach",      "/api/workout/coach",          { message: "Set arası ne kadar dinlenmeliyim?" }],
  ["generate_program",   "/api/ai/generate-program",    {}],
  ["analyze_muscles",    "/api/ai/analyze-muscles",     {}],
  ["analyze_posture",    "/api/ai/analyze-posture",     { assessment: { shoulder: "neutral" } }],
  ["daily_analysis",     "/api/ai/daily-analysis",      {}],
  ["nutrition_report",   "/api/ai/nutrition-report",    {}],
  ["nutrition_plan",     "/api/ai/nutrition-plan",      {}],
  ["meal_planner",       "/api/ai/meal-planner",        {}],
  ["recipe",             "/api/ai/recipe",              { query: "yüksek proteinli kahvaltı" }],
  ["supplement",         "/api/ai/supplement",          {}],
  ["analyze_meal",       "/api/ai/analyze-meal",        {}],
];

const yuzde = (a, p) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
};

const baslangic = new Date().toISOString();
console.log(`\nAI mikro-test başladı: ${baslangic}`);
console.log(`OpenAI panelinde token kullanımı için pencere BAŞI: ${baslangic}\n`);

const sonuclar = [];

for (const [ad, yol, govde] of UCLAR) {
  const sureler = [];
  const durumlar = {};
  for (let i = 0; i < TEKRAR; i++) {
    const k = kullanicilar[i % kullanicilar.length];
    const cookie = k.cerezler.map((c) => `${c.ad}=${c.deger}`).join("; ");
    const t0 = performance.now();
    let durum = 0;
    try {
      const res = await fetch(`${TABAN}${yol}`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify(govde),
        signal: AbortSignal.timeout(120_000),
      });
      // Akış uçlarında gövde tükenmeden süre ölçülemez — sonuna kadar oku.
      await res.text();
      durum = res.status;
    } catch (e) {
      durum = e.name === "TimeoutError" ? 408 : 599;
    }
    sureler.push(performance.now() - t0);
    durumlar[durum] = (durumlar[durum] ?? 0) + 1;
  }
  const satir = {
    uc: ad, yol, tekrar: TEKRAR, durumlar,
    p50: yuzde(sureler, 50), p95: yuzde(sureler, 95), p99: yuzde(sureler, 99),
    ortalama: Math.round(sureler.reduce((a, b) => a + b, 0) / sureler.length),
  };
  sonuclar.push(satir);
  console.log(
    `${ad.padEnd(18)} P50 ${String(satir.p50).padStart(6)}ms  P95 ${String(satir.p95).padStart(6)}ms  ` +
    `P99 ${String(satir.p99).padStart(6)}ms  durumlar: ${JSON.stringify(durumlar)}`
  );
}

const bitis = new Date().toISOString();
const yol = `loadtest/rapor/ai-mikro-${runId}.json`;
writeFileSync(yol, JSON.stringify({ runId, taban: TABAN, baslangic, bitis, tekrar: TEKRAR, sonuclar }, null, 2));

console.log(`\nOpenAI panelinde token kullanımı için pencere SONU: ${bitis}`);
console.log(`Ham çıktı: ${yol}`);
console.log(`\nTOKEN OKUMA ADIMI (elle): OpenAI → Usage → bu proje → yukarıdaki`);
console.log(`iki zaman damgası arasındaki input/output token toplamı rapora girilir.\n`);
