import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Program } from "@/lib/database.types";

export async function getPrograms(userId: string): Promise<Program[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("programs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Program[];
}

export async function getProgramById(id: string, userId: string): Promise<Program | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("programs")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Program) ?? null;
}
