import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { Muscle } from "@/lib/database.types";

export { muscleSchema, type MuscleFormValues } from "./schema";

const PAGE = 20;

export async function listMuscles(p: { q?: string; region?: string; page?: number }): Promise<{ rows: Muscle[]; total: number; page: number; pageCount: number; pageSize: number }> {
  const supabase = createAdminClient();
  const page = Math.max(1, p.page ?? 1);
  const from = (page - 1) * PAGE, to = from + PAGE - 1;
  let query = supabase.from("muscles").select("*", { count: "exact" }).order("sort_order").order("name_tr");
  if (p.region) query = query.eq("region", p.region);
  if (p.q) { const t = p.q.replace(/[,()*%]/g, " ").trim(); if (t) query = query.or(`name_tr.ilike.%${t}%,latin_name.ilike.%${t}%,muscle_group.ilike.%${t}%`); }
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return { rows: (data ?? []) as Muscle[], total, page, pageCount: Math.max(1, Math.ceil(total / PAGE)), pageSize: PAGE };
}

export async function getMuscle(id: string): Promise<Muscle | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("muscles").select("*").eq("id", id).maybeSingle();
  return (data as Muscle) ?? null;
}
