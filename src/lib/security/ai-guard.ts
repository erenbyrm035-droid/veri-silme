import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkRateLimitAsync, clientKey, tooManyRequests } from "./rate-limit";
import { getEntitlements } from "@/lib/premium/entitlements";

/**
 * AI / pahalı uç noktalar için ortak rate-limit kapısı.
 * Premium kullanıcılar sınırsız; Free kullanıcılar GÜNLÜK pencereyle sınırlı.
 * Sınır aşılırsa 429 Response döner, aksi halde null (devam).
 */
export async function aiRateGuard(
  request: Request,
  supabase: SupabaseClient,
  userId: string
): Promise<Response | null> {
  const { data: profile } = await supabase
    .from("profiles").select("is_premium, membership_type, premium_until").eq("id", userId).maybeSingle();
  const ent = getEntitlements(profile ?? undefined);
  if (ent.aiLimitPerWindow === null) return null; // Premium: sınırsız
  const rl = await checkRateLimitAsync(`ai:${clientKey(request, userId)}`, { limit: ent.aiLimitPerWindow, windowMs: 24 * 60 * 60 * 1000 });
  return rl.ok ? null : tooManyRequests(rl.retryAfterSec);
}
