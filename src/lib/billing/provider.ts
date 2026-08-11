// Ödeme sağlayıcı soyutlaması — Stripe / Google Play Billing / Apple StoreKit
// arasında geçişi tek arayüzle sağlar. Sağlayıcı seçimi `BILLING_PROVIDER` env
// ile yapılır. Anahtarlar tanımlı değilse "manual" sağlayıcı devreye girer
// (ödeme başlatılamaz; admin premium'ı elle atar).
//
// Yeni özellik EKLENMEDİ — bu yalnızca üretime hazır entegrasyon iskeletidir.
import "server-only";
import type { PlanId } from "@/lib/premium/plans";

export type BillingProviderId = "iyzico" | "stripe" | "google_play" | "app_store" | "manual";

export interface CheckoutParams {
  userId: string;
  email: string | null;
  plan: PlanId;
  successUrl: string;
  cancelUrl: string;
}
export interface CheckoutResult { ok: boolean; url?: string; error?: string; }

export interface WebhookEvent {
  id: string;
  type: string;                 // örn "checkout.completed", "subscription.deleted"
  userId?: string | null;
  plan?: PlanId | null;
  premiumUntil?: string | null; // ISO
  raw: unknown;
}
export interface WebhookVerifyResult { ok: boolean; event?: WebhookEvent; error?: string; }

export interface BillingProvider {
  id: BillingProviderId;
  configured: boolean;
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  verifyWebhook(rawBody: string, signature: string | null): Promise<WebhookVerifyResult>;
}

// --- Manual (varsayılan) sağlayıcı ------------------------------------------
const manualProvider: BillingProvider = {
  id: "manual",
  configured: false,
  async createCheckout() {
    return { ok: false, error: "Ödeme sağlayıcısı yapılandırılmamış. Premium şu an admin tarafından atanır." };
  },
  async verifyWebhook() {
    return { ok: false, error: "Sağlayıcı yok." };
  },
};

// --- Stripe sağlayıcı (iskelet) ---------------------------------------------
// Gerçek entegrasyon için: `npm i stripe`, STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET
// + fiyat ID'leri (STRIPE_PRICE_*) eklenir ve aşağıdaki TODO'lar doldurulur.
function makeStripeProvider(): BillingProvider {
  const configured = !!process.env.STRIPE_SECRET_KEY;
  return {
    id: "stripe",
    configured,
    async createCheckout(params) {
      if (!configured) return manualProvider.createCheckout(params);
      // TODO: const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      //       const session = await stripe.checkout.sessions.create({...});
      //       return { ok: true, url: session.url! };
      return { ok: false, error: "Stripe entegrasyonu tamamlanmadı (anahtarlar hazır)." };
    },
    async verifyWebhook(rawBody, signature) {
      if (!configured || !process.env.STRIPE_WEBHOOK_SECRET) return { ok: false, error: "Webhook secret yok." };
      if (!signature) return { ok: false, error: "İmza yok." };
      // TODO: stripe.webhooks.constructEvent(rawBody, signature, secret) ile doğrula
      //       ve tipini WebhookEvent'e map et.
      return { ok: false, error: "Stripe webhook doğrulaması tamamlanmadı." };
    },
  };
}

// --- iyzico sağlayıcı (Türkiye web) -----------------------------------------
// createCheckout gerçek ödeme sayfası URL'i döndürür; premium hakkı iyzico
// callback route'unda (retrieve) uygulanır — bu yüzden verifyWebhook no-op.
function makeIyzicoProvider(configured: boolean): BillingProvider {
  return {
    id: "iyzico",
    configured,
    async createCheckout(params) {
      const { iyzicoCreateCheckout } = await import("./iyzico");
      return iyzicoCreateCheckout(params);
    },
    async verifyWebhook() {
      return { ok: false, error: "iyzico callback route kullanır (webhook değil)." };
    },
  };
}

export function getBillingProvider(): BillingProvider {
  const explicit = process.env.BILLING_PROVIDER as BillingProviderId | undefined;
  // iyzico anahtarları varsa (veya açıkça seçildiyse) web ödemesi iyzico ile.
  if (explicit === "iyzico" || (!explicit && process.env.IYZICO_API_KEY && process.env.IYZICO_SECRET_KEY)) {
    return makeIyzicoProvider(!!(process.env.IYZICO_API_KEY && process.env.IYZICO_SECRET_KEY));
  }
  if (explicit === "stripe") return makeStripeProvider();
  // google_play: TWA içinde Digital Goods API + /api/billing/play/verify ile
  // işlenir (getBillingProvider üzerinden değil). Web'de manual'a düşer.
  return manualProvider;
}
