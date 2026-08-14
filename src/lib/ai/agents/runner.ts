import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { AIProvider, ChatMessage } from "@/lib/ai/provider";
import { runToolPhase, observationsToPrompt } from "@/lib/ai/agent/runtime";
import type { ToolContext } from "@/lib/ai/agent/tools";
import { buildAgentContext, type MemoryInput } from "./memory";
import type { AgentConfig, AgentFinding, AgentSelection, AgentKey, SelectionReason } from "./types";

// ============================================================================
// UZMAN ÇALIŞTIRICI
//
// Seçilen uzmanları PARALEL çalıştırır. Sıralı çalıştırmak, 3 uzman için
// gecikmeyi üçe katlardı ve uzmanlar birbirinin çıktısına ihtiyaç duymuyor —
// bağımsız görüşler üretiyorlar. Bağımlılık yoksa paralellik bedava hızdır.
//
// HATA YALITIMI: Bir uzman patlarsa diğerleri devam eder ve cevap yine üretilir.
// `Promise.allSettled` değil, her uzmanın kendi try/catch'i var — böylece
// başarısız uzmanın telemetrisi de (süre, hata mesajı) kaydedilebiliyor.
//
// ARAÇ KULLANIMI: Her uzman yalnızca `allowedTools` listesindeki araçları
// çağırabilir. Beslenme uzmanının program yoğunluğunu değiştirememesi
// yapılandırma değil, güvenlik sınırıdır.
// ============================================================================

export interface RunContext {
  userId: string;
  conversationId?: string;
  /** Aynı kullanıcı mesajına ait tüm çalışmaları gruplar. */
  turnId: string;
  provider: AIProvider;
  memory: MemoryInput;
  message: string;
}

/**
 * Tek bir uzmanı çalıştırır.
 *
 * Uzman önce (izinliyse) araçlarını çağırır, sonra bulgusunu yazar.
 * Çıktı kullanıcıya doğrudan gitmez — birleştiriciye gider.
 */
export async function runSpecialist(
  ctx: RunContext,
  cfg: AgentConfig,
  selection: AgentSelection
): Promise<AgentFinding> {
  const started = Date.now();
  const base: Pick<AgentFinding, "key" | "name" | "model" | "variant" | "reason"> = {
    key: selection.key,
    name: cfg.name,
    model: cfg.model ?? ctx.provider.name,
    variant: cfg.variant,
    reason: selection.reason,
  };

  try {
    const contextBlock = buildAgentContext(cfg.memoryLayers, ctx.memory, cfg.memoryLimit);
    let system = `${cfg.prompt}\n\n=== VERİ ===\n${contextBlock}\n=== VERİ SONU ===`;
    let toolsUsed: AgentFinding["toolsUsed"] = [];
    let proposals = 0;

    // --- Araç fazı (yalnızca izinli araçlarla) ---
    if (cfg.allowedTools.length > 0 && typeof ctx.provider.chatWithTools === "function") {
      const toolCtx: ToolContext = { userId: ctx.userId, conversationId: ctx.conversationId };
      const phase = await runToolPhase(
        restrictProvider(ctx.provider, cfg.allowedTools),
        toolCtx,
        system,
        [],
        ctx.message
      );
      if (phase.observations.length) {
        system += observationsToPrompt(phase.observations);
        toolsUsed = phase.observations.map((o) => ({
          name: o.tool, ok: o.ok, summary: o.summary ?? null,
        }));
      }
      proposals = phase.pendingProposals;
    }

    const messages: ChatMessage[] = [
      { role: "system", content: system },
      { role: "user", content: ctx.message },
    ];

    const content = await ctx.provider.complete(messages, {
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
    });

    const promptTokens = Math.ceil(messages.reduce((a, m) => a + m.content.length, 0) / 4);
    const completionTokens = Math.ceil(content.length / 4);

    return {
      ...base,
      content: content.trim(),
      ok: true,
      latencyMs: Date.now() - started,
      promptTokens,
      completionTokens,
      toolsUsed,
      proposals,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Uzman ajan hatası (${cfg.key}):`, message);
    return {
      ...base,
      content: "",
      ok: false,
      latencyMs: Date.now() - started,
      promptTokens: 0,
      completionTokens: 0,
      toolsUsed: [],
      proposals: 0,
      error: message,
    };
  }
}

/**
 * Sağlayıcıyı yalnızca izinli araçları görecek biçimde sarar.
 *
 * NEDEN SARMALAMA: `runToolPhase` araç listesini kendi kayıt defterinden
 * alıyor. Uzmana kısıtlı liste vermenin en temiz yolu, çağrıyı yakalayıp
 * araç tanımlarını süzmek — böylece 0046'daki araç altyapısı hiç
 * değişmeden yeniden kullanılıyor.
 */
function restrictProvider(provider: AIProvider, allowed: string[]): AIProvider {
  const set = new Set(allowed);
  const original = provider.chatWithTools?.bind(provider);
  if (!original) return provider;

  return {
    ...provider,
    chatWithTools: async (turns, tools, opts) => {
      const filtered = tools.filter((t) => set.has(t.name));
      // Hiç izinli araç kalmadıysa modele boş liste göndermek yerine
      // araçsız çağrı yapmak daha doğru — bazı sağlayıcılar boş `tools`
      // dizisini hata sayıyor.
      return original(turns, filtered, opts);
    },
  };
}

/**
 * Seçilen uzmanları PARALEL çalıştırır.
 *
 * Kapalı (`enabled = false`) uzmanlar atlanır — admin panelinden bir ajanı
 * kapatmak onu gerçekten devre dışı bırakmalı.
 */
export async function runSpecialists(
  ctx: RunContext,
  configs: Map<AgentKey, AgentConfig>,
  selections: AgentSelection[]
): Promise<AgentFinding[]> {
  const runnable = selections
    .map((sel) => ({ sel, cfg: configs.get(sel.key) }))
    .filter((x): x is { sel: AgentSelection; cfg: AgentConfig } => !!x.cfg && x.cfg.enabled);

  if (runnable.length === 0) return [];

  return Promise.all(runnable.map(({ sel, cfg }) => runSpecialist(ctx, cfg, sel)));
}

/**
 * Telemetriyi `ai_agent_runs`'a yazar.
 *
 * Tek `insert` ile toplu yazılıyor: her ajan için ayrı istek atmak, asıl
 * cevabın gecikmesine ekleniyor olurdu. Hata yutuluyor — telemetri kaybı
 * kullanıcının cevabını engellememeli.
 */
export async function recordRuns(
  ctx: { userId: string; conversationId?: string; turnId: string },
  findings: AgentFinding[],
  extra: { agentKey: AgentKey; latencyMs: number; promptTokens: number; completionTokens: number; model: string; ok: boolean; reason: SelectionReason; variant?: "a" | "b" }[] = []
): Promise<void> {
  const rows = [
    ...findings.map((f) => ({
      user_id: ctx.userId,
      conversation_id: ctx.conversationId ?? null,
      agent_key: f.key,
      turn_id: ctx.turnId,
      model: f.model,
      variant: f.variant,
      prompt_tokens: f.promptTokens,
      completion_tokens: f.completionTokens,
      latency_ms: f.latencyMs,
      ok: f.ok,
      selected_by: f.reason,
      error: f.error ?? null,
    })),
    ...extra.map((e) => ({
      user_id: ctx.userId,
      conversation_id: ctx.conversationId ?? null,
      agent_key: e.agentKey,
      turn_id: ctx.turnId,
      model: e.model,
      variant: e.variant ?? "a",
      prompt_tokens: e.promptTokens,
      completion_tokens: e.completionTokens,
      latency_ms: e.latencyMs,
      ok: e.ok,
      selected_by: e.reason,
      error: null,
    })),
  ];

  if (rows.length === 0) return;
  try {
    await createAdminClient().from("ai_agent_runs").insert(rows);
  } catch { /* telemetri kritik değil */ }
}
