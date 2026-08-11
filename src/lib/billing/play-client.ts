// Google Play Billing — istemci tarafı (yalnızca TWA/native içinde çalışır).
// Digital Goods API + Payment Request ile satın alma, sonra sunucu doğrulaması.
/* eslint-disable @typescript-eslint/no-explicit-any */

/** TWA/Android uygulaması içinde Play Billing kullanılabilir mi? (web tarayıcısında false)
 *  Masaüstü Chrome'da getDigitalGoodsService tanımlı olabildiği için yalnızca
 *  gerçek yüklü/TWA bağlamında (standalone + android-app referrer) true döner. */
export function isPlayBillingAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const hasApi = "getDigitalGoodsService" in window && typeof (window as any).PaymentRequest === "function";
  if (!hasApi) return false;
  const isTWA = document.referrer.startsWith("android-app://");
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  return isTWA || standalone;
}

/** Play üzerinden bir SKU satın al → sunucuda doğrula → premium uygula. */
export async function buyWithPlay(sku: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const service = await (window as any).getDigitalGoodsService("https://play.google.com/billing");
    if (!service) return { ok: false, error: "Play Billing kullanılamıyor." };

    const request = new (window as any).PaymentRequest(
      [{ supportedMethods: "https://play.google.com/billing", data: { sku } }],
      { total: { label: "Toplam", amount: { currency: "TRY", value: "0" } } }
    );
    const response = await request.show();
    const purchaseToken: string = response.details?.purchaseToken;
    if (!purchaseToken) {
      await response.complete("fail");
      return { ok: false, error: "Satın alma token'ı alınamadı." };
    }

    const verify = await fetch("/api/billing/play/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, purchaseToken }),
    }).then((r) => r.json()).catch(() => ({ ok: false }));

    if (verify?.ok) {
      await response.complete("success");
      // Aboneliği/ürünü onayla (acknowledge) — mümkünse.
      try { await service.acknowledge?.(purchaseToken, "onetime"); } catch { /* yoksay */ }
      return { ok: true };
    }
    await response.complete("fail");
    return { ok: false, error: verify?.error || "Satın alma doğrulanamadı." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Satın alma iptal edildi." };
  }
}
