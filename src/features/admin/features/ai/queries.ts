import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { AiPromptVersion, AiLogRow } from "@/lib/database.types";

export async function listPromptVersions(key = "coach_system"): Promise<AiPromptVersion[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("ai_prompt_versions").select("*").eq("key", key).order("version", { ascending: false });
  return (data ?? []) as AiPromptVersion[];
}

export interface UsageStats {
  totalTokens: number;
  totalPrompt: number;
  totalCompletion: number;
  conversations: number;
  messages: number;
  byModel: { model: string; tokens: number; calls: number }[];
  daily: { date: string; tokens: number }[];
}

export async function getUsageStats(): Promise<UsageStats> {
  const supabase = createAdminClient();
  const [usage, convs, msgs] = await Promise.all([
    supabase.from("ai_usage").select("model, prompt_tokens, completion_tokens, total_tokens, created_at").order("created_at", { ascending: false }).limit(10000),
    supabase.from("ai_conversations").select("id", { count: "exact", head: true }),
    supabase.from("ai_messages").select("id", { count: "exact", head: true }),
  ]);
  const rows = (usage.data ?? []) as { model: string | null; prompt_tokens: number; completion_tokens: number; total_tokens: number; created_at: string }[];
  const byModel = new Map<string, { tokens: number; calls: number }>();
  const daily = new Map<string, number>();
  let totalTokens = 0, totalPrompt = 0, totalCompletion = 0;
  rows.forEach((r) => {
    totalTokens += r.total_tokens; totalPrompt += r.prompt_tokens; totalCompletion += r.completion_tokens;
    const m = r.model ?? "unknown";
    const cur = byModel.get(m) ?? { tokens: 0, calls: 0 };
    cur.tokens += r.total_tokens; cur.calls += 1; byModel.set(m, cur);
    const day = r.created_at.slice(0, 10);
    daily.set(day, (daily.get(day) ?? 0) + r.total_tokens);
  });
  return {
    totalTokens, totalPrompt, totalCompletion,
    conversations: convs.count ?? 0,
    messages: msgs.count ?? 0,
    byModel: [...byModel.entries()].map(([model, v]) => ({ model, ...v })).sort((a, b) => b.tokens - a.tokens),
    daily: [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([date, tokens]) => ({ date, tokens })),
  };
}

export async function listLogs(level?: string, limit = 100): Promise<AiLogRow[]> {
  const supabase = createAdminClient();
  let query = supabase.from("ai_logs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (level) query = query.eq("level", level);
  const { data } = await query;
  return (data ?? []) as AiLogRow[];
}
