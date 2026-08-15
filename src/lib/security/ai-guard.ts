import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkRateLimitAsync, clientKey, tooManyRequests } from "./rate-limit";
import { getEntitlements } from "@/lib/premium/entitlements";

/**
 * Herkese uygulanan ANLIK patlama sınırı — premium dahil.
 *
 * NEDEN: aşağıdaki günlük kota yalnızca Free kullanıcıya uygulanıyor, premium
 * `null` (sınırsız) alıp erken dönüyordu. Bu, ürün açısından doğru — premium
 * "sınırsız AI" satın alıyor — ama teknik açıdan bu uçların HER ÇAĞRISI
 * gerçek para harcıyor (OpenAI/Anthropic token). Tek bir premium hesabın
 * oturum çerezi sızsa ya da kullanıcı bir betik yazsa, saniyede onlarca
 * çağrıyla AI bütçesi boşaltılabilirdi ve hiçbir sayaç bunu görmezdi.
 *
 * Patlama sınırı kullanıcının hakkını DEĞİŞTİRMEZ: dakikada 12 istek, insan
 * kullanımının çok üstünde bir tavan. "Sınırsız" vaadi günlük/aylık toplamda
 * geçerli kalıyor; kısıtlanan yalnızca otomatik yığın çağrı.
 */
const BURST = { limit: 12, windowMs: 60_000 };

/**
 * AI / pahalı uç noktalar için ortak rate-limit kapısı.
 * Premium kullanıcılar günlük kotadan muaf; Free kullanıcılar GÜNLÜK
 * pencereyle sınırlı. Anlık patlama sınırı İKİSİNE DE uygulanır.
 * Sınır aşılırsa 429 Response döner, aksi halde null (devam).
 */
export async function aiRateGuard(
  request: Request,
  supabase: SupabaseClient,
  userId: string
): Promise<Response | null> {
  const key = clientKey(request, userId);

  // Önce patlama sınırı — profil sorgusundan da önce, çünkü yığın çağrıda
  // her istek için profiles'a gitmek de ayrı bir yük.
  const burst = await checkRateLimitAsync(`ai:burst:${key}`, BURST);
  if (!burst.ok) return tooManyRequests(burst.retryAfterSec);

  const { data: profile } = await supabase
    .from("profiles").select("is_premium, membership_type, premium_until").eq("id", userId).maybeSingle();
  const ent = getEntitlements(profile ?? undefined);
  if (ent.aiLimitPerWindow === null) return null; // Premium: günlük kota yok
  const rl = await checkRateLimitAsync(`ai:${key}`, { limit: ent.aiLimitPerWindow, windowMs: 24 * 60 * 60 * 1000 });
  return rl.ok ? null : tooManyRequests(rl.retryAfterSec);
}
