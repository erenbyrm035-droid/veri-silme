import { test, expect } from "@playwright/test";

// ============================================================================
// Oturum GEREKTİREN akış: giriş → onboarding/dashboard → antrenman.
//
// Bu testler gerçek bir Supabase test hesabı ister. Kimlik bilgisi yoksa
// tamamı SKIP edilir — sahte bir "yeşil" üretmemek için. Atlanan test
// çıktıda açıkça görünür; geçmiş gibi davranmaz.
//
// Çalıştırmak için (tercihen AYRI bir staging Supabase projesi — canlı
// veritabanına test verisi yazmayın):
//
//   E2E_EMAIL=test@ornek.com E2E_PASSWORD=... npm run test:e2e
//
// CI'da: repo secrets'a E2E_EMAIL / E2E_PASSWORD eklenince kendiliğinden
// çalışmaya başlar (.github/workflows/ci.yml e2e job'ı bunları geçiriyor).
// ============================================================================

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.skip(
  !EMAIL || !PASSWORD,
  "E2E_EMAIL/E2E_PASSWORD tanımlı değil — oturum gerektiren testler atlandı."
);

/** Giriş yapar ve korumalı bir sayfaya ulaşıldığını doğrular. */
async function girisYap(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(EMAIL!);
  await page.locator('input[type="password"]').fill(PASSWORD!);
  await page.getByRole("button", { name: /giriş yap/i }).click();
  // Onboarding tamamlanmamışsa /onboarding, tamamsa /dashboard.
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });
}

test.describe("giriş", () => {
  test("doğru bilgiyle giriş yapılır", async ({ page }) => {
    await girisYap(page);
    expect(new URL(page.url()).pathname).toMatch(/^\/(dashboard|onboarding)$/);
  });

  test("giriş sonrası korumalı sayfalar açılır", async ({ page }) => {
    await girisYap(page);
    // Onboarding'deyse önce oradan çıkmak gerekir; bu senaryo tamamlanmış
    // hesap varsayıyor.
    test.skip(
      new URL(page.url()).pathname === "/onboarding",
      "Test hesabı onboarding'i tamamlamamış — korumalı sayfa gezintisi atlandı."
    );

    for (const yol of ["/workouts", "/profile", "/settings"]) {
      await page.goto(yol);
      expect(new URL(page.url()).pathname, `${yol} erişilemedi`).toBe(yol);
    }
  });

  test("çıkış yapınca korumalı sayfa tekrar kapanır", async ({ page }) => {
    await girisYap(page);
    await page.goto("/auth/signout");
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/, { timeout: 15_000 });
  });
});

test.describe("antrenman akışı", () => {
  test("antrenman listesi açılır", async ({ page }) => {
    await girisYap(page);
    test.skip(new URL(page.url()).pathname === "/onboarding", "Onboarding tamamlanmamış.");

    await page.goto("/workouts");
    await expect(page.locator("body")).toBeVisible();
    // Sayfa ya antrenman listeler ya da boş durum gösterir; ikisi de geçerli.
    expect(new URL(page.url()).pathname).toBe("/workouts");
  });

  test("yazı boyutu ayarı arayüzü ölçekliyor", async ({ page }) => {
    await girisYap(page);
    test.skip(new URL(page.url()).pathname === "/onboarding", "Onboarding tamamlanmamış.");

    await page.goto("/settings");
    const once = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);

    await page.getByRole("radio", { name: "Çok büyük" }).click();
    const sonra = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);

    expect(parseFloat(sonra)).toBeGreaterThan(parseFloat(once));
  });
});
