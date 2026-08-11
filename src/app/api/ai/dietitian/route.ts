// AI Diyetisyen — RAG destekli streaming sohbet.
// Kullanıcının TAM profili + günlük makro + su + antrenman + skor + AI hafızası
// + (RAG) doğrulanmış besin veritabanı ile gerçek bir spor diyetisyeni gibi yanıt.
import { createClient } from "@/lib/supabase/server";
import { getAIProvider, type ChatMessage } from "@/lib/ai/provider";
import { buildDietitianSystemPrompt } from "@/lib/nutrition/dietitian-context";
import { createMarkdownStripper } from "@/lib/ai/strip-markdown";
import { aiRateGuard } from "@/lib/security/ai-guard";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Yetkisiz.", { status: 401 });

  const rl = await aiRateGuard(request, supabase, user.id);
  if (rl) return rl;

  const body = await request.json().catch(() => null);
  const message: string = (body?.message ?? "").trim();
  const history: ChatMessage[] = Array.isArray(body?.history)
    ? body.history.filter((m: ChatMessage) => m && (m.role === "user" || m.role === "assistant") && m.content).slice(-8)
    : [];
  if (!message) return new Response("Mesaj boş olamaz.", { status: 400 });

  const systemPrompt = await buildDietitianSystemPrompt(user.id, message);
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: message },
  ];

  const provider = getAIProvider();
  const encoder = new TextEncoder();

  if (!provider) {
    const fallback =
      "AI diyetisyen şu anda yapılandırılmamış (API anahtarı eksik). Genel öneri: hedefine göre yeterli protein (kilo başına ~1.6-2.2g), bol su ve dengeli öğünler önceliğin olsun. Yönetici bir AI anahtarı eklediğinde sana özel, veriye dayalı öneriler alırsın! 🥗";
    return streamText(encoder, fallback);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const strip = createMarkdownStripper();
      try {
        for await (const token of provider.streamChat(messages, { maxTokens: 800, temperature: 0.6 })) {
          controller.enqueue(encoder.encode(strip(token)));
        }
      } catch (err) {
        console.error("Diyetisyen stream hatası:", err);
        controller.enqueue(encoder.encode("\n\n(Diyetisyene şu an ulaşılamadı, birazdan tekrar dene. 🥗)"));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}

function streamText(encoder: TextEncoder, text: string) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(encoder.encode(text)); controller.close(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
