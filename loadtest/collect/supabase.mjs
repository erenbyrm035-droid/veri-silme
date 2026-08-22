// ============================================================================
// Supabase altyapı metriklerini çeker (CPU, bellek, bağlantı).
//
// Kaynak: Supabase'in Prometheus uyumlu ucu
//   https://<ref>.supabase.co/customer/v1/privileged/metrics
// Basic auth: kullanıcı "service_role", parola service_role anahtarı.
//
// DÜRÜST SINIR: bu uç ücretli planlarda açık. Free katmanda 401/404 döner —
// betik bunu YUTMAZ, ekrana yazar. "Metrik alınamadı" yazmak, uydurulmuş bir
// CPU yüzdesi yazmaktan iyidir.
//
// Kullanım: koşunun BAŞINDA ve SONUNDA çalıştır, farkı al.
//   node loadtest/collect/supabase.mjs onceki
//   node loadtest/collect/supabase.mjs sonraki
// ============================================================================

import { writeFileSync } from "node:fs";
import { gerekli, kosuKimligi } from "../config.mjs";

const SUPABASE_URL = gerekli("SUPABASE_URL", "Supabase → Settings → API → Project URL");
const SERVICE_ROLE = gerekli("SUPABASE_SERVICE_ROLE_KEY", "Supabase → Settings → API → service_role");
const etiket = process.argv[2] || "anlik";
const runId = kosuKimligi();

const uc = `${SUPABASE_URL.replace(/\/$/, "")}/customer/v1/privileged/metrics`;
const auth = Buffer.from(`service_role:${SERVICE_ROLE}`).toString("base64");

const res = await fetch(uc, { headers: { authorization: `Basic ${auth}` } });

if (!res.ok) {
  console.error(`\n[ÖLÇÜLEMEDİ] Supabase metrics ucu ${res.status} döndü.`);
  console.error(`  Bu uç ücretli planlarda açık. Free katmandaysan:`);
  console.error(`  CPU / bağlantı sayısı Supabase panelinde Reports → Database'den`);
  console.error(`  elle okunmalı ve rapora "panelden okundu" notuyla girilmeli.`);
  console.error(`  Rapora TAHMİN yazılmayacak.\n`);
  process.exit(2);
}

const metin = await res.text();

// İlgilendiğimiz seriler. Prometheus çıktısı çok geniş; hepsini saklamak
// raporu okunmaz eder.
const ILGI = [
  "pg_stat_database_num_backends",   // aktif bağlantı
  "pg_settings_max_connections",     // bağlantı tavanı
  "node_cpu_seconds_total",
  "node_memory_MemAvailable_bytes",
  "node_memory_MemTotal_bytes",
  "pg_stat_database_xact_commit",
  "pg_stat_database_xact_rollback",
  "pg_stat_activity_count",
];

const secilen = metin
  .split("\n")
  .filter((s) => s && !s.startsWith("#") && ILGI.some((i) => s.startsWith(i)));

const yol = `loadtest/rapor/supabase-${runId}-${etiket}.txt`;
writeFileSync(yol, secilen.join("\n") + "\n");

const backends = secilen.filter((s) => s.startsWith("pg_stat_database_num_backends"));
const max = secilen.find((s) => s.startsWith("pg_settings_max_connections"));

console.log(`\nSupabase metrikleri (${etiket}) → ${yol}`);
console.log(`  seri sayısı        : ${secilen.length}`);
console.log(`  aktif bağlantı     : ${backends.length} veritabanı satırı`);
console.log(`  max_connections    : ${max ? max.split(" ").pop() : "(okunamadı)"}`);
console.log(`  ham çıktı saklandı — rapordaki her sayı bu dosyadan doğrulanabilir.\n`);
