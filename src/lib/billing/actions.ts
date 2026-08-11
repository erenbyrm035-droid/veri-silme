"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getBillingProvider } from "./provider";
import type { PlanId } from "@/lib/premium/plans";

export interface CheckoutActionResult { ok: boolean; url?: string; error?: string; }

/** Seçilen plan için ödeme oturumu başlatır. Sağlayıcı yoksa bilgilendirir. */
export async function startCheckout(plan: PlanId): Promise<CheckoutActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };
  if (plan === "free") return { ok: false, error: "Free plan için ödeme gerekmez." };

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://veri-silme.vercel.app";
  try {
    const provider = getBillingProvider();
    return await provider.createCheckout({
      userId: user.id, email: user.email ?? null, plan,
      successUrl: `${site}/premium?success=1`, cancelUrl: `${site}/premium?canceled=1`,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ödeme başlatılamadı." };
  }
}

/**
 * Premium üyeliği iptal eder → hemen Free'ye düşürür.
 * (Sistemde otomatik yenileme yok; iptal = erişimi sonlandır + kayıt tut.)
 */
export async function cancelPremium(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };
  try {
    const admin = createAdminClient();
    await admin.from("profiles").update({
      is_premium: false,
      membership_type: "free",
      premium_until: new Date().toISOString(),
    }).eq("id", user.id);
    // Denetim kaydı (idempotent değil; her iptal ayrı olay)
    await admin.from("billing_events").insert({
      event_id: `cancel:${user.id}:${Date.now()}`,
      provider: "manual", type: "subscription.canceled", user_id: user.id, payload: {},
    }).then(() => undefined, () => undefined);
    revalidatePath("/premium");
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "İptal edilemedi." };
  }
}
