// iyzico ödeme entegrasyonu (Türkiye web). Checkout Form akışı.
// Anahtarlar: IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_URI (opsiyonel).
//   - Sandbox: https://sandbox-api.iyzipay.com
//   - Prod:    https://api.iyzipay.com  (varsayılan)
import "server-only";
// eslint-disable-next-line @typescript-eslint/no-require-imports
import Iyzipay from "iyzipay";
import { planById, type PlanId } from "@/lib/premium/plans";
import { createAdminClient } from "@/lib/supabase/server";
import type { CheckoutParams, CheckoutResult } from "./provider";

export function iyzicoConfigured(): boolean {
  return !!(process.env.IYZICO_API_KEY && process.env.IYZICO_SECRET_KEY);
}

function client() {
  return new Iyzipay({
    apiKey: process.env.IYZICO_API_KEY!,
    secretKey: process.env.IYZICO_SECRET_KEY!,
    uri: process.env.IYZICO_URI || "https://api.iyzipay.com",
  });
}

// conversationId'ye kullanıcı + plan gömülür (callback'te geri okunur).
function encodeConv(userId: string, plan: PlanId) { return `${userId}|${plan}`; }
export function decodeConv(conv: string): { userId: string; plan: PlanId } | null {
  const [userId, plan] = (conv || "").split("|");
  if (!userId || !plan) return null;
  return { userId, plan: plan as PlanId };
}

/** Checkout Form başlatır → ödeme sayfası URL'i döndürür. */
export async function iyzicoCreateCheckout(params: CheckoutParams): Promise<CheckoutResult> {
  try {
    return await createCheckoutInner(params);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `iyzico: ${e.message}` : "iyzico isteği başarısız." };
  }
}

async function createCheckoutInner(params: CheckoutParams): Promise<CheckoutResult> {
  if (!iyzicoConfigured()) return { ok: false, error: "iyzico anahtarları tanımlı değil." };
  const plan = planById(params.plan);
  if (!plan.priceTry) return { ok: false, error: "Bu plan için fiyat tanımlı değil." };

  const price = plan.priceTry.toFixed(2);
  const conv = encodeConv(params.userId, params.plan);
  const iyzipay = client();

  const request = {
    locale: "tr",
    conversationId: conv,
    price,
    paidPrice: price,
    currency: "TRY",
    basketId: params.userId,
    paymentGroup: plan.durationDays == null ? "PRODUCT" : "SUBSCRIPTION",
    callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://veri-silme.vercel.app"}/api/billing/iyzico/callback`,
    enabledInstallments: [1, 2, 3, 6],
    buyer: {
      id: params.userId,
      name: "Viva",
      surname: "Kullanıcı",
      gsmNumber: "+905350000000",
      email: params.email || "kullanici@viva.app",
      identityNumber: "11111111111",
      registrationAddress: "Viva AI Coach, Istanbul",
      ip: "85.34.78.112",
      city: "Istanbul",
      country: "Turkey",
      zipCode: "34000",
    },
    // iyzico hem billing HEM shipping adresi ister — ikisi de zorunlu.
    billingAddress: { contactName: "Viva Kullanıcı", city: "Istanbul", country: "Turkey", address: "Viva AI Coach, Istanbul", zipCode: "34000" },
    shippingAddress: { contactName: "Viva Kullanıcı", city: "Istanbul", country: "Turkey", address: "Viva AI Coach, Istanbul", zipCode: "34000" },
    basketItems: [
      { id: params.plan, name: plan.name, category1: "Abonelik", itemType: "VIRTUAL", price },
    ],
  };

  return new Promise<CheckoutResult>((resolve) => {
    // SDK hiç geri dönmezse buton sonsuz "Yönlendiriliyor" kalmasın diye zaman aşımı.
    const t = setTimeout(() => resolve({ ok: false, error: "iyzico yanıt vermedi (zaman aşımı)." }), 20000);
    try {
      iyzipay.checkoutFormInitialize.create(request, (err: unknown, result: { status: string; token?: string; paymentPageUrl?: string; errorMessage?: string }) => {
        clearTimeout(t);
        if (err) return resolve({ ok: false, error: "iyzico bağlantı hatası." });
        if (result?.status === "success" && result.paymentPageUrl) {
          // token→kullanıcı/plan eşlemesini kaydet (callback conversationId'ye güvenmesin).
          if (result.token) {
            const admin = createAdminClient();
            admin.from("billing_events").insert({
              event_id: `iyzico_pending:${result.token}`,
              provider: "iyzico", type: "checkout.pending",
              user_id: params.userId, payload: { plan: params.plan },
            }).then(() => undefined, () => undefined);
          }
          return resolve({ ok: true, url: result.paymentPageUrl });
        }
        resolve({ ok: false, error: result?.errorMessage || "iyzico ödeme başlatılamadı." });
      });
    } catch (e) {
      clearTimeout(t);
      resolve({ ok: false, error: e instanceof Error ? e.message : "iyzico isteği oluşturulamadı." });
    }
  });
}

/** Token'a karşılık gelen kullanıcı/plan eşlemesini (checkout başlangıcında kaydedilen) getirir. */
export async function iyzicoLookupPending(token: string): Promise<{ userId: string; plan: PlanId } | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("billing_events")
      .select("user_id, payload").eq("event_id", `iyzico_pending:${token}`).maybeSingle();
    if (!data?.user_id) return null;
    const plan = (data.payload as { plan?: string })?.plan as PlanId | undefined;
    if (!plan) return null;
    return { userId: data.user_id, plan };
  } catch { return null; }
}

/** Callback token'ı ile ödeme sonucunu doğrular. */
export async function iyzicoRetrieve(token: string): Promise<{ ok: boolean; userId?: string; plan?: PlanId; paid?: boolean; reason?: string }> {
  if (!iyzicoConfigured()) return { ok: false, reason: "not_configured" };
  try {
    const iyzipay = client();
    return await new Promise((resolve) => {
      const t = setTimeout(() => resolve({ ok: false, reason: "timeout" }), 20000);
      iyzipay.checkoutForm.retrieve(
        { locale: "tr", conversationId: "", token },
        (err: unknown, result: { status?: string; paymentStatus?: string; conversationId?: string; errorMessage?: string; errorCode?: string }) => {
          clearTimeout(t);
          if (err) return resolve({ ok: false, reason: "sdk_error" });
          if (result?.status !== "success") return resolve({ ok: false, reason: `api_${result?.status ?? "nores"}:${result?.errorCode ?? ""}:${result?.errorMessage ?? ""}` });
          const info = decodeConv(result.conversationId || "");
          resolve({
            ok: true,
            userId: info?.userId,
            plan: info?.plan,
            paid: result.paymentStatus === "SUCCESS",
            reason: `paymentStatus=${result.paymentStatus}`,
          });
        }
      );
    });
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "exception" };
  }
}
