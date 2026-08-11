"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/features/users/guard";

export interface ActionResult { ok: boolean; error?: string; }
const fail = (error: string): ActionResult => ({ ok: false, error });

const promptSchema = z.object({
  key: z.string().default("coach_system"),
  content: z.string().trim().min(10, "En az 10 karakter"),
  notes: z.string().trim().max(300).optional(),
  activate: z.boolean().default(true),
});

/** Yeni sistem promptu sürümü oluşturur (opsiyonel olarak aktifleştirir). */
export async function createPromptVersion(input: z.input<typeof promptSchema>): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = promptSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = createAdminClient();
  const key = parsed.data.key;

  const { data: last } = await supabase.from("ai_prompt_versions").select("version").eq("key", key).order("version", { ascending: false }).limit(1);
  const nextVersion = ((last?.[0]?.version as number) ?? 0) + 1;

  if (parsed.data.activate) {
    await supabase.from("ai_prompt_versions").update({ is_active: false }).eq("key", key);
  }
  const { error } = await supabase.from("ai_prompt_versions").insert({
    key, version: nextVersion, content: parsed.data.content, notes: parsed.data.notes ?? null,
    is_active: parsed.data.activate, created_by: ctx.id,
  });
  if (error) return fail(error.message);
  revalidatePath("/admin/ai");
  return { ok: true };
}

export async function activatePrompt(id: string, key = "coach_system"): Promise<ActionResult> {
  await requireAdmin();
  const supabase = createAdminClient();
  await supabase.from("ai_prompt_versions").update({ is_active: false }).eq("key", key);
  const { error } = await supabase.from("ai_prompt_versions").update({ is_active: true }).eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/admin/ai");
  return { ok: true };
}

export async function deletePromptVersion(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("ai_prompt_versions").delete().eq("id", id).eq("is_active", false);
  if (error) return fail(error.message);
  revalidatePath("/admin/ai");
  return { ok: true };
}
