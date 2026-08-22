// ============================================================================
// Test kullanıcı havuzunu üretir.
//
// NEDEN AYRI BİR ADIM: k6 içinden kullanıcı açmak, ölçtüğümüz gecikmeye
// kayıt maliyetini karıştırır. Havuz önceden hazırlanır, oturum çerezleri
// dosyaya yazılır, k6 yalnızca onları oynatır.
//
// ÇEREZLER ELLE ÜRETİLMİYOR. @supabase/ssr'ın çerez biçimi (isim, base64
// öneki, 3180 bayttan sonra .0/.1 parçalanması) sürüme göre değişebilir.
// Bu yüzden çerezi kütüphanenin KENDİSİNE ürettiriyoruz: bellek içi çerez
// deposuyla bir createServerClient kurulur, signInWithPassword çağrılır,
// kütüphanenin setAll'a verdiği ne ise o kaydedilir. Böylece biçim
// güncellemesinde takım sessizce bozulmaz.
//
// Kullanım:
//   LOADTEST_ONAY=evet LOADTEST_KULLANICI=5 node loadtest/seed.mjs
// ============================================================================

import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import {
  gerekli, istege, onayIste, kosuKimligi, kullaniciDosyasi,
  EPOSTA_ALANI, EPOSTA_ONEK, DAMGA, SIFRE,
} from "./config.mjs";

const SUPABASE_URL = gerekli("SUPABASE_URL", "Supabase → Settings → API → Project URL");
const SERVICE_ROLE = gerekli("SUPABASE_SERVICE_ROLE_KEY", "Supabase → Settings → API → service_role");
const ANON = gerekli("SUPABASE_ANON_KEY", "Supabase → Settings → API → anon public");
const ADET = Number(istege("LOADTEST_KULLANICI", "5"));

onayIste(`${ADET} test kullanıcısı açmak`);

const runId = kosuKimligi();
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Bir kullanıcı için oturum çerezlerini kütüphaneye ürettirir. */
async function cerezleriAl(email) {
  const yakalanan = [];
  const client = createServerClient(SUPABASE_URL, ANON, {
    cookies: {
      getAll: () => [],
      setAll: (liste) => { yakalanan.push(...liste); },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: SIFRE });
  if (error) throw new Error(`giriş başarısız (${email}): ${error.message}`);
  const { data } = await client.auth.getSession();
  return {
    cerezler: yakalanan.map(({ name, value }) => ({ ad: name, deger: value })),
    accessToken: data.session?.access_token ?? null,
  };
}

/** Dashboard'ın gerçek yükü temsil etmesi için minimum onboarding verisi. */
const PROFIL = {
  age: 30,
  gender: "male",
  height_cm: 178,
  weight_kg: 78,
  starting_weight_kg: 82,
  sleep_hours: 7,
  goal: "build_muscle",
  experience: "intermediate",
  weekly_training_days: 4,
  training_environment: "gym",
  onboarding_completed: true,
};

const sonuc = [];
let hata = 0;

for (let i = 1; i <= ADET; i++) {
  const email = `${EPOSTA_ONEK}+${runId}-${i}@${EPOSTA_ALANI}`;
  try {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: SIFRE,
      email_confirm: true,
      // DAMGA teardown'ın tek dayanağı. Desen eşleştirmesiyle silmek,
      // gerçek bir kullanıcının adresi tesadüfen benzediğinde felaket olur.
      user_metadata: { full_name: `Load Test ${i}`, [DAMGA]: true, loadtest_run: runId },
    });
    if (error) throw error;

    const { error: pErr } = await admin
      .from("profiles")
      .update({ ...PROFIL, full_name: `Load Test ${i}` })
      .eq("id", data.user.id);
    if (pErr) throw new Error(`profil güncellenemedi: ${pErr.message}`);

    const { cerezler, accessToken } = await cerezleriAl(email);
    sonuc.push({ email, id: data.user.id, cerezler, accessToken });
    process.stdout.write(`\r  hazır: ${sonuc.length}/${ADET}`);
  } catch (e) {
    hata++;
    console.error(`\n  [atlandı] ${email}: ${e.message}`);
  }
}

// --- Egzersiz kimlikleri ------------------------------------------------------
// "Set tamamlama" akışı gerçek bir exercise_id ister; uydurulmuş UUID yabancı
// anahtarda patlar ve ölçtüğün şey hata olur.
const { data: egz, error: egzErr } = await admin
  .from("exercises").select("id").limit(20);
if (egzErr) console.warn(`  [uyarı] egzersizler okunamadı: ${egzErr.message} — set akışı atlanacak`);
const egzersizler = (egz ?? []).map((e) => e.id);

const yol = kullaniciDosyasi(runId);
writeFileSync(yol, JSON.stringify({ runId, olusturma: new Date().toISOString(), egzersizler, kullanicilar: sonuc }, null, 2));

console.log(`\n\nHavuz hazır: ${sonuc.length} kullanıcı, ${hata} hata.`);
console.log(`Dosya: ${yol}`);
console.log(`\nTEMİZLİK KOMUTU (şimdi bir yere not et):`);
console.log(`  LOADTEST_ONAY=evet LOADTEST_RUN=${runId} node loadtest/teardown.mjs\n`);
if (sonuc.length === 0) process.exit(1);
