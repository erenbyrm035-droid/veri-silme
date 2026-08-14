import { describe, it, expect } from "vitest";
import { PLANS, planById, premiumUntilFor } from "./plans";
import { productToPlan } from "../billing/revenuecat";

// ============================================================================
// Plan kataloğu ve mağaza ürün eşlemesi.
//
// NEDEN BU TEST VAR: Android TWA kurulumu sırasında gerçek bir tuzak çıktı —
// dokümanda Play ürün kimlikleri `viva_premium_monthly` diye yazılıydı ama
// TWA yolunda eşleme TAM EŞİTLİKLE yapılıyor (`/api/billing/play/verify` →
// `PLANS.find(p => p.playSku === sku)`). O adlarla ürün açılsaydı her satın
// alma "Bilinmeyen ürün" ile reddedilirdi ve bunu ancak canlıda, ödeme
// yapmaya çalışan kullanıcıdan öğrenirdik.
//
// Aşağıdaki testler bu sınıf hatayı derleme zamanına çeker.
// ============================================================================

/** verify route'undaki eşlemenin birebir kopyası (orada satır içi). */
function planForSku(sku: string) {
  return PLANS.find((p) => p.playSku === sku)?.id ?? null;
}

describe("Play ürün kimlikleri", () => {
  const beklenen = ["premium_monthly", "premium_yearly", "premium_lifetime"];

  it("dokümante edilen üç SKU da kataloğa çözülür", () => {
    for (const sku of beklenen) {
      expect(planForSku(sku), `SKU çözülemedi: ${sku}`).not.toBeNull();
    }
  });

  it("SKU'lar benzersiz — iki plan aynı ürüne bağlanamaz", () => {
    const skus = PLANS.map((p) => p.playSku).filter(Boolean);
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("önekli yazım reddedilir (dokümandaki tuzak)", () => {
    expect(planForSku("viva_premium_monthly")).toBeNull();
  });

  it("bilinmeyen SKU null döner, sessizce bir plana düşmez", () => {
    expect(planForSku("")).toBeNull();
    expect(planForSku("bedava")).toBeNull();
  });
});

describe("plan kataloğu tutarlılığı", () => {
  it("plan id'leri benzersiz", () => {
    const ids = PLANS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ücretli planların TRY fiyatı pozitif", () => {
    for (const p of PLANS.filter((x) => x.id !== "free")) {
      expect(p.priceTry, `${p.id} fiyatsız`).toBeGreaterThan(0);
    }
  });

  it("planById bilinen id'yi döner", () => {
    expect(planById("premium_monthly").id).toBe("premium_monthly");
  });

  it("lifetime süresizdir, abonelikler süreli", () => {
    expect(planById("lifetime").durationDays).toBeNull();
    expect(planById("premium_monthly").durationDays).toBe(30);
    expect(planById("premium_yearly").durationDays).toBe(365);
  });

  it("premiumUntilFor gelecekte bir tarih üretir", () => {
    expect(new Date(premiumUntilFor("premium_monthly")).getTime()).toBeGreaterThan(Date.now());
  });
});

// RevenueCat (iOS) yolu Play'den FARKLI: eşleme esnek, önek sorun değil.
// İki yolun farkı bilinçli; test bu farkı da kayda geçiriyor.
describe("productToPlan — RevenueCat esnek eşlemesi", () => {
  it("lifetime'ı yakalar", () => {
    expect(productToPlan("viva_premium_lifetime")).toBe("lifetime");
  });

  it("yıllığı farklı yazımlarla yakalar", () => {
    expect(productToPlan("viva_premium_yearly")).toBe("premium_yearly");
    expect(productToPlan("annual_sub")).toBe("premium_yearly");
    expect(productToPlan("viva_yillik")).toBe("premium_yearly");
  });

  it("aylığı yakalar", () => {
    expect(productToPlan("viva_premium_monthly")).toBe("premium_monthly");
  });

  it("tanınmayan üründe aylığa düşer (premium yine de verilir)", () => {
    expect(productToPlan("bilinmeyen")).toBe("premium_monthly");
    expect(productToPlan(null)).toBe("premium_monthly");
  });

  it("büyük harf duyarsız", () => {
    expect(productToPlan("VIVA_PREMIUM_LIFETIME")).toBe("lifetime");
  });
});
