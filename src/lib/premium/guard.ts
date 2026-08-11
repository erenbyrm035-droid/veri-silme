import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements, type Entitlements } from "./entitlements";
import type { FeatureKey } from "./plans";

/** Geçerli kullanıcının yetkilerini sunucuda hesaplar. */
export async function getUserEntitlements(): Promise<Entitlements> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return getEntitlements(undefined);
  const { data } = await supabase
    .from("profiles").select("is_premium, membership_type, premium_until").eq("id", user.id).maybeSingle();
  return getEntitlements(data ?? undefined);
}

/** Bir premium özelliği zorunlu kılar; yoksa hata fırlatır (server action guard). */
export async function requireFeature(feature: FeatureKey): Promise<Entitlements> {
  const ent = await getUserEntitlements();
  if (!ent.features.has(feature)) throw new Error("Bu özellik Premium üyelik gerektirir.");
  return ent;
}
