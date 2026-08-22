// ============================================================================
// Vercel tarafını çeker: hangi deployment ölçüldü, ve koşu penceresindeki
// çalışma zamanı logları (hata ve süre satırları).
//
// DÜRÜST SINIR — bunu baştan söylüyorum ki rapor okunurken yanılgı olmasın:
// Vercel'in toplu "function duration P95" metriği Observability ürününde ve
// ücretli planlarda. Hobby'de böyle bir API yok. Bu betik iki şeyi yapar:
//   1) Ölçülen deployment'ın kimliğini ve build zamanını sabitler (v6 API,
//      belgelenmiş ve kararlı) — hangi sürümü ölçtüğümüz tartışmalı kalmasın.
//   2) Çalışma zamanı loglarını çeker; süre ve 5xx satırları oradan sayılır.
//
// P95 function duration'ı panelden okunacaksa rapora "panelden okundu, şu
// tarihte, şu ekran" diye yazılır. Uydurulmuş sayı girilmez.
//
// Kullanım:
//   VERCEL_TOKEN=... VERCEL_PROJE=veri-silme node loadtest/collect/vercel.mjs
// ============================================================================

import { writeFileSync } from "node:fs";
import { gerekli, istege, kosuKimligi } from "../config.mjs";

const TOKEN = gerekli("VERCEL_TOKEN", "Vercel → Settings → Tokens (okuma yetkisi yeterli)");
const PROJE = gerekli("VERCEL_PROJE", "Vercel proje adı, örn. veri-silme");
const TAKIM = istege("VERCEL_TAKIM_ID", null);
const runId = kosuKimligi();

const q = (o) => Object.entries(o).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
const api = async (yol) => {
  const res = await fetch(`https://api.vercel.com${yol}`, { headers: { authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(`${yol} → ${res.status} ${await res.text()}`);
  return res.json();
};

// --- 1) Ölçülen deployment -----------------------------------------------
const d = await api(`/v6/deployments?${q({ app: PROJE, teamId: TAKIM, limit: 1, state: "READY", target: "production" })}`);
const dep = d.deployments?.[0];
if (!dep) { console.error("Üretim deployment'ı bulunamadı."); process.exit(1); }

console.log(`\nÖlçülen deployment:`);
console.log(`  uid     : ${dep.uid}`);
console.log(`  url     : https://${dep.url}`);
console.log(`  hazır   : ${new Date(dep.ready ?? dep.created).toISOString()}`);
console.log(`  commit  : ${dep.meta?.githubCommitSha?.slice(0, 8) ?? "(bilinmiyor)"}`);

// --- 2) Çalışma zamanı logları -------------------------------------------
let olaylar = [];
try {
  olaylar = await api(`/v3/deployments/${dep.uid}/events?${q({ teamId: TAKIM, limit: 1000, direction: "backward" })}`);
} catch (e) {
  console.error(`\n[ÖLÇÜLEMEDİ] Log ucu: ${e.message}`);
  console.error(`  Function duration ve 5xx dağılımı Vercel panelinden okunmalı.`);
  console.error(`  Rapora "panelden okundu" notuyla girilecek; tahmin yazılmayacak.\n`);
}

const yol = `loadtest/rapor/vercel-${runId}.json`;
writeFileSync(yol, JSON.stringify({ deployment: dep, olayAdedi: olaylar.length, olaylar }, null, 2));

const hatalar = olaylar.filter((o) => o.type === "stderr" || /statusCode":5\d\d/.test(JSON.stringify(o)));
console.log(`\n  toplanan olay : ${olaylar.length}`);
console.log(`  hata satırı   : ${hatalar.length}`);
console.log(`  ham çıktı     : ${yol}\n`);
