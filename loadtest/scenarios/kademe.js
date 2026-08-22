// ============================================================================
// k6 giriş noktası — tek kademe koşar.
//
// Kademeler AYRI AYRI koşulur, tek bir uzun rampa değil. Sebebi: tek rampada
// sistem 300 VU'da bozulmaya başlasa bile 800'e varmadan bunu göremezsin;
// kademeler arası soğuma olmadığı için cold start ve önbellek durumu da bir
// sonrakine bulaşır. Ayrı kademe = her sayının kendi temiz penceresi.
//
// Kullanım:
//   k6 run -e KADEME=100 -e TABAN=https://... -e RUN=... loadtest/scenarios/kademe.js
// ============================================================================

import { sleep } from "k6";
import { SharedArray } from "k6/data";
import { AKISLAR, akisSec } from "../flows/akislar.js";

const KADEME = Number(__ENV.KADEME || 100);
const TABAN = __ENV.TABAN;
const RUN = __ENV.RUN;
const SUPABASE_URL = __ENV.SUPABASE_URL;
const ANON = __ENV.SUPABASE_ANON_KEY;

if (!TABAN || !RUN || !SUPABASE_URL || !ANON) {
  throw new Error("Eksik değişken: TABAN, RUN, SUPABASE_URL, SUPABASE_ANON_KEY gerekli.");
}

// SharedArray: havuz VU başına değil, bir kez belleğe alınır. 500 kullanıcı ×
// 5000 VU kopyası belleği patlatırdı.
const havuz = new SharedArray("kullanicilar", () => {
  const d = JSON.parse(open(`../rapor/kullanicilar-${RUN}.json`));
  return d.kullanicilar;
});
const egzersizler = new SharedArray("egzersizler", () => {
  const d = JSON.parse(open(`../rapor/kullanicilar-${RUN}.json`));
  return d.egzersizler || [];
});

export const options = {
  scenarios: {
    kademe: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: KADEME }, // rampa
        { duration: "5m", target: KADEME }, // sabit — ölçüm penceresi burası
        { duration: "1m", target: 0 },      // iniş
      ],
      gracefulRampDown: "30s",
    },
  },
  // EŞİKLER KOŞUDAN ÖNCE SABİT. Sonuca bakıp gevşetilmesin diye burada.
  thresholds: {
    akis_hata_orani: ["rate<0.02"],
    "gecikme_dashboard": ["p(95)<1000"],
    "gecikme_exercise_library": ["p(95)<1000"],
    "gecikme_leaderboard": ["p(95)<1000"],
    "gecikme_set_tamamlama": ["p(95)<1500"],
    "gecikme_workout_tamamlama": ["p(95)<1500"],
    ai_gecikme_ms: ["p(95)<15000"],
  },
  // Eşik aşılırsa koş devam etsin — kırılma noktasını görmek için sonuna
  // kadar veri toplanmalı. Durdurma kararı insanda (bkz. README, Faz 2.1).
  noConnectionReuse: false,
  discardResponseBodies: false,
};

export default function () {
  const k = havuz[(__VU - 1) % havuz.length];
  const ctx = {
    taban: TABAN,
    supabaseUrl: SUPABASE_URL,
    anon: ANON,
    userId: k.id,
    token: k.accessToken,
    cerezBasligi: k.cerezler.map((c) => `${c.ad}=${c.deger}`).join("; "),
    exerciseId: egzersizler.length ? egzersizler[__ITER % egzersizler.length] : null,
    workoutId: null,
  };

  akisSec(Math.random()).calistir(ctx);

  // Gerçek kullanıcı arka arkaya istek atmaz. 1–4 sn düşünme süresi olmadan
  // ölçtüğün şey "N eşzamanlı kullanıcı" değil, "N sonsuz döngü" olur.
  sleep(1 + Math.random() * 3);
}

export function handleSummary(data) {
  const dosya = `loadtest/rapor/k6-${RUN}-kademe${KADEME}.json`;
  const ozet = { kademe: KADEME, taban: TABAN, run: RUN, akislar: AKISLAR.map((a) => a.ad), metrikler: data.metrics };
  return { [dosya]: JSON.stringify(ozet, null, 2), stdout: metinOzet(data) };
}

function metinOzet(data) {
  const m = data.metrics;
  const s = (ad) => {
    const v = m[ad];
    if (!v || !v.values) return `${ad}: (veri yok)`;
    const q = v.values;
    return `${ad.padEnd(32)} P50 ${Math.round(q.med || 0)}ms  P95 ${Math.round(q["p(95)"] || 0)}ms  P99 ${Math.round(q["p(99)"] || 0)}ms`;
  };
  const satirlar = [
    ``,
    `=== KADEME ${KADEME} VU ===`,
    `istek/sn        : ${(m.http_reqs?.values?.rate ?? 0).toFixed(1)}`,
    `hata oranı      : ${((m.akis_hata_orani?.values?.rate ?? 0) * 100).toFixed(2)}%`,
    `429 sayısı      : ${m.yanit_429?.values?.count ?? 0}`,
    `cache HIT/MISS  : ${m.vercel_cache_hit?.values?.count ?? 0} / ${m.vercel_cache_miss?.values?.count ?? 0}`,
    ``,
    ...AKISLAR.map((a) => "  " + s(`gecikme_${a.ad}`)),
    ``,
    `  ${s("ai_gecikme_ms")}`,
    ``,
  ];
  return satirlar.join("\n");
}
