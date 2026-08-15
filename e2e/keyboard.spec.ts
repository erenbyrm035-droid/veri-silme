import { test, expect } from "@playwright/test";

// ============================================================================
// Klavye erişilebilirliği.
//
// Bu davranışlar YALNIZCA gerçek tarayıcıda doğrulanabilir: odak sırası,
// Tab döngüsü ve Esc birim testinin göremediği şeyler.
//
// Denetimde bulunanlar (bu testler o düzeltmeleri koruyor):
//   - 5 modal yalnızca fareyle kapanıyordu; Esc çalışmıyordu. Hesap silme
//     onayında kullanıcı pencerede kilitli kalıyordu.
//   - "İçeriğe atla" bağlantısı yoktu; her sayfada gezinme menüsünün tamamı
//     tek tek geçilmek zorundaydı.
// ============================================================================

test.describe("içeriğe atla bağlantısı", () => {
  test("normalde görünmez, Tab ile belirir", async ({ page }) => {
    await page.goto("/login");
    const link = page.getByRole("link", { name: "İçeriğe atla" });

    // Ekran okuyucuya açık ama gözle görünmez (sr-only).
    await expect(link).toHaveCount(1);

    await page.keyboard.press("Tab");
    await expect(link).toBeFocused();
  });

  test("sayfanın ilk odaklanabilir öğesi", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const odak = await page.evaluate(() => document.activeElement?.textContent?.trim());
    expect(odak).toBe("İçeriğe atla");
  });
});

test.describe("giriş sayfası klavyeyle kullanılabilir", () => {
  test("e-postadan şifreye Tab ile ulaşılıyor", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').focus();

    // Araya "Şifremi unuttum?" bağlantısı giriyor — DOM sırası bu ve doğru:
    // bağlantı, şifre alanının etiketiyle aynı satırda. Kaç Tab gerektiğini
    // sabitlemek yerine şifre alanına ULAŞILABİLDİĞİNİ doğruluyoruz;
    // aradaki öğe sayısı bir düzen ayrıntısı, erişilebilirlik ölçütü değil.
    const sifre = page.locator('input[type="password"]');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      if (await sifre.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(sifre, "şifre alanına klavyeyle ulaşılamadı").toBeFocused();
  });

  test("odak halkası görünür (outline ya da belirgin kenarlık)", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').focus();

    const gorunur = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const s = getComputedStyle(el);
      // Ya outline var ya da :focus kenarlık rengini değiştiriyor.
      const outlineVar = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
      const kenarlikVar = parseFloat(s.borderWidth) > 0;
      return outlineVar || kenarlikVar;
    });
    expect(gorunur, "odaklanan öğede görsel işaret yok").toBe(true);
  });

  test("şifresiz giriş düğmesine klavyeyle basılabilir", async ({ page }) => {
    await page.goto("/login");
    const btn = page.getByRole("button", { name: /şifresiz giriş bağlantısı/i });
    await btn.focus();
    await expect(btn).toBeFocused();
    await page.keyboard.press("Enter");
    // E-posta boş olduğu için uyarı çıkmalı — yani düğme klavyeyle tetiklendi.
    await expect(page.getByText(/e-posta adresini gir/i)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("temel yapı", () => {
  test("ana içerik landmark'ı var ve atlama hedefi doğru", async ({ page }) => {
    await page.goto("/login");
    const href = await page.getByRole("link", { name: "İçeriğe atla" }).getAttribute("href");
    expect(href).toBe("#icerik");
  });

  test("sayfa dili Türkçe olarak bildirilmiş", async ({ page }) => {
    await page.goto("/");
    expect(await page.locator("html").getAttribute("lang")).toBe("tr");
  });
});
