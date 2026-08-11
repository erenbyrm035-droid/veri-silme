// Yetkilendirme (entitlement) motoru — bir profilin hangi premium haklara
// sahip olduğunu belirler. Mevcut profiles alanlarını kullanır
// (is_premium, membership_type, premium_until). Client & server güvenli.
import { type FeatureKey, type PlanId, FREE_LIMITS, planById } from "./plans";

export interface ProfileLike {
  is_premium?: boolean | null;
  membership_type?: string | null;
  premium_until?: string | null;
}

export interface Entitlements {
  plan: PlanId;
  isPremium: boolean;
  features: Set<FeatureKey>;
  aiLimitPerWindow: number | null;   // null = sınırsız (Premium)
  maxPrograms: number | null;
  maxDiets: number | null;
  premiumUntil: string | null;
}

function normalizePlan(p?: ProfileLike): PlanId {
  const mt = (p?.membership_type ?? "free").toLowerCase();
  if (mt === "lifetime") return "lifetime";
  if (mt === "premium" || mt === "premium_monthly") return "premium_monthly";
  if (mt === "premium_yearly" || mt === "yearly") return "premium_yearly";
  if (mt === "trial") return "premium_monthly";
  return "free";
}

/** Süresi geçmiş premium'u free sayar (client tarafı güvenli değerlendirme). */
function isActivePremium(p?: ProfileLike): boolean {
  if (!p?.is_premium) return false;
  if (p.membership_type === "lifetime") return true;
  if (!p.premium_until) return true; // süre yoksa aktif kabul (admin verdiyse)
  return new Date(p.premium_until).getTime() > Date.now();
}

/**
 * Test/lansman için global kilit açma. `PREMIUM_UNLOCK_ALL=true` iken
 * herkes tüm premium özelliklere erişir (sunucu tarafı env; client'a sızmaz).
 * Kapatmak için env'i "false" yap veya kaldır.
 */
function unlockAllEnabled(): boolean {
  return process.env.PREMIUM_UNLOCK_ALL === "true";
}

export function getEntitlements(profile?: ProfileLike): Entitlements {
  const unlockAll = unlockAllEnabled();
  const active = isActivePremium(profile) || unlockAll;
  // Kilit açma modunda free profil de tam premium plan sayılır.
  let plan = active ? normalizePlan(profile) : "free";
  if (unlockAll && plan === "free") plan = "premium_yearly";
  const planDef = planById(plan);
  const features = new Set<FeatureKey>(active ? planDef.features : []);
  return {
    plan,
    isPremium: active,
    features,
    aiLimitPerWindow: active ? null : FREE_LIMITS.aiPerDay,
    maxPrograms: active ? null : FREE_LIMITS.maxPrograms,
    maxDiets: active ? null : FREE_LIMITS.maxDiets,
    premiumUntil: profile?.premium_until ?? null,
  };
}

export function hasFeature(profile: ProfileLike | undefined, feature: FeatureKey): boolean {
  return getEntitlements(profile).features.has(feature);
}
