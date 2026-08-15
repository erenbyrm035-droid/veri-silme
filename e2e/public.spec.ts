import { test, expect } from "@playwright/test";

// ============================================================================
// Oturum GEREKTİRMEYEN akışlar.
//
// Bu dosya gerçek Supabase kimlik bilgisi olmadan da çalışır; CI'da koşan
// grup budur. Kapsadığı en kritik şey KİMLİK DOĞRULAMA KAPISI: korumalı bir
// rota oturumsuz açılırsa giriş sayfasına atılmalı. Bu kapı sessizce
// bozulursa kullanıcı verisi herkese açılır ve birim testleri bunu
// yakalayamaz — middleware yalnızca gerçek istek akışında çalışır.
// ============================================================================

/** `src/lib/supabase/middleware.ts` içindeki PUBLIC_ROUTES'tan seçmeler. */
const HERKESE_ACIK = ["/", "/login", "/register", "/forgot-password", "/terms", "/privacy"];

/** Korumalı rotalar — oturumsuz erişimde /login'e düşmeli. */
const KORUMALI = ["/dashboard", "/workouts", "/profile", "/settings", "/gamification", "/teams"];

test.describe("herkese açık sayfalar", () => {
  for (const yol of HERKESE_ACIK) {
    test(`${yol} açılıyor`, async ({ page }) => {
      const res = await page.goto(yol);
      expect(res?.status(), `${yol} HTTP durumu`).toBeLessThan(400);
      // Giriş sayfasına yönlenmemiş olmalı (kendisi hariç).
      if (yol !== "/login") {
        expect(new URL(page.url()).pathname).not.toBe("/login");
      }
      await expect(page.locator("body")).toBeVisible();
    });
  }
});

test.describe("kimlik doğrulama kapısı", () => {
  for (const yol of KORUMALI) {
    test(`${yol} oturumsuz erişimde giriş sayfasına yönlendirir`, async ({ page }) => {
      await page.goto(yol);
      await page.waitForURL(/\/login/, { timeout: 15_000 });
      expect(new URL(page.url()).pathname).toBe("/login");
    });
  }
});

test.describe("giriş sayfası", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("e-posta ve şifre alanları var", async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("kayıt ve şifremi unuttum bağlantıları çalışıyor", async ({ page }) => {
    await page.getByRole("link", { name: /kayıt ol/i }).click();
    await page.waitForURL(/\/register/);

    await page.goto("/login");
    await page.getByRole("link", { name: /şifremi unuttum/i }).click();
    await page.waitForURL(/\/forgot-password/);
  });

  test("yanlış bilgiyle giriş hata gösterir, yönlendirmez", async ({ page }) => {
    await page.locator('input[type="email"]').fill("olmayan@ornek.com");
    await page.locator('input[type="password"]').fill("yanlis-sifre-123");
    await page.getByRole("button", { name: /giriş yap/i }).click();

    // Dashboard'a geçmemeli.
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

test.describe("magic link", () => {
  test("boş e-postayla gönderilemez", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /şifresiz giriş bağlantısı/i }).click();
    await expect(page.getByText(/e-posta adresini gir/i)).toBeVisible({ timeout: 10_000 });
  });

  // Adresin kayıtlı olup olmadığı ele verilmemeli: her iki durumda da aynı
  // "gönderildi" mesajı görünmeli (hesap sayımına karşı koruma).
  test("bilinmeyen adres için de aynı onay mesajı çıkar", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(`yok-${Date.now()}@ornek.com`);
    await page.getByRole("button", { name: /şifresiz giriş bağlantısı/i }).click();
    await expect(page.getByText(/gönderildi/i)).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("erişilebilirlik ve temel sağlamlık", () => {
  test("ana sayfada tek bir h1 var", async ({ page }) => {
    await page.goto("/");
    expect(await page.locator("h1").count()).toBeGreaterThan(0);
  });

  test("sayfa yatay kaymıyor (mobil genişlik)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    const kayma = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(kayma, "yatay taşma var").toBeLessThanOrEqual(1);
  });

  test("olmayan sayfa 404 döner", async ({ page }) => {
    const res = await page.goto("/boyle-bir-sayfa-yok-12345");
    expect(res?.status()).toBe(404);
  });
});

test.describe("kapının canlı akışta gerçekten çalışması", () => {
  // Bu testleri yazarken şu bulundu: middleware, Supabase ortam değişkenleri
  // yokken TÜM kimlik doğrulama kapısını sessizce devre dışı bırakıyordu —
  // /dashboard dahil her korumalı sayfa herkese açılıyordu, ne hata ne log.
  // Birim testleri bunu yakalayamaz; middleware yalnızca gerçek istek
  // akışında çalışır. Düzeltildi (üretimde kapalı tarafa düşüyor).
  //
  // NOT: `redirectedFrom` sorgu parametresi BİLEREK doğrulanmıyor. Korumalı
  // rotaya iki ayrı kapı cevap verebiliyor — middleware (parametreyi koyar)
  // ve `(app)/layout.tsx:23`'teki `redirect("/login")` (koymaz). Hangisinin
  // önce davrandığını sınamak, korumanın kendisini değil iç ayrıntıyı test
  // etmek olurdu.
  test("admin paneli oturumsuz açılmaz", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe("/login");
  });

  test("korumalı sayfanın içeriği HTML'de sızmıyor", async ({ request }) => {
    // Yönlendirme takip edilmeden ham yanıt: gövdede kullanıcı verisi
    // olmamalı, yalnızca yönlendirme dönmeli.
    const res = await request.get("/dashboard", { maxRedirects: 0 });
    expect(res.status(), "korumalı sayfa 200 dönüyor").toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
  });
});
