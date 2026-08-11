import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { SPECIALISTS, medicalAgent } from "@/lib/ai/agents/specialists";
import { estimateCost } from "@/lib/ai/pricing";
import type { AgentKey, MemoryLayer } from "@/lib/ai/agents/types";

// ============================================================================
// AI Yönetim Merkezi — okuma katmanı.
//
// Ajan yapılandırması iki kaynaktan geliyor (kod varsayılanı + DB kaydı).
// Admin panelinde HER İKİSİNİ de göstermek gerekiyor: DB'de kaydı olmayan bir
// ajan "yok" değil, "varsayılanla çalışıyor" demek. Bunu ayırt etmeden
// gösterirsek yönetici ajanın çalışmadığını sanır.
// ============================================================================

export interface AgentRowView {
  key: AgentKey;
  name: string;
  description: string | null;
  enabled: boolean;
  model: string | null;
  temperature: number;
  max_tokens: number;
  memory_layers: MemoryLayer[];
  allowed_tools: string[];
  memory_limit: number;
  sort_order: number;
  /** DB'de kaydı var mı — yoksa kod varsayılanıyla çalışıyor demektir. */
  persisted: boolean;
  /** Aktif prompt sürümü (varsa). */
  activePromptVersion: number | null;
  activeVariants: string[];
}

export interface AgentMetricRow {
  agent_key: string;
  runs: number;
  ok_runs: number;
  success_pct: number | null;
  avg_latency_ms: number;
  p95_latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  model: string | null;
  /** Tahmini maliyet (USD) — lib/ai/pricing.ts. */
  cost: number;
}

export interface DailyTokenRow {
  day: string;
  agent_key: string;
  total_tokens: number;
  runs: number;
}

export interface PromptVersionRow {
  id: string;
  agent_key: string;
  version: number;
  variant: string;
  content: string;
  is_active: boolean;
  note: string | null;
  created_at: string;
}

export interface AbTestRow {
  id: string;
  agent_key: string;
  name: string;
  split_pct: number;
  active: boolean;
  started_at: string;
  ended_at: string | null;
  note: string | null;
  results: { variant: string; runs: number; ok_runs: number; success_pct: number | null; avg_latency_ms: number; avg_tokens: number }[];
}

export interface AiCenterData {
  agents: AgentRowView[];
  metrics: AgentMetricRow[];
  daily: DailyTokenRow[];
  prompts: PromptVersionRow[];
  abTests: AbTestRow[];
  /** Araç kayıt defterindeki tüm araç adları — izin seçicisi için. */
  availableTools: string[];
  totals: { runs: number; tokens: number; cost: number; avgLatency: number; successPct: number };
  days: number;
}

/** Kod varsayılanı — DB'de kaydı olmayan ajan için. */
function defaultRow(key: AgentKey): AgentRowView | null {
  const spec = key === "medical" ? medicalAgent : SPECIALISTS.find((s) => s.key === key);
  if (!spec) return null;
  return {
    key,
    name: spec.name,
    description: spec.description,
    enabled: true,
    model: null,
    temperature: spec.defaults.temperature,
    max_tokens: spec.defaults.maxTokens,
    memory_layers: spec.defaults.memoryLayers,
    allowed_tools: spec.defaults.allowedTools,
    memory_limit: spec.defaults.memoryLimit,
    sort_order: spec.defaults.sortOrder,
    persisted: false,
    activePromptVersion: null,
    activeVariants: [],
  };
}

export async function getAiCenterData(days = 7): Promise<AiCenterData> {
  const supabase = createAdminClient();

  const [agentsRes, metricsRes, dailyRes, promptsRes, abRes] = await Promise.all([
    supabase.from("ai_agents").select("*").order("sort_order"),
    supabase.rpc("agent_metrics", { p_days: days }),
    supabase.rpc("agent_daily_tokens", { p_days: Math.max(days, 14) }),
    supabase
      .from("ai_agent_prompts")
      .select("id, agent_key, version, variant, content, is_active, note, created_at")
      .order("version", { ascending: false })
      .limit(200),
    supabase.from("ai_ab_tests").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  type DbRow = {
    key: string; name: string; description: string | null; enabled: boolean;
    model: string | null; temperature: number | string; max_tokens: number;
    memory_layers: string[] | null; allowed_tools: string[] | null;
    memory_limit: number; sort_order: number;
  };

  const prompts = (promptsRes.data ?? []) as PromptVersionRow[];
  const activeByAgent = new Map<string, PromptVersionRow[]>();
  for (const p of prompts.filter((x) => x.is_active)) {
    const list = activeByAgent.get(p.agent_key) ?? [];
    list.push(p);
    activeByAgent.set(p.agent_key, list);
  }

  // Kod varsayılanlarıyla başla; DB kaydı olanları üzerine bindir.
  const map = new Map<string, AgentRowView>();
  for (const spec of [...SPECIALISTS]) {
    const row = defaultRow(spec.key);
    if (row) map.set(spec.key, row);
  }

  for (const r of ((agentsRes.data ?? []) as DbRow[])) {
    const base = map.get(r.key) ?? defaultRow(r.key as AgentKey);
    const active = activeByAgent.get(r.key) ?? [];
    map.set(r.key, {
      key: r.key as AgentKey,
      name: r.name,
      description: r.description ?? base?.description ?? null,
      enabled: r.enabled,
      model: r.model,
      temperature: Number(r.temperature),
      max_tokens: r.max_tokens,
      memory_layers: (r.memory_layers ?? []) as MemoryLayer[],
      allowed_tools: r.allowed_tools ?? [],
      memory_limit: r.memory_limit,
      sort_order: r.sort_order,
      persisted: true,
      activePromptVersion: active.length ? Math.max(...active.map((a) => a.version)) : null,
      activeVariants: active.map((a) => a.variant),
    });
  }

  const agents = [...map.values()].sort((a, b) => a.sort_order - b.sort_order);

  // --- Metrikler + maliyet ---
  type MetricDb = Omit<AgentMetricRow, "cost">;
  const metrics: AgentMetricRow[] = ((metricsRes.data ?? []) as MetricDb[]).map((m) => ({
    ...m,
    runs: Number(m.runs),
    ok_runs: Number(m.ok_runs),
    prompt_tokens: Number(m.prompt_tokens),
    completion_tokens: Number(m.completion_tokens),
    total_tokens: Number(m.total_tokens),
    cost: estimateCost(m.model, Number(m.prompt_tokens), Number(m.completion_tokens)),
  }));

  const totals = metrics.reduce(
    (a, m) => ({
      runs: a.runs + m.runs,
      okRuns: a.okRuns + m.ok_runs,
      tokens: a.tokens + m.total_tokens,
      cost: a.cost + m.cost,
      latencySum: a.latencySum + m.avg_latency_ms * m.runs,
    }),
    { runs: 0, okRuns: 0, tokens: 0, cost: 0, latencySum: 0 }
  );

  // --- A/B testleri + sonuçları ---
  type AbDb = Omit<AbTestRow, "results">;
  const abRows = (abRes.data ?? []) as AbDb[];
  const abTests: AbTestRow[] = await Promise.all(
    abRows.map(async (t) => {
      if (!t.active) return { ...t, results: [] };
      const { data } = await supabase.rpc("ab_test_results", { p_agent: t.agent_key });
      return { ...t, results: (data ?? []) as AbTestRow["results"] };
    })
  );

  // Araç listesi: her uzmanın izin listelerinin birleşimi + kayıt defteri.
  const availableTools = [
    ...new Set([
      ...SPECIALISTS.flatMap((s) => s.defaults.allowedTools),
      ...agents.flatMap((a) => a.allowed_tools),
    ]),
  ].sort();

  return {
    agents,
    metrics,
    daily: ((dailyRes.data ?? []) as DailyTokenRow[]).map((d) => ({
      ...d,
      total_tokens: Number(d.total_tokens),
      runs: Number(d.runs),
    })),
    prompts,
    abTests,
    availableTools,
    totals: {
      runs: totals.runs,
      tokens: totals.tokens,
      cost: totals.cost,
      avgLatency: totals.runs ? Math.round(totals.latencySum / totals.runs) : 0,
      successPct: totals.runs ? Math.round((totals.okRuns / totals.runs) * 1000) / 10 : 100,
    },
    days,
  };
}

/** Son çalışma kayıtları — hata ayıklama görünümü. */
export async function getRecentRuns(limit = 60) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("ai_agent_runs")
    .select("id, agent_key, turn_id, model, variant, prompt_tokens, completion_tokens, latency_ms, ok, selected_by, error, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
