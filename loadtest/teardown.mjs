// ============================================================================
// Test verisini SİLER. Atlanabilir bir adım değil.
//
// SİLME SIRASI ÖNEMLİ. Şemadaki 101 yabancı anahtarın çoğu
// `on delete cascade` — kullanıcıyı silmek antrenmanını, setlerini,
// ölçümlerini de siler. AMA bir kısmı `on delete set null`:
//   - teams.owner_id      → takım satırı SAĞ KALIR, sahibi null olur
//   - ai_usage.user_id    → kayıt sağ kalır
//   - ai_logs.user_id     → kayıt sağ kalır
// Önce kullanıcıyı silersek bu satırların kime ait olduğunu bir daha
// bilemeyiz; üretim veritabanında sahipsiz çöp kalır. Bu yüzden onlar
// KULLANICI SİLİNMEDEN ÖNCE, user_id hâlâ doluyken temizleniyor.
//
// Kullanım:
//   LOADTEST_ONAY=evet node loadtest/teardown.mjs           # tüm damgalılar
//   LOADTEST_ONAY=evet LOADTEST_RUN=... node ...            # tek koşu
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { gerekli, istege, onayIste, DAMGA } from "./config.mjs";

const SUPABASE_URL = gerekli("SUPABASE_URL", "Supabase → Settings → API → Project URL");
const SERVICE_ROLE = gerekli("SUPABASE_SERVICE_ROLE_KEY", "Supabase → Settings → API → service_role");
const SADECE_KOSU = istege("LOADTEST_RUN", null);

onayIste("test kullanıcılarını ve verilerini silmek");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- 1) Damgalı kullanıcıları bul --------------------------------------------
// Damgaya bakılıyor, e-posta desenine DEĞİL. Gerçek bir kullanıcının adresi
// tesadüfen desene benzerse desen eşleştirme onu da silerdi.
const hedefler = [];
for (let sayfa = 1; ; sayfa++) {
  const { data, error } = await admin.auth.admin.listUsers({ page: sayfa, perPage: 1000 });
  if (error) { console.error("Kullanıcılar listelenemedi:", error.message); process.exit(1); }
  if (!data.users.length) break;
  for (const u of data.users) {
    const m = u.user_metadata ?? {};
    if (m[DAMGA] !== true) continue;
    if (SADECE_KOSU && m.loadtest_run !== SADECE_KOSU) continue;
    hedefler.push({ id: u.id, email: u.email });
  }
  if (data.users.length < 1000) break;
}

if (!hedefler.length) {
  console.log("Silinecek damgalı test kullanıcısı yok. Veritabanı temiz.");
  process.exit(0);
}

console.log(`${hedefler.length} damgalı test kullanıcısı bulundu.`);
const kimlikler = hedefler.map((h) => h.id);

/** Diziyi n'lik parçalara böler — .in() filtresi çok uzun olmasın. */
const parcala = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// --- 2) Cascade ETMEYEN tabloları önce temizle -------------------------------
const ONCE = [
  { tablo: "teams", sutun: "owner_id" },
  { tablo: "ai_usage", sutun: "user_id" },
  { tablo: "ai_logs", sutun: "user_id" },
];

for (const { tablo, sutun } of ONCE) {
  let silinen = 0;
  for (const grup of parcala(kimlikler, 100)) {
    const { error, count } = await admin.from(tablo).delete({ count: "exact" }).in(sutun, grup);
    // Tablo yoksa (şema sürümü farklıysa) sessizce geçme — söyle.
    if (error) { console.warn(`  [uyarı] ${tablo}: ${error.message}`); break; }
    silinen += count ?? 0;
  }
  console.log(`  ${tablo}: ${silinen} satır silindi`);
}

// --- 3) Kullanıcıları sil (gerisi cascade ile gider) -------------------------
let silindi = 0, basarisiz = 0;
for (const h of hedefler) {
  const { error } = await admin.auth.admin.deleteUser(h.id);
  if (error) { basarisiz++; console.error(`  [hata] ${h.email}: ${error.message}`); }
  else { silindi++; process.stdout.write(`\r  silinen: ${silindi}/${hedefler.length}`); }
}
console.log(`\n\nSilinen kullanıcı: ${silindi}, başarısız: ${basarisiz}`);

// --- 4) DOĞRULA — "sildim" demek yetmez, bakıp göster ------------------------
const { data: kalan } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const hala = (kalan?.users ?? []).filter((u) => (u.user_metadata ?? {})[DAMGA] === true);

if (hala.length) {
  console.error(`\n[DİKKAT] Hâlâ ${hala.length} damgalı kullanıcı var. Tekrar çalıştır.`);
  process.exit(1);
}
console.log("\nDoğrulandı: damgalı test kullanıcısı kalmadı.");
console.log("Depolama bucket'larını (body-photos, meal-photos) ayrıca gözden geçir —");
console.log("AI akışları görsel yüklediyse dosyalar cascade ile gitmez.");
