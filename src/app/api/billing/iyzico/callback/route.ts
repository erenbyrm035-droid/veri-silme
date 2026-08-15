// iyzico ödeme dönüşü — ödeme sayfasından POST ile 'token' gelir.
// Sonucu doğrular, başarılıysa premium hakkını uygular, /premium'a yönlendirir.
// HIZ SINIRI YOK — BİLEREK. Bu ucu çağıran kullanıcı değil, ödeme
// sağlayıcısının sunucusu. IP başına bir sınır meşru bir ödeme bildirimini
// düşürebilir ve kullanıcının parası gittiği hâlde üyeliği açılmaz — sessiz
// ve pahalı bir tutarsızlık. Koruma başka katmanda: imza/kimlik doğrulaması
// ve `billing_events.event_id` ile idempotency (aynı olay iki kez işlenmez).
import { NextResponse } from "next/server";
import { iyzicoRetrieve, iyzicoLookupPending } from "@/lib/billing/iyzico";
import { createAdminClient } from "@/lib/supabase/server";
import { premiumUntilFor } from "@/lib/premium/plans";
import { reportError } from "@/lib/observability/report-server";

export const runtime = "nodejs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://veri-silme.vercel.app";

export async function POST(request: Request) {
  let token = "";
  try {
    const form = await request.formData();
    token = String(form.get("token") ?? "");
  } catch {
    const url = new URL(request.url);
    token = url.searchParams.get("token") ?? "";
  }
  if (!token) return NextResponse.redirect(`${SITE}/premium?canceled=1`, { status: 303 });

  try {
    const res = await iyzicoRetrieve(token);
    // Ödeme başarılı değilse iptal.
    if (!res.ok || !res.paid) {
      const reason = encodeURIComponent(res.reason ?? "unknown");
      return NextResponse.redirect(`${SITE}/premium?canceled=1&reason=${reason}`, { status: 303 });
    }

    // Kullanıcı/plan: önce conversationId decode, olmazsa token→pending eşlemesi.
    let userId = res.userId;
    let plan = res.plan;
    if (!userId || !plan) {
      const pending = await iyzicoLookupPending(token);
      if (pending) { userId = pending.userId; plan = pending.plan; }
    }
    if (!userId || !plan) {
      return NextResponse.redirect(`${SITE}/premium?canceled=1&reason=no_mapping`, { status: 303 });
    }

    const supabase = createAdminClient();
    // İdempotentlik + denetim kaydı
    const eventId = `iyzico:${token}`;
    const { data: exists } = await supabase.from("billing_events").select("id").eq("event_id", eventId).maybeSingle();
    if (!exists) {
      await supabase.from("billing_events").insert({
        event_id: eventId, provider: "iyzico", type: "checkout.completed",
        user_id: userId, payload: { plan, token },
      });
      await supabase.from("profiles").update({
        is_premium: true,
        membership_type: plan === "lifetime" ? "lifetime" : "premium",
        premium_until: premiumUntilFor(plan),
      }).eq("id", userId);
    }
    return NextResponse.redirect(`${SITE}/premium?success=1`, { status: 303 });
  } catch (err) {
    await reportError(err, { where: "api/billing/iyzico/callback", severity: "error" });
    return NextResponse.redirect(`${SITE}/premium?canceled=1`, { status: 303 });
  }
}
