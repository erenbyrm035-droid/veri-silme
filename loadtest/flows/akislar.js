// ============================================================================
// 12 akış. k6 modülü — Node API'si kullanılmaz.
//
// İKİ FARKLI YOL VAR, ve bu ölçümün en önemli ayrımı:
//
//   A) SAYFA AKIŞLARI  → Next.js'e (Vercel) gider, oradan Supabase'e.
//   B) YAZMA AKIŞLARI  → Vercel'e HİÇ UĞRAMAZ.
//
// (B) bir varsayım değil, koddan okundu: src/components/workout/WorkoutEngine.tsx
// tarayıcı istemcisini (`@/lib/supabase/client`) kullanıyor ve
// `workout_sets` insert/update'ini, `personal_records` upsert'ünü,
// `workouts` update'ini doğrudan PostgREST'e yolluyor. Yani "Set tamamlama"
// için Vercel function duration diye bir sayı YOKTUR; o yük tamamen
// Supabase'in üstündedir. Aynı sebeple bu yazmalar uygulamanın hız sınırı
// katmanına da hiç uğramıyor.
//
// Bu yüzden burada da aynı şekilde çağrılıyorlar: gerçek istemcinin yaptığını
// taklit etmeyen bir load test, gerçek yükü ölçmez.
// ============================================================================

import http from "k6/http";
import { Trend, Counter, Rate } from "k6/metrics";

export const gecikme = {};
export const hatalar = new Rate("akis_hata_orani");
export const kisitlanan = new Counter("yanit_429");
export const cacheHit = new Counter("vercel_cache_hit");
export const cacheMiss = new Counter("vercel_cache_miss");
export const aiGecikme = new Trend("ai_gecikme_ms", true);

/** Akış başına ayrı gecikme metriği — tek bir toplam P95 hangi akışın
 *  çöktüğünü gizler. */
function trend(ad) {
  if (!gecikme[ad]) gecikme[ad] = new Trend(`gecikme_${ad}`, true);
  return gecikme[ad];
}

function olc(ad, res, beklenen) {
  trend(ad).add(res.timings.duration);
  if (res.status === 429) kisitlanan.add(1);
  const ok = beklenen.indexOf(res.status) !== -1;
  hatalar.add(!ok, { akis: ad });

  // Önbellek durumu: force-dynamic yüzünden çoğunda DYNAMIC bekliyoruz.
  // Ölçüm bunu DOĞRULAMAK için — varsaymak için değil.
  const c = res.headers["X-Vercel-Cache"] || res.headers["x-vercel-cache"];
  if (c === "HIT") cacheHit.add(1);
  else if (c) cacheMiss.add(1);

  return ok;
}

function sayfa(ctx) {
  return { headers: { Cookie: ctx.cerezBasligi, "accept-language": "tr-TR" }, tags: {} };
}

/** PostgREST çağrısı — tarayıcı istemcisinin yaptığının aynısı. */
function pg(ctx, yol, yontem, govde) {
  const url = `${ctx.supabaseUrl}/rest/v1/${yol}`;
  const p = {
    headers: {
      apikey: ctx.anon,
      authorization: `Bearer ${ctx.token}`,
      "content-type": "application/json",
      prefer: yontem === "POST" ? "return=representation" : "return=minimal",
    },
  };
  if (yontem === "GET") return http.get(url, p);
  if (yontem === "POST") return http.post(url, JSON.stringify(govde), p);
  return http.patch(url, JSON.stringify(govde), p);
}

// --- A) Sayfa akışları -------------------------------------------------------

const sayfaAkisi = (ad, yol, agirlik) => ({
  ad, agirlik, tip: "sayfa",
  calistir(ctx) {
    olc(ad, http.get(`${ctx.taban}${yol}`, sayfa(ctx)), [200]);
  },
});

// --- B) Yazma akışları (doğrudan Supabase) -----------------------------------

const setTamamlama = {
  ad: "set_tamamlama", agirlik: 25, tip: "yazma_dogrudan",
  calistir(ctx) {
    if (!ctx.workoutId || !ctx.exerciseId) return;
    const res = pg(ctx, "workout_sets", "POST", {
      workout_id: ctx.workoutId,
      exercise_id: ctx.exerciseId,
      set_number: (__ITER % 5) + 1,
      reps: 8 + (__ITER % 5),
      weight_kg: 40 + (__ITER % 20),
      completed: true,
    });
    olc("set_tamamlama", res, [200, 201]);
  },
};

const workoutBaslatma = {
  ad: "workout_baslatma", agirlik: 6, tip: "yazma_dogrudan",
  calistir(ctx) {
    const res = pg(ctx, "workouts", "POST", {
      user_id: ctx.userId,
      name: "Load test antrenmanı",
      started_at: new Date().toISOString(),
    });
    if (olc("workout_baslatma", res, [200, 201])) {
      const j = res.json();
      if (j && j[0] && j[0].id) ctx.workoutId = j[0].id;
    }
  },
};

const workoutTamamlama = {
  ad: "workout_tamamlama", agirlik: 6, tip: "yazma_dogrudan",
  calistir(ctx) {
    if (!ctx.workoutId) return;
    const res = pg(ctx, `workouts?id=eq.${ctx.workoutId}`, "PATCH", {
      completed_at: new Date().toISOString(),
      duration_min: 45,
    });
    olc("workout_tamamlama", res, [200, 204]);
    ctx.workoutId = null; // bir sonraki turda yenisi açılsın
  },
};

// --- C) AI akışları (ücretli — ağırlıklar bilerek düşük) ---------------------

function aiAkisi(ad, yol, govde, agirlik) {
  return {
    ad, agirlik, tip: "ai",
    calistir(ctx) {
      const res = http.post(`${ctx.taban}${yol}`, JSON.stringify(govde), {
        headers: { Cookie: ctx.cerezBasligi, "content-type": "application/json" },
        timeout: "90s",
      });
      aiGecikme.add(res.timings.duration, { akis: ad });
      // 429 burada BAŞARISIZLIK DEĞİL — hız sınırının çalıştığının kanıtı.
      // Ayrı sayaçta izleniyor; hata oranına katılırsa sınır ile çöküş karışır.
      olc(ad, res, [200, 429]);
    },
  };
}

export const AKISLAR = [
  setTamamlama,
  sayfaAkisi("dashboard", "/dashboard", 20),
  sayfaAkisi("exercise_library", "/exercises", 12),
  sayfaAkisi("discover", "/discover", 8),
  sayfaAkisi("leaderboard", "/gamification", 7),
  workoutBaslatma,
  workoutTamamlama,
  sayfaAkisi("login_sayfasi", "/login", 5),
  sayfaAkisi("team", "/teams", 5),
  aiAkisi("ai_coach", "/api/coach", { message: "Bugün ne çalışmalıyım?" }, 3),
  aiAkisi("ai_nutrition", "/api/ai/nutrition-report", {}, 2),
  aiAkisi("form_analysis", "/api/ai/analyze-posture", { assessment: { shoulder: "neutral" } }, 1),
];

/** Ağırlıklara göre akış seçer. */
export function akisSec(rastgele) {
  const toplam = AKISLAR.reduce((t, a) => t + a.agirlik, 0);
  let n = rastgele * toplam;
  for (const a of AKISLAR) { n -= a.agirlik; if (n <= 0) return a; }
  return AKISLAR[0];
}
