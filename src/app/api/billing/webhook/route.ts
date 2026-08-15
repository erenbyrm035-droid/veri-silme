// Ödeme webhook alıcısı — sağlayıcı-bağımsız.
// İmza doğrular → billing_events'e idempotent yazar → premium hakkını uygular.
// Sağlayıcı yapılandırılmamışsa güvenle 200/no-op döner (uygulamayı bozmaz).
// HIZ SINIRI YOK — BİLEREK. Bu ucu çağıran kullanıcı değil, ödeme
// sağlayıcısının sunucusu. IP başına bir sınır meşru bir ödeme bildirimini
// düşürebilir ve kullanıcının parası gittiği hâlde üyeliği açılmaz — sessiz
// ve pahalı bir tutarsızlık. Koruma başka katmanda: imza/kimlik doğrulaması
// ve `billing_events.event_id` ile idempotency (aynı olay iki kez işlenmez).
import { getBillingProvider } from "@/lib/billing/provider";
import { createAdminClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability/report-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const provider = getBillingProvider();
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") ?? request.headers.get("x-signature");

  const verify = await provider.verifyWebhook(rawBody, signature);
  if (!verify.ok || !verify.event) {
    // Yapılandırılmamışsa 200 döneriz ki sağlayıcı retry fırtınası olmasın.
    return new Response(JSON.stringify({ received: true, applied: false, reason: verify.error }), {
      status: provider.configured ? 400 : 200, headers: { "content-type": "application/json" },
    });
  }

  const ev = verify.event;
  try {
    const supabase = createAdminClient();
    // İdempotentlik: aynı event iki kez işlenmesin.
    const { data: exists } = await supabase.from("billing_events").select("id").eq("event_id", ev.id).maybeSingle();
    if (exists) return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });

    await supabase.from("billing_events").insert({
      event_id: ev.id, provider: provider.id, type: ev.type, user_id: ev.userId ?? null, payload: ev.raw,
    });

    // Premium hakkını uygula
    if (ev.userId && (ev.type.includes("completed") || ev.type.includes("active") || ev.type.includes("renew"))) {
      await supabase.from("profiles").update({
        is_premium: true,
        membership_type: ev.plan === "lifetime" ? "lifetime" : "premium",
        premium_until: ev.premiumUntil ?? null,
      }).eq("id", ev.userId);
    } else if (ev.userId && (ev.type.includes("deleted") || ev.type.includes("cancel") || ev.type.includes("expire"))) {
      await supabase.from("profiles").update({ is_premium: false, membership_type: "free" }).eq("id", ev.userId);
    }

    return new Response(JSON.stringify({ received: true, applied: true }), { status: 200 });
  } catch (err) {
    await reportError(err, { where: "api/billing/webhook", severity: "error", extra: { eventType: ev.type } });
    return new Response(JSON.stringify({ received: true, applied: false }), { status: 500 });
  }
}
