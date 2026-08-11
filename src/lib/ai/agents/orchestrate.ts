import "server-only";
import { randomUUID } from "node:crypto";
import type { AIProvider, ChatMessage } from "@/lib/ai/provider";
import { loadAgentConfigs } from "./registry";
import {
  routeByRules, mergeSelections, buildRouterPrompt, parseRouterOutput,
  filterEnabled, FALLBACK_AGENT, MAX_AGENTS,
} from "./router";
import { runSpecialists, recordRuns, type RunContext } from "./runner";
import { buildSynthesizerPrompt, findingsToPrompt, needsSynthesis, ALL_FAILED_FALLBACK } from "./synthesizer";
import { extractSignals, type MemoryInput } from "./memory";
import {
  screenUserMessage, screenAnswer, needsLlmReview, reviewAnswer,
  PATTERN_WARNING, type SafetyResult,
} from "./safety";
import type { AgentConfig, AgentFinding, AgentKey, AgentSelection, SelectionReason } from "./types";
import { codeDefaults } from "./registry";
import { buildAgentContext } from "./memory";

// ============================================================================
// ORCHESTRATOR — TÜM AKIŞ
//
// Tek bir kullanıcı mesajı için sıra:
//
//   1. GÜVENLİK ÖN TARAMA   → acil durumsa hiç model çalıştırmadan dur
//   2. YÖNLENDİRME          → kural motoru; belirsizse tek ucuz LLM çağrısı
//   3. UZMANLAR (PARALEL)   → seçilenler aynı anda çalışır
//   4. BİRLEŞTİRME          → >1 uzman varsa tek sese indirilir
//                             tek uzman varsa BU ADIM ATLANIR (maliyet)
//   5. TIBBİ DENETİM        → risk sinyali varsa cevap denetlenir
//   6. TELEMETRİ            → her adım ai_agent_runs'a yazılır
//
// MALİYET TABLOSU (tipik mesaj başına LLM çağrısı):
//   basit soru, tek uzman, risk yok        → 1
//   çok konulu soru, 2-3 uzman             → 3-4 (uzmanlar paralel)
//   belirsiz soru                          → +1 (yönlendirici)
//   sağlık bağlamı                         → +1 (denetim)
// Yani en yaygın durum tek çağrı — çoklu ajana geçmek varsayılan maliyeti
// artırmıyor. Artış yalnızca gerçekten karmaşık sorularda oluşuyor.
// ============================================================================

export interface OrchestrateInput {
  provider: AIProvider;
  userId: string;
  conversationId?: string;
  message: string;
  memory: MemoryInput;
  /** Admin panelinden yönetilen koç kişiliği (mevcut sistem promptu). */
  baseVoice: string;
}

export interface OrchestrateResult {
  /** Nihai cevabı üretecek mesaj dizisi — çağıran taraf bunu AKITIR. */
  messages: ChatMessage[];
  /** Cevabı akıtacak ajanın parametreleri. */
  streamConfig: { temperature: number; maxTokens: number };
  /** Model çağrılmadan kesin cevap belirlendiyse (acil durum / hepsi patladı). */
  finalText: string | null;
  /** Cevap akışı bittikten sonra uygulanacak güvenlik denetimi. */
  safety: {
    needed: boolean;
    config: AgentConfig | null;
    healthContext: string;
  };
  turnId: string;
  /**
   * Tek uzman optimizasyonuyla çalışan ajan (varsa).
   *
   * Bu turda `runSpecialists` atlandığı için telemetri BURADA yazılamaz —
   * token sayısı ancak cevap akıtıldıktan sonra bilinir. Route handler
   * akış bitince `recordRuns` ile bu ajanı kaydeder; aksi halde ajan başına
   * ölçümler en yaygın durumu (tek uzman) hiç görmüyordu.
   */
  singleAgentKey: AgentKey | null;
  selections: AgentSelection[];
  findings: AgentFinding[];
  configs: Map<AgentKey, AgentConfig>;
  routerUsedLlm: boolean;
  /** Kullanıcı arayüzünde gösterilecek ajan rozetleri. */
  agentBadges: { key: string; name: string; ok: boolean }[];
}

/**
 * Yönlendirme + uzman çalıştırma + birleştirme hazırlığı.
 *
 * Nihai cevabı BU FONKSİYON ÜRETMEZ — akıtılacak mesajları döndürür.
 * Böylece streaming çağıran tarafta (route handler) kalır ve kullanıcı
 * kelimelerin aktığını görmeye devam eder.
 */
export async function orchestrate(input: OrchestrateInput): Promise<OrchestrateResult> {
  const turnId = randomUUID();
  const signals = extractSignals(input.memory.snapshot);

  const empty: OrchestrateResult = {
    messages: [], streamConfig: { temperature: 0.6, maxTokens: 900 },
    finalText: null, safety: { needed: false, config: null, healthContext: "" },
    turnId, singleAgentKey: null, selections: [], findings: [], configs: new Map(),
    routerUsedLlm: false, agentBadges: [],
  };

  // --- 1. Güvenlik ön tarama: acil durumda model hiç çalışmaz ---
  const screen = screenUserMessage(input.message);
  if (screen.verdict === "block") {
    return { ...empty, finalText: screen.message };
  }

  const configs = await loadAgentConfigs({ userId: input.userId });

  // --- 2. Yönlendirme ---
  const ruled = routeByRules(input.message, signals);
  let selections = ruled.selected;
  let routerUsedLlm = false;
  const routerStart = Date.now();
  let routerTokens = { prompt: 0, completion: 0 };

  if (ruled.needsLlm) {
    const routerCfg = configs.get("orchestrator");
    try {
      const msgs: ChatMessage[] = [
        { role: "system", content: buildRouterPrompt() },
        { role: "user", content: input.message },
      ];
      const raw = await input.provider.complete(msgs, {
        temperature: routerCfg?.temperature ?? 0.1,
        maxTokens: routerCfg?.maxTokens ?? 60,
      });
      routerUsedLlm = true;
      routerTokens = {
        prompt: Math.ceil(msgs.reduce((a, m) => a + m.content.length, 0) / 4),
        completion: Math.ceil(raw.length / 4),
      };
      const keys = parseRouterOutput(raw);
      selections = keys.map((key) => ({ key, score: 0, reason: "llm" as SelectionReason }));
    } catch (err) {
      console.error("Yönlendirici hatası:", err);
    }
  }

  // Yönlendirme hiçbir şey üretemediyse ana ajana düş — kullanıcı cevapsız kalmasın.
  if (selections.length === 0 && ruled.forced.length === 0) {
    selections = [{ key: FALLBACK_AGENT, score: 0, reason: "forced" }];
  }

  // Bağlam sinyaliyle gelen uzmanlar LLM kararından SONRA eklenir.
  // Toparlanma skoru 25 olan bir kullanıcıya, sorusu ne olursa olsun,
  // toparlanma uzmanının değmesi gerekiyor; yönlendirici bunu bilemez
  // çünkü kullanıcı sormuyor.
  selections = mergeSelections(selections, ruled.forced, MAX_AGENTS);

  // Kapalı ajanları ele; hiçbiri kalmazsa genel koça düş. Boş dizi
  // "uzmansız cevap ver" demek — ayrıntı: router.ts / filterEnabled.
  selections = filterEnabled(selections, (k) => !!configs.get(k)?.enabled);

  // --- 3. Uzmanlar (paralel) ---
  const runCtx: RunContext = {
    userId: input.userId,
    conversationId: input.conversationId,
    turnId,
    provider: input.provider,
    memory: input.memory,
    message: input.message,
  };

  // TEK UZMAN OPTİMİZASYONU: birleştirici çalışmayacaksa uzmanın "bulgu"
  // değil doğrudan NİHAİ CEVAP yazması gerekir. Bu durumda uzmanı ayrıca
  // çalıştırıp sonra tekrar model çağırmak yerine, cevabı doğrudan o
  // uzmanın promptuyla akıtıyoruz — bir LLM çağrısı tasarruf.
  const singleAgent = selections.length === 1 ? configs.get(selections[0].key) : null;
  const singleAgentActive = !!singleAgent?.enabled;

  let findings: AgentFinding[] = [];
  if (!singleAgentActive) {
    findings = await runSpecialists(runCtx, configs, selections);
  }

  // --- Sağlık bağlamı (denetim için) ---
  const healthContext = buildAgentContext(["profile", "health"], input.memory, 2000);

  // --- 4. Nihai cevabı üretecek mesajlar ---
  let messages: ChatMessage[];
  let streamConfig: { temperature: number; maxTokens: number };

  if (singleAgentActive && singleAgent) {
    // Tek uzman → nihai cevabı kendisi yazar (koç sesiyle).
    const ctxBlock = buildAgentContext(singleAgent.memoryLayers, input.memory, singleAgent.memoryLimit);
    messages = [
      {
        role: "system",
        content:
          `${input.baseVoice}\n\n` +
          `UZMANLIK ODAĞIN BU TURDA: ${singleAgent.name} — ${singleAgent.description}\n` +
          `${stripAgentFraming(singleAgent.prompt)}\n\n` +
          `=== VERİ ===\n${ctxBlock}\n=== VERİ SONU ===`,
      },
      ...toChat(input.memory),
      { role: "user", content: input.message },
    ];
    streamConfig = { temperature: singleAgent.temperature, maxTokens: 900 };
  } else if (selections.length === 0) {
    // Hiçbir uzman açık değil. Uzmansız ama çalışan bir koç, hata mesajından
    // iyidir: temel kişilik + kullanıcı verisiyle normal cevap üretilir.
    const ctxBlock = buildAgentContext(["profile", "workout", "goals"], input.memory, 2000);
    messages = [
      { role: "system", content: `${input.baseVoice}\n\n=== VERİ ===\n${ctxBlock}\n=== VERİ SONU ===` },
      ...toChat(input.memory),
      { role: "user", content: input.message },
    ];
    streamConfig = { temperature: 0.6, maxTokens: 900 };
  } else {
    const usable = findings.filter((f) => f.ok && f.content.trim());
    if (usable.length === 0) {
      return {
        ...empty, configs, selections, findings, routerUsedLlm, turnId, singleAgentKey: null,
        finalText: ALL_FAILED_FALLBACK,
        agentBadges: findings.map((f) => ({ key: f.key, name: f.name, ok: f.ok })),
      };
    }

    const synth = configs.get("synthesizer");
    messages = [
      { role: "system", content: `${buildSynthesizerPrompt(input.baseVoice, findings)}\n\n${findingsToPrompt(findings)}` },
      ...toChat(input.memory),
      { role: "user", content: input.message },
    ];
    streamConfig = {
      temperature: synth?.temperature ?? 0.6,
      maxTokens: synth?.maxTokens ?? 900,
    };
  }

  // --- 5. Tıbbi denetim gerekli mi (cevap üretildikten sonra uygulanacak) ---
  const medicalCfg = configs.get("medical") ?? codeDefaults("medical");

  await recordRuns(
    { userId: input.userId, conversationId: input.conversationId, turnId },
    findings,
    routerUsedLlm
      ? [{
          agentKey: "orchestrator" as AgentKey,
          latencyMs: Date.now() - routerStart,
          promptTokens: routerTokens.prompt,
          completionTokens: routerTokens.completion,
          model: input.provider.name,
          ok: true,
          reason: "always" as SelectionReason,
        }]
      : []
  );

  return {
    messages,
    streamConfig,
    finalText: null,
    safety: {
      needed: !!medicalCfg?.enabled,
      config: medicalCfg,
      healthContext,
    },
    turnId,
    singleAgentKey: singleAgentActive && singleAgent ? singleAgent.key : null,
    selections,
    findings,
    configs,
    routerUsedLlm,
    agentBadges: (findings.length ? findings : selections.map((s) => ({
      key: s.key, name: configs.get(s.key)?.name ?? s.key, ok: true,
    }))).map((f) => ({ key: f.key, name: f.name, ok: f.ok })),
  };
}

/**
 * Cevap akışı bittikten sonra güvenlik denetimini uygular.
 *
 * `needsSynthesis` burada değil orchestrate'te kullanıldı; bu fonksiyon
 * yalnızca güvenlikten sorumlu.
 */
export async function applySafety(
  provider: AIProvider,
  result: OrchestrateResult,
  params: { message: string; answer: string; signals: ReturnType<typeof extractSignals> }
): Promise<SafetyResult> {
  const patternFlags = screenAnswer(params.answer);
  const cfg = result.safety.config;

  if (!result.safety.needed || !cfg) {
    // Denetim ajanı kapalı ama kalıp yakalandıysa yine de uyar.
    return patternFlags.length
      ? { verdict: "warn", message: PATTERN_WARNING, flags: patternFlags, usedLlm: false, latencyMs: 0, promptTokens: 0, completionTokens: 0 }
      : { verdict: "safe", message: null, flags: [], usedLlm: false, latencyMs: 0, promptTokens: 0, completionTokens: 0 };
  }

  if (!needsLlmReview(params.message, params.answer, params.signals, patternFlags)) {
    return { verdict: "safe", message: null, flags: [], usedLlm: false, latencyMs: 0, promptTokens: 0, completionTokens: 0 };
  }

  const review = await reviewAnswer(provider, cfg, {
    message: params.message,
    answer: params.answer,
    healthContext: result.safety.healthContext,
  });

  // LLM "güvenli" dese bile deterministik kalıp yakaladıysa uyarıyı koy.
  // Kalıplar modelin görüşünü ezer: bunlar kırmızı çizgi.
  if (review.verdict === "safe" && patternFlags.length) {
    return { ...review, verdict: "warn", message: PATTERN_WARNING, flags: patternFlags };
  }
  return { ...review, flags: [...review.flags, ...patternFlags] };
}

// --- Yardımcılar -----------------------------------------------------------

/** Oturum hafızasını sohbet mesajlarına çevirir (son 6). */
function toChat(memory: MemoryInput): ChatMessage[] {
  return memory.session.slice(-6).map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Uzman promptundaki "sen arka plan ajanısın, selamlama yazma" kısmını çıkarır.
 *
 * Tek uzman doğrudan kullanıcıya cevap veriyorsa o çerçeve YANLIŞ olur —
 * uzman bulgu değil, sohbet cevabı yazmalı. Ortak önsözü kesip yalnızca
 * uzmanlık kısmını bırakıyoruz.
 */
function stripAgentFraming(prompt: string): string {
  const marker = "UZMANLIK ALANIN:";
  const i = prompt.indexOf(marker);
  return i >= 0 ? prompt.slice(i) : prompt;
}

export { needsSynthesis };
