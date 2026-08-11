"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_TAGS } from "@/lib/data/catalog";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/features/users/guard";
import { muscleSchema } from "./schema";

export interface ActionResult<T = undefined> { ok: boolean; error?: string; data?: T; }
const fail = (e: string): ActionResult<never> => ({ ok: false, error: e });
const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v ?? null);

function slugify(s: string) {
  const m: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u" };
  return s.split("").map((c) => m[c] ?? c).join("").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toRow(v: z.output<typeof muscleSchema>) {
  return {
    name_tr: v.name_tr.trim(), latin_name: empty(v.latin_name), muscle_group: v.muscle_group.trim(), region: v.region,
    slug: v.slug && v.slug.trim() ? slugify(v.slug) : slugify(v.name_tr), svg_region_id: empty(v.svg_region_id),
    overview: empty(v.overview), functions: v.functions ?? [], origin: empty(v.origin), insertion: empty(v.insertion),
    innervation: empty(v.innervation), common_injuries: v.common_injuries ?? [], rehab_notes: empty(v.rehab_notes),
    joints: v.joints ?? [], daily_life: empty(v.daily_life), growth_tips: v.growth_tips ?? [],
    color: empty(v.color), model_region: empty(v.model_region), sort_order: v.sort_order ?? 0,
  };
}

export async function createMuscle(input: z.input<typeof muscleSchema>): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = muscleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("muscles").insert(toRow(parsed.data)).select("id").single();
  if (error) return fail(error.message);
  revalidatePath("/admin/anatomy");
  revalidateTag(CATALOG_TAGS.muscles);
  return { ok: true, data: { id: data.id as string } };
}

export async function updateMuscle(input: z.input<typeof muscleSchema> & { id: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = muscleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = createAdminClient();
  const { error } = await supabase.from("muscles").update(toRow(parsed.data)).eq("id", input.id);
  if (error) return fail(error.message);
  revalidatePath("/admin/anatomy");
  revalidateTag(CATALOG_TAGS.muscles);
  revalidatePath(`/admin/anatomy/${input.id}`);
  return { ok: true };
}

export async function deleteMuscle(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("muscles").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/admin/anatomy");
  revalidateTag(CATALOG_TAGS.muscles);
  return { ok: true };
}
