import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AIProvider, AgentTurnInput, ChatMessage, ToolResult } from "@/lib/ai/provider";
import { getTool, parseArgs, toolDefinitions, type ToolContext } from "./tools";
import type { ToolRisk } from "./types";

// ============================================================================
// AGENT DÖNGÜSÜ
//
// AKIŞ — iki fazlı, bilinçli bir tercih:
//
//   FAZ 1 (planlama)  → `chatWithTools`. Model hangi veriye ihtiyacı olduğuna
//                       karar verir, araçları çağırır, sonuçları görür, gerekirse
//                       tekrar çağırır. Bu fazda NİHAİ CEVAP YAZMAZ.
//   FAZ 2 (cevap)     → `streamChat`. Araç gözlemleri sistem promptuna eklenir
//                       ve cevap token token akar.
//
// NEDEN İKİ FAZ: Araç çağırma akışlı (streaming) çalışmaz — model önce aracı
// çağırmalı, sonucu görmeli, sonra konuşmalı. Tek fazda yapsaydık ya akışı ya
// da araçları kaybederdik. İki faz ikisini de korur: kullanıcı yine kelimelerin
// akışını görür, ama arkasında gerçek veri vardır.
//
// GERİYE DÖNÜK UYUMLULUK: Sağlayıcı `chatWithTools` uygulamıyorsa faz 1
// TAMAMEN ATLANIR ve sistem eskisi gibi düz akışla çalışır. Yani bu katman
// mevcut koçu bozmuyor, üstüne biniyor.
//
// GÜVENLİK: `sensitive` araçlar bu döngüde ÇALIŞTIRILMAZ. `ai_actions`'a
// 'proposed' olarak yazılır; kullanıcı onaylayana kadar hiçbir veri değişmez.
// ============================================================================

/** Model kaç tur araç çağırabilir. Sonsuz döngü ve maliyet patlaması koruması. */
const MAX_ROUNDS = 4;
/** Tek turda kaç araç çağrısı işlenir. */
const MAX_CALLS_PER_ROUND = 5;
/** Planlama fazında modele verilen token bütçesi — cevap yazmayacağı için düşük. */
const PLAN_MAX_TOKENS = 600;

export interface AgentObservation {
  tool: string;
  risk: ToolRisk;
  ok: boolean;
  content: string;
  /** Onay bekleyen işlem oluşturulduysa `ai_actions.id`. */
  proposalId?: string;
  summary?: string;
}

export interface ToolPhaseResult {
  observations: AgentObservation[];
  /** Kullanıcı onayı bekleyen işlem sayısı. */
  pendingProposals: number;
  rounds: number;
}

const PLAN_INSTRUCTION = `
ŞU AN PLANLAMA AŞAMASINDASIN — kullanıcı bu turda yazdıklarını GÖRMEYECEK.
Görevin: kullanıcıya doğru cevap verebilmek için hangi verilere ihtiyacın olduğuna karar vermek.
- Elindeki KULLANICI DURUMU bloğu yetiyorsa hiç araç çağırma, boş dön.
- Eksik veri varsa ilgili aracı çağır (birden fazla olabilir).
- Kullanıcı bir şeyi hatırlamanı istiyorsa, sakatlık/tercih bildiriyorsa remember_fact çağır.
- Kullanıcı hedef koyuyorsa set_goal çağır.
- Kalori/makro ya da program yoğunluğu değişikliği gerekiyorsa ilgili aracı çağır;
  bunlar kullanıcı onayına düşecek, sen sadece öner.
- Bu aşamada nihai cevabı YAZMA. Sadece araç çağır ya da sessiz kal.`;

/**
 * Araç fazını çalıştırır.
 *
 * Sağlayıcı araç desteklemiyorsa boş sonuç döner — çağıran taraf normal
 * akışına devam eder.
 */
export async function runToolPhase(
  provider: AIProvider,
  ctx: ToolContext,
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string
): Promise<ToolPhaseResult> {
  if (typeof provider.chatWithTools !== "function") {
    return { observations: [], pendingProposals: 0, rounds: 0 };
  }

  const turns: AgentTurnInput[] = [
    { kind: "message", message: { role: "system", content: `${systemPrompt}\n${PLAN_INSTRUCTION}` } },
    ...history.map((m) => ({ kind: "message" as const, message: m })),
    { kind: "message", message: { role: "user", content: userMessage } },
  ];

  const definitions = toolDefinitions();
  const observations: AgentObservation[] = [];
  let pendingProposals = 0;
  let rounds = 0;

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    rounds = round + 1;

    let turn;
    try {
      turn = await provider.chatWithTools(turns, definitions, {
        temperature: 0.2,
        maxTokens: PLAN_MAX_TOKENS,
      });
    } catch (err) {
      // Planlama başarısız olsa bile cevap verilebilmeli — araçsız devam.
      console.error("Agent planlama hatası:", err);
      break;
    }

    if (!turn.toolCalls.length) break;

    turns.push({
      kind: "assistant_tool_use",
      raw: turn.raw,
      text: turn.text,
      toolCalls: turn.toolCalls,
    });

    const results: ToolResult[] = [];
    for (const call of turn.toolCalls.slice(0, MAX_CALLS_PER_ROUND)) {
      const outcome = await executeCall(ctx, call.name, call.arguments);
      observations.push(outcome);
      if (outcome.proposalId) pendingProposals += 1;
      results.push({ id: call.id, name: call.name, content: outcome.content });
    }

    turns.push({ kind: "tool_results", results });
  }

  return { observations, pendingProposals, rounds };
}

/**
 * Tek bir araç çağrısını doğrular, çalıştırır ve `ai_actions`'a yazar.
 *
 * Üç sonuç mümkün:
 *   - Araç yok / argüman geçersiz → modele hata döner, model kendini düzeltir.
 *   - `sensitive` → ÇALIŞTIRILMAZ, 'proposed' kaydı açılır.
 *   - Diğer → çalışır, 'executed' ya da 'failed' olarak kaydedilir.
 */
async function executeCall(
  ctx: ToolContext,
  name: string,
  rawArgs: Record<string, unknown>
): Promise<AgentObservation> {
  const tool = getTool(name);
  if (!tool) {
    return { tool: name, risk: "read", ok: false, content: `"${name}" adında bir araç yok. Var olan araçlardan birini kullan.` };
  }

  const parsed = parseArgs(tool, rawArgs);
  if (!parsed.ok) {
    return {
      tool: name,
      risk: tool.risk,
      ok: false,
      content: `Argümanlar geçersiz — ${parsed.error}. Düzeltip tekrar dene ya da kullanıcıdan eksik bilgiyi iste.`,
    };
  }
  const args = parsed.args as Record<string, unknown>;

  // --- Hassas işlem: çalıştırma, öner ---
  if (tool.risk === "sensitive") {
    const summary = tool.proposal ? tool.proposal(args) : `${name} çalıştırılacak.`;
    const id = await recordAction(ctx, name, args, "proposed", { summary });
    return {
      tool: name,
      risk: tool.risk,
      ok: true,
      proposalId: id ?? undefined,
      summary,
      content:
        `Bu işlem kullanıcı ONAYINA sunuldu, HENÜZ UYGULANMADI: ${summary}\n` +
        `Kullanıcıya ne önerdiğini ve NEDEN önerdiğini anlat, onay kartından tek dokunuşla ` +
        `kabul edebileceğini söyle. "Değiştirdim" DEME — henüz değişmedi.`,
    };
  }

  // --- Okuma / düşük riskli yazma: çalıştır ---
  try {
    const out = await tool.run(ctx, args);
    if (tool.risk !== "read") {
      await recordAction(ctx, name, args, out.ok ? "executed" : "failed", {
        summary: out.summary,
        result: out.result,
        error: out.ok ? undefined : out.content,
      });
    }
    return { tool: name, risk: tool.risk, ok: out.ok, content: out.content, summary: out.summary };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (tool.risk !== "read") {
      await recordAction(ctx, name, args, "failed", { error: msg });
    }
    return { tool: name, risk: tool.risk, ok: false, content: `Araç çalışırken hata oluştu: ${msg}` };
  }
}

/** `ai_actions` denetim kaydı. Başarısız olursa akışı DURDURMAZ. */
export async function recordAction(
  ctx: ToolContext,
  tool: string,
  args: Record<string, unknown>,
  status: "executed" | "proposed" | "failed",
  extra: { summary?: string; result?: Record<string, unknown>; error?: string } = {}
): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("ai_actions")
      .insert({
        user_id: ctx.userId,
        conversation_id: ctx.conversationId ?? null,
        tool,
        args,
        result: extra.result ?? {},
        status,
        summary: extra.summary ?? null,
        error: extra.error ?? null,
      })
      .select("id")
      .single();
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Araç gözlemlerini cevap fazının sistem promptuna eklenecek bloğa çevirir.
 *
 * Gözlem yoksa boş string döner — böylece araçsız akış promptu değişmez.
 */
export function observationsToPrompt(observations: AgentObservation[]): string {
  if (observations.length === 0) return "";

  const lines = observations.map((o) => {
    const head = o.ok ? `ARAÇ ${o.tool}` : `ARAÇ ${o.tool} (BAŞARISIZ)`;
    return `--- ${head} ---\n${o.content}`;
  });

  const pending = observations.filter((o) => o.proposalId);
  const pendingNote = pending.length
    ? `\n\nONAY BEKLEYEN ${pending.length} İŞLEM VAR. Bunları "yaptım" diye anlatma; ` +
      `"öneriyorum, onaylarsan uygularım" diye anlat.`
    : "";

  return (
    "\n\n=== ARAÇ SONUÇLARI (bu turda gerçek veritabanından okundu — cevabını BUNLARA dayandır) ===\n" +
    lines.join("\n") +
    pendingNote +
    "\n=== ARAÇ SONUÇLARI SONU ==="
  );
}

export { MAX_ROUNDS };
