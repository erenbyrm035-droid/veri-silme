import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AiMemory } from "@/lib/database.types";

/** Kullanıcının AI hafızasını getirir (yoksa null). */
export async function getMemory(userId: string): Promise<AiMemory | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("ai_memory").select("*").eq("user_id", userId).maybeSingle();
  return (data as AiMemory) ?? null;
}

/** Hafıza özetini günceller (upsert). */
export async function upsertMemory(userId: string, summary: string, facts?: string[]): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { user_id: userId, summary, updated_at: new Date().toISOString() };
  if (facts) patch.facts = facts;
  await supabase.from("ai_memory").upsert(patch, { onConflict: "user_id" });
}

/** Hafızayı temizler. */
export async function clearMemory(userId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("ai_memory").delete().eq("user_id", userId);
}

/** Hafızayı prompt metnine çevirir. */
export function memoryToPrompt(memory: AiMemory | null): string {
  if (!memory || (!memory.summary && (!memory.facts || memory.facts.length === 0))) return "";
  const facts = memory.facts?.length ? `\nKalıcı notlar: ${memory.facts.join("; ")}` : "";
  return `\nHAFIZA (geçmiş konuşmalardan):\n${memory.summary ?? ""}${facts}`;
}
