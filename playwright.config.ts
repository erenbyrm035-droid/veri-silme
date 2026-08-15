import { defineConfig, devices } from "@playwright/test";

// ============================================================================
// E2E test yapılandırması.
//
// ÜRETİM BUILD'İ ÜZERİNDE çalışır (`next start`), dev sunucusunda değil:
// middleware, önbellekleme ve kod bölme yalnızca üretim build'inde gerçek
// davranışını gösterir. Dev sunucusunda geçen bir test, canlıda geçeceğinin
// garantisi değildir.
//
// Testler İKİ GRUBA ayrılır:
//   e2e/public.spec.ts — oturum GEREKTİRMEZ. Her ortamda, gerçek Supabase
//                        olmadan da çalışır. CI'da çalışan grup budur.
//   e2e/auth.spec.ts   — gerçek bir test hesabı ister. E2E_EMAIL ve
//                        E2E_PASSWORD tanımlı değilse tamamı SKIP edilir.
//                        Böylece kimlik bilgisi olmayan ortamda yanıltıcı
//                        bir "yeşil" üretilmez; testler açıkça atlanır.
// ============================================================================

const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Uygulama Türkçe; tarih/sayı biçimlerinin testte de aynı olması için.
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Normalde Playwright tarayıcıyı kendi indirir (CI'da
        // `npx playwright install chromium`). Bazı ortamlarda tarayıcı
        // önceden kurulu ama sürümü paketle uyuşmuyor; o durumda yolu
        // E2E_CHROMIUM_PATH ile verip indirmeden çalıştırmak mümkün.
        // Tanımlı değilse hiçbir etkisi yok.
        ...(process.env.E2E_CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH } }
          : {}),
      },
    },
  ],

  // E2E_BASE_URL verilmişse (ör. Vercel preview) sunucu başlatma.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // `next start` build çıktısını ister; CI'da build adımı bundan önce.
        command: `npx next start -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
