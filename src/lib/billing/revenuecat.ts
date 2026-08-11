import "server-only";
import type { PlanId } from "@/lib/premium/plans";

// ============================================================================
// RevenueCat entegrasyonu (iOS/Android IAP).
// App tarafında Purchases.logIn(user.id) ile app_user_id = Supabase user id
// yapılır. Webhook (bu backend) satın alma/yenileme/iptal olaylarını alır ve
// Supabase profiles entitlement alanlarını günceller (mevcut motor değişmez).
// ============================================================================

/** RevenueCat webhook olay gövdesi (kullandığımız alanlar). */
export interface RevenueCatEvent {
  id: string;                       // olay kimliği (idempotency)
  type: string;                     // INITIAL_PURCHASE | RENEWAL | ...
  app_user_id: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  entitlement_ids?: string[] | null;
  period_type?: string;             // NORMAL | TRIAL | INTRO
  purchased_at_ms?: number;
  expiration_at_ms?: number | null;
  store?: string;                   // APP_STORE | PLAY_STORE | ...
  environment?: string;             // SANDBOX | PRODUCTION
  subscriber_attributes?: Record<string, { value: string }>;
}

/** Ürün kimliğinden plan çıkarımı (App Store Connect ürün id'lerine göre). */
export function productToPlan(productId?: string | null): PlanId {
  const id = (productId ?? "").toLowerCase();
  if (!id) return "premium_monthly";
  if (id.includes("life")) return "lifetime";
  if (id.includes("year") || id.includes("annual") || id.includes("yil")) return "premium_yearly";
  if (id.includes("month") || id.includes("ay")) return "premium_monthly";
  return "premium_monthly";
}

/** Olay tipine göre ne yapılacağı: premium ver / süreyi koru / geri al / yok say. */
export type RcAction = "grant" | "keep" | "revoke" | "ignore";

export function actionForEvent(type: string): RcAction {
  switch (type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE":
    case "NON_RENEWING_PURCHASE":  // lifetime
    case "UNCANCELLATION":
    case "SUBSCRIPTION_EXTENDED":
      return "grant";
    case "CANCELLATION":           // otomatik yenileme kapatıldı — süre bitene dek premium
    case "BILLING_ISSUE":          // ödeme sorunu — grace period, henüz düşürme
    case "SUBSCRIPTION_PAUSED":
      return "keep";
    case "EXPIRATION":
    case "REFUND":
      return "revoke";
    default:
      return "ignore";
  }
}

/** UUID doğrulaması (Supabase user id beklenir). */
export function looksLikeUuid(v: string | undefined | null): v is string {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Olaydaki en olası Supabase user id'sini çözer. */
export function resolveUserId(ev: RevenueCatEvent): string | null {
  const attr = ev.subscriber_attributes?.["$supabaseUserId"]?.value
    ?? ev.subscriber_attributes?.["supabase_user_id"]?.value;
  if (looksLikeUuid(attr)) return attr;
  if (looksLikeUuid(ev.app_user_id)) return ev.app_user_id;
  if (looksLikeUuid(ev.original_app_user_id)) return ev.original_app_user_id;
  const alias = (ev.aliases ?? []).find(looksLikeUuid);
  return alias ?? null;
}
