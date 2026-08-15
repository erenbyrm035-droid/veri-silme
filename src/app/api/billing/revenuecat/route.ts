// RevenueCat webhook — iOS/Android IAP olaylarını alır ve Supabase entitlement
// alanlarını (profiles.is_premium/membership_type/premium_until) günceller.
// RevenueCat Dashboard → Integrations → Webhooks: URL = /api/billing/revenuecat,
// Authorization header = REVENUECAT_WEBHOOK_SECRET.
// HIZ SINIRI YOK — BİLEREK. Bu ucu çağıran kullanıcı değil, ödeme
// sağlayıcısının sunucusu. IP başına bir sınır meşru bir ödeme bildirimini
// düşürebilir ve kullanıcının parası gittiği hâlde üyeliği açılmaz — sessiz
// ve pahalı bir tutarsızlık. Koruma başka katmanda: imza/kimlik doğrulaması
// ve `billing_events.event_id` ile idempotency (aynı olay iki kez işlenmez).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { premiumUntilFor } from "@/lib/premium/plans";
import { reportError } from "@/lib/observability/report-server";
import {
  productToPlan, actionForEvent, resolveUserId, type RevenueCatEvent,
} from "@/lib/billing/revenuecat";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // 1) Yetki: RevenueCat'in Authorization header'ı ile paylaşılan sır eşleşmeli.
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== secret && auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null);
  const ev = (body?.event ?? null) as RevenueCatEvent | null;
  if (!ev?.id || !ev?.type) return NextResponse.json({ ok: true, skipped: "no_event" });

  try {
    const admin = createAdminClient();

    // 2) İdempotentlik — aynı olay iki kez işlenmesin.
    const eventId = `revenuecat:${ev.id}`;
    const { data: exists } = await admin.from("billing_events").select("id").eq("event_id", eventId).maybeSingle();
    if (exists) return NextResponse.json({ ok: true, duplicate: true });

    const userId = resolveUserId(ev);
    const action = actionForEvent(ev.type);
    const plan = productToPlan(ev.product_id);

    // Denetim kaydı (userId çözülemese de tut).
    await admin.from("billing_events").insert({
      event_id: eventId, provider: "revenuecat", type: ev.type, user_id: userId,
      payload: { product_id: ev.product_id, store: ev.store, environment: ev.environment, plan, action, expiration_at_ms: ev.expiration_at_ms ?? null },
    });

    if (!userId) {
      await reportError(new Error("RevenueCat: user id çözülemedi"), { where: "api/billing/revenuecat", severity: "warning" });
      return NextResponse.json({ ok: true, warning: "no_user" });
    }
    if (action === "ignore" || action === "keep") {
      return NextResponse.json({ ok: true, action });
    }

    if (action === "grant") {
      // Süre: aboneliklerde RC bitiş zamanı; yoksa plana göre; lifetime → uzak gelecek.
      const until = plan === "lifetime"
        ? premiumUntilFor("lifetime")
        : (ev.expiration_at_ms ? new Date(ev.expiration_at_ms).toISOString() : premiumUntilFor(plan));
      await admin.from("profiles").update({
        is_premium: true,
        membership_type: plan === "lifetime" ? "lifetime" : "premium",
        premium_until: until,
      }).eq("id", userId);
      return NextResponse.json({ ok: true, action, plan });
    }

    // action === "revoke"
    await admin.from("profiles").update({
      is_premium: false,
      membership_type: "free",
      premium_until: new Date().toISOString(),
    }).eq("id", userId);
    return NextResponse.json({ ok: true, action: "revoke" });
  } catch (err) {
    await reportError(err, { where: "api/billing/revenuecat", severity: "error" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
