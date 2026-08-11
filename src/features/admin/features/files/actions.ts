"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/features/users/guard";

export interface ActionResult { ok: boolean; error?: string; }

export async function deleteObject(bucket: string, path: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/files");
  return { ok: true };
}
