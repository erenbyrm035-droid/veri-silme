// Google Play Billing — satın alma doğrulama (TWA/native içinden gelir).
// Client Digital Goods API ile satın alır, purchaseToken'ı buraya gönderir.
// Sunucu, Google Play Developer API ile token'ı doğrular → premium uygular.
//
// Env: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (service account key, JSON string),
//      ANDROID_PACKAGE_NAME (ör. com.viva.aicoach)
import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PLANS, premiumUntilFor, type PlanId } from "@/lib/premium/plans";
import { reportError } from "@/lib/observability/report-server";

export const runtime = "nodejs";

function planForSku(sku: string): PlanId | null {
  return PLANS.find((p) => p.playSku === sku)?.id ?? null;
}

export async function POST(request: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Oturum yok." }, { status: 401 });

  const saJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  const pkg = process.env.ANDROID_PACKAGE_NAME;
  if (!saJson || !pkg) return NextResponse.json({ ok: false, error: "Play doğrulaması yapılandırılmadı." }, { status: 501 });

  let body: { sku?: string; purchaseToken?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "Geçersiz istek." }, { status: 400 }); }
  const { sku, purchaseToken } = body;
  if (!sku || !purchaseToken) return NextResponse.json({ ok: false, error: "sku/token eksik." }, { status: 400 });

  const plan = planForSku(sku);
  if (!plan) return NextResponse.json({ ok: false, error: "Bilinmeyen ürün." }, { status: 400 });

  try {
    const auth = new GoogleAuth({
      credentials: JSON.parse(saJson),
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    const token = await auth.getAccessToken();
    const isSub = PLANS.find((p) => p.id === plan)?.durationDays != null;
    const url = isSub
      ? `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases/subscriptions/${sku}/tokens/${purchaseToken}`
      : `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases/products/${sku}/tokens/${purchaseToken}`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return NextResponse.json({ ok: false, error: "Doğrulanamadı." }, { status: 400 });
    const data = (await res.json()) as { purchaseState?: number; expiryTimeMillis?: string; paymentState?: number };

    // Ürün (tek seferlik): purchaseState 0 = satın alındı.
    // Abonelik: paymentState 1 = ödendi; expiryTimeMillis geçerlilik.
    const valid = isSub ? data.paymentState === 1 : data.purchaseState === 0;
    if (!valid) return NextResponse.json({ ok: false, error: "Satın alma geçerli değil." }, { status: 400 });

    const until = isSub && data.expiryTimeMillis
      ? new Date(Number(data.expiryTimeMillis)).toISOString()
      : premiumUntilFor(plan);

    const admin = createAdminClient();
    const eventId = `play:${purchaseToken}`;
    const { data: exists } = await admin.from("billing_events").select("id").eq("event_id", eventId).maybeSingle();
    if (!exists) {
      await admin.from("billing_events").insert({
        event_id: eventId, provider: "google_play", type: "checkout.completed",
        user_id: user.id, payload: { sku, plan },
      });
    }
    await admin.from("profiles").update({
      is_premium: true,
      membership_type: plan === "lifetime" ? "lifetime" : "premium",
      premium_until: until,
    }).eq("id", user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    await reportError(err, { where: "api/billing/play/verify", severity: "error" });
    return NextResponse.json({ ok: false, error: "Sunucu hatası." }, { status: 500 });
  }
}
