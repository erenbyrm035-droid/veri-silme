import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PostureAnalysis } from "@/lib/database.types";

/** Kullanıcının tüm postür analizleri (yeni → eski). */
export async function getPostureAnalyses(
  userId: string
): Promise<PostureAnalysis[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posture_analyses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as PostureAnalysis[];
}

/** En son analiz. */
export async function getLatestPostureAnalysis(
  userId: string
): Promise<PostureAnalysis | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posture_analyses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as PostureAnalysis) ?? null;
}

export async function getPostureAnalysisById(
  id: string,
  userId: string
): Promise<PostureAnalysis | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posture_analyses")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as PostureAnalysis) ?? null;
}
