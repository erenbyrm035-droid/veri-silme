"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/features/users/guard";

export interface ActionResult { ok: boolean; error?: string; }

/** Bir ayar grubunu (key) günceller. */
export async function saveSetting(key: string, value: Record<string, unknown>): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (!["ai", "features", "site", "nutrition_ai"].includes(key)) return { ok: false, error: "Geçersiz ayar." };
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    { key, value, updated_by: ctx.id, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/settings");
  return { ok: true };
}
