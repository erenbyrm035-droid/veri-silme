import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getEntitlements } from "./entitlements";

/**
 * Free plan içerik kotalarını (program/diyet sayısı) sunucuda zorunlu kılar.
 * Premium → sınırsız (null). Kota dolduysa 402 Response döner, aksi halde null.
 *
 * @param table  Sayılacak tablo ("programs" | "meal_plans")
 * @param kind   Kota türü ("program" | "diet") — hangi limit alanı kullanılacak
 */
export async function contentQuotaGuard(
  supabase: SupabaseClient,
  userId: string,
  table: "programs" | "meal_plans",
  kind: "program" | "diet"
): Promise<Response | null> {
  const { data: profile } = await supabase
    .from("profiles").select("is_premium, membership_type, premium_until").eq("id", userId).maybeSingle();
  const ent = getEntitlements(profile ?? undefined);
  const cap = kind === "program" ? ent.maxPrograms : ent.maxDiets;
  if (cap === null) return null; // Premium: sınırsız

  const { count } = await supabase
    .from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) < cap) return null;

  const label = kind === "program" ? "program" : "diyet planı";
  return NextResponse.json(
    {
      error: `Free üyelikte en fazla ${cap} ${label} oluşturabilirsin. Sınırsız için Premium'a yükselt.`,
      code: "quota_exceeded",
      upgrade: "/premium",
    },
    { status: 402 }
  );
}
