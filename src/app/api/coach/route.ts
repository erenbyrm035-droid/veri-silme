import { createClient } from "@/lib/supabase/server";
import { getAIProvider, type ChatMessage } from "@/lib/ai/provider";
import { gatherUserContext, contextToPrompt } from "@/lib/ai/context";
import { getActiveSystemPrompt } from "@/lib/ai/prompt";
import { getMemory, memoryToPrompt, upsertMemory } from "@/lib/ai/memory";
import { buildInsightBlock } from "@/lib/ai/insights";
import { createMarkdownStripper } from "@/lib/ai/strip-markdown";
import { aiRateGuard } from "@/lib/security/ai-guard";
import { getAgentSnapshot, snapshotToPrompt, hasAiConsent } from "@/lib/ai/agent/context";
import { selfCheck, selfCheckPrompt } from "@/lib/ai/agent/selfcheck";
import { topNudges, nudgesToPrompt } from "@/lib/ai/agent/proactive";
import { orchestrate, applySafety, type OrchestrateResult } from "@/lib/ai/agents/orchestrate";
import { recordRuns } from "@/lib/ai/agents/runner";
import { extractSignals, type MemoryInput } from "@/lib/ai/agents/memory";

export const runtime = "nodejs";
export const maxDuration = 60; // AI üretimi uzun sürer; Vercel varsayılanı (10-15 sn) yetmiyor

/** Modele gönderilen son mesaj sayısı. */
const HISTORY_LIMIT = 16;
/** Tek mesaj için üst sınır — token bombasını engeller. */
const MAX_MESSAGE_CHARS = 4000;

const estTokens = (s: string) => Math.ceil(s.length / 4);

/**
 * AI Fitness Coach — agent destekli streaming uç noktası.
 *
 * İKİ FAZLI ÇALIŞIR (bkz. `lib/ai/agent/runtime.ts`):
 *   1. Planlama — model hangi veriye ihtiyacı olduğuna karar verir, araçları
 *      çağırır (antrenman geçmişi, beslenme, oyunlaştırma, takım, hedefler),
 *      gerekiyorsa veri yazar. Kalori/program gibi hassas değişiklikler
 *      ÇALIŞTIRILMAZ, kullanıcı onayına düşer.
 *   2. Cevap — araç sonuçları promptuna eklenir ve yanıt token token akar.
 *
 * ESKİ DAVRANIŞ KORUNUR: Sağlayıcı araç desteklemiyorsa ya da `agent_snapshot`
 * RPC'si yoksa faz 1 atlanır ve uç nokta tam olarak eskisi gibi çalışır.
 *
 * Yanıt: text/plain akışı; ilk satır `__meta:<json>` metadata.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response("Yetkisiz.", { status: 401 });

  const _rl = await aiRateGuard(request, supabase, user.id);
  if (_rl) return _rl;

  const body = await request.json().catch(() => null);
  const raw: unknown = body?.message;
  const message = typeof raw === "string" ? raw.trim() : "";
  let conversationId: string | undefined =
    typeof body?.conversationId === "string" ? body.conversationId : undefined;

  if (!message) return new Response("Mesaj boş olamaz.", { status: 400 });
  if (message.length > MAX_MESSAGE_CHARS) {
    return new Response(`Mesaj çok uzun (en fazla ${MAX_MESSAGE_CHARS} karakter).`, { status: 413 });
  }

  // --- Konuşma oluştur / getir ---
  if (!conversationId) {
    const { data: conv } = await supabase
      .from("ai_conversations")
      .insert({
        user_id: user.id,
        title: message.slice(0, 48),
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    conversationId = conv?.id;
  }

  // --- Bağlam + hafıza + prompt + geçmiş (paralel) ---
  // Geçmiş EN YENİ mesajlardan çekilir; `ascending: true` + limit kullanılırsa
  // uzun sohbetlerde modele hep ilk mesajlar gider ve koç son konuşulanları unutur.
  const [snapshot, memory, systemBase, insightBlock, { data: recent }] = await Promise.all([
    getAgentSnapshot(user.id),
    getMemory(user.id),
    getActiveSystemPrompt(),
    buildInsightBlock(user.id),
    supabase
      .from("ai_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId!)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);

  // Agent anlık görüntüsü varsa onu kullan; yoksa ESKİ bağlam toplayıcıya düş.
  // Böylece migration 0046 yüklenmemiş bir ortamda koç yine tam çalışır.
  const contextBlock = snapshot
    ? snapshotToPrompt(snapshot)
    : contextToPrompt(await gatherUserContext(user.id));

  const history = ((recent ?? []) as { role: string; content: string }[])
    .slice()
    .reverse() // eskiden yeniye — modelin beklediği sıra
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    user_id: user.id,
    role: "user",
    content: message,
  });

  // Proaktif bulgular deterministik olarak hesaplanır (bkz. `proactive.ts`) ve
  // prompta eklenir; böylece koç kullanıcı sormadan da doğru sayıyı bilir.
  const nudgeBlock = nudgesToPrompt(topNudges(snapshot, 4));

  const systemPrompt =
    `${systemBase}\n\n${contextBlock}${memoryToPrompt(memory)}${insightBlock}${nudgeBlock}\n${selfCheckPrompt()}`;

  const provider = getAIProvider();
  const model = provider?.name ?? "none";
  const encoder = new TextEncoder();

  // --- Sağlayıcı yoksa: güvenli fallback (yine akış olarak) ---
  if (!provider) {
    const fallback =
      "AI koç şu anda yapılandırılmamış (API anahtarı eksik). Genel öneri: hedefine ulaşmak için düzenli antrenman ve dengeli beslenme en önemlisi. Yönetici OPENAI_API_KEY (veya ANTHROPIC_API_KEY) ayarladığında sana özel yanıtlar alırsın. 💪";
    await persist(supabase, conversationId, user.id, fallback, model);
    return streamText(encoder, { cid: conversationId ?? "" }, fallback);
  }

  // ---------------------------------------------------------------------
  // ÇOKLU AJAN AKIŞI
  //
  // Yönlendirici hangi uzmanların çalışacağına karar verir, uzmanlar PARALEL
  // çalışır, sonuçlar tek sese indirilir. Ayrıntı: lib/ai/agents/orchestrate.ts
  //
  // AI onayı yoksa uzmanlar HİÇ çalışmaz: hepsi kullanıcının verisini okuyor,
  // onay vermediği veri modele gitmemeli. O durumda tek ve bağlamsız bir
  // cevap üretilir — eski davranışla aynı.
  // ---------------------------------------------------------------------
  const consent = hasAiConsent(snapshot);
  const memoryInput: MemoryInput = {
    snapshot,
    session: history,
    legacySummary: memory?.summary ?? null,
  };

  let plan: OrchestrateResult | null = null;
  if (consent) {
    try {
      plan = await orchestrate({
        provider,
        userId: user.id,
        conversationId,
        message,
        memory: memoryInput,
        baseVoice: systemPrompt,
      });
    } catch (err) {
      // Orchestrator çökerse tek ajanlı eski akışa düşülür — kullanıcı
      // cevapsız kalmaz. Mimari değişikliği ürünü kırılgan yapmamalı.
      console.error("Orchestrator hatası:", err);
      await log(supabase, user.id, conversationId, "error", "orchestrator_failed", { message: String(err) });
    }
  }

  // --- Acil güvenlik durumu: model hiç çalıştırılmadan kesin cevap ---
  if (plan?.finalText) {
    await persist(supabase, conversationId, user.id, plan.finalText, model);
    await log(supabase, user.id, conversationId, "warn", "safety_blocked_pre", {
      turnId: plan.turnId,
    });
    return streamText(
      encoder,
      { cid: conversationId ?? "", tools: [], proposals: 0, agents: [], blocked: true },
      plan.finalText
    );
  }

  // --- Plan yoksa (onay yok / orchestrator çöktü) eski tek ajan akışı ---
  const messages: ChatMessage[] =
    plan?.messages.length
      ? plan.messages
      : [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: message }];

  const streamOpts = plan?.streamConfig ?? { temperature: 0.7, maxTokens: 900 };
  const toolsUsed = (plan?.findings ?? []).flatMap((f) => f.toolsUsed);
  const pendingProposals = (plan?.findings ?? []).reduce((a, f) => a + f.proposals, 0);

  const promptTokens = messages.reduce((a, m) => a + estTokens(m.content), 0);
  const streamStarted = Date.now();
  const meta = {
    cid: conversationId ?? "",
    tools: toolsUsed,
    proposals: pendingProposals,
    // Arka planda hangi uzmanların çalıştığı — kullanıcı "tek koç" görüyor
    // ama şeffaflık için rozet gösteriyoruz.
    agents: plan?.agentBadges ?? [],
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`__meta:${JSON.stringify(meta)}\n`));
      let full = "";
      const strip = createMarkdownStripper();
      try {
        for await (const token of provider.streamChat(messages, streamOpts)) {
          const clean = strip(token);
          full += clean;
          controller.enqueue(encoder.encode(clean));
        }
      } catch (err) {
        console.error("AI stream hatası:", err);
        await log(supabase, user.id, conversationId, "error", "stream_error", { message: String(err) });
        const msg = "\n\n(AI koça şu an ulaşılamadı, birazdan tekrar dene. 💧)";
        full += msg;
        controller.enqueue(encoder.encode(msg));
      }

      // --- TIBBİ GÜVENLİK DENETİMİ ---
      // Cevap üretildikten sonra denetlenir. `block` gelirse cevabın YERİNE
      // güvenli metin geçer; akış zaten bittiği için kullanıcıya ek satır
      // olarak gönderiliyor ve kayda güvenli metin yazılıyor.
      if (plan) {
        try {
          const verdict = await applySafety(provider, plan, {
            message,
            answer: full,
            signals: extractSignals(snapshot),
          });
          if (verdict.verdict === "block" && verdict.message) {
            const replacement = `\n\n⚠️ ${verdict.message}`;
            controller.enqueue(encoder.encode(replacement));
            full = verdict.message;   // kayda güvenli metin gider
            await log(supabase, user.id, conversationId, "warn", "safety_blocked_post", { flags: verdict.flags });
          } else if (verdict.verdict === "warn" && verdict.message) {
            const note = `\n\n${verdict.message}`;
            full += note;
            controller.enqueue(encoder.encode(note));
            await log(supabase, user.id, conversationId, "info", "safety_warned", { flags: verdict.flags });
          }
        } catch (err) {
          console.error("Güvenlik denetimi hatası:", err);
        }
      }

      // --- SELF CHECK: veri olmadan rakam verildiyse dürüst not ekle ---
      const check = selfCheck(full, snapshot);
      if (check.note) {
        full += check.note;
        controller.enqueue(encoder.encode(check.note));
        await log(supabase, user.id, conversationId, "warn", "selfcheck_flagged", { flags: check.flags });
      }

      await persist(supabase, conversationId, user.id, full, model);

      const completionTokens = estTokens(full);
      try {
        await supabase.from("ai_usage").insert({
          user_id: user.id,
          conversation_id: conversationId,
          model,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        });
      } catch { /* muhasebe kritik değil */ }

      // TEK UZMAN TELEMETRİSİ. Tek uzman çalıştığında maliyet için
      // `runSpecialists` atlanır, dolayısıyla orchestrate `ai_agent_runs`'a
      // hiçbir şey yazamaz — token sayısı ancak akış bitince bilinir.
      // Bu kayıt olmadan admin panelindeki ajan başına ölçümler trafiğin
      // en yaygın durumunu hiç görmüyordu.
      if (plan?.singleAgentKey) {
        try {
          await recordRuns(
            { userId: user.id, conversationId, turnId: plan.turnId },
            [],
            [{
              agentKey: plan.singleAgentKey,
              latencyMs: Date.now() - streamStarted,
              promptTokens,
              completionTokens,
              model,
              ok: true,
              reason: plan.selections[0]?.reason ?? "keyword",
            }]
          );
        } catch { /* telemetri kaybı cevabı engellemez */ }
      }

      await log(supabase, user.id, conversationId, "info", "chat_completed", {
        model, promptTokens, completionTokens,
        turnId: plan?.turnId ?? null,
        agents: (plan?.selections ?? []).map((s) => s.key),
        routerUsedLlm: plan?.routerUsedLlm ?? false,
        tools: toolsUsed.map((t) => t.name),
        proposals: pendingProposals,
      });
      await refreshMemory(user.id, memory?.summary ?? "", message);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

// --- Son sohbeti getir (sayfa yenilenince geçmiş korunur) ---
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ conversationId: null, messages: [] }, { status: 401 });

  const { data: conv } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conv?.id) return Response.json({ conversationId: null, messages: [] });

  const { data: msgs } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: true })
    .limit(100);

  const messages = (msgs ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && m.content
  );
  return Response.json({ conversationId: conv.id, messages });
}

// Yardımcı: statik metni akış olarak döndürür.
function streamText(
  encoder: TextEncoder,
  meta: Record<string, unknown>,
  text: string
) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`__meta:${JSON.stringify(meta)}\n`));
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

// Yardımcı: asistan cevabını kaydeder + konuşma zaman damgasını günceller.
async function persist(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string | undefined,
  userId: string,
  content: string,
  model: string
) {
  if (!conversationId || !content) return;
  await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    role: "assistant",
    content,
    model,
  });
  await supabase
    .from("ai_conversations")
    .update({
      updated_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      model,
    })
    .eq("id", conversationId);
}

async function log(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  conversationId: string | undefined,
  level: string,
  event: string,
  detail: Record<string, unknown>
) {
  try {
    await supabase.from("ai_logs").insert({
      user_id: userId,
      conversation_id: conversationId ?? null,
      level,
      event,
      detail,
    });
  } catch { /* yut */ }
}

/** Hafıza özetinin sonuna son kullanıcı mesajını ekler (son 800 karakter). */
async function refreshMemory(userId: string, prev: string, lastUserMessage: string) {
  try {
    const next = `${prev}\n• ${lastUserMessage}`.slice(-800).trim();
    await upsertMemory(userId, next);
  } catch { /* yut */ }
}
