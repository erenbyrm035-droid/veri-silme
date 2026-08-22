import { createClient } from "@/lib/supabase/server";
import { getAIProvider, type ChatMessage } from "@/lib/ai/provider";
import { aiRateGuard } from "@/lib/security/ai-guard";
import { screenUserMessage, screenAnswer, PATTERN_WARNING } from "@/lib/ai/agents/safety";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // AI üretimi uzun sürer; Vercel varsayılanı (10-15 sn) yetmiyor

// ============================================================================
// ANTRENMAN İÇİ AI KOÇ
//
// Neden ayrı bir uç nokta: `/api/coach` tam çoklu ajan akışı — yönlendirme,
// katmanlı hafıza, araç çağırma, birleştirme. Antrenman sırasında kullanıcı
// setler arasında 20-30 saniyesi olan biri; o ağır akış hem yavaş hem gereksiz.
// Burada TEK ve odaklı bir çağrı var, antrenmanın O ANKİ durumu bağlam olarak
// veriliyor.
//
// GÜVENLİK ÖNCE: Antrenman sırasında "göğsüm ağrıyor" yazan biri tam da acil
// durum vakasıdır. `screenUserMessage` deterministik kırmızı çizgi kalıplarını
// MODELİ HİÇ ÇAĞIRMADAN yakalar ve yönlendirme mesajı döner. Modelin bunu
// yakalamasına güvenilmez.
// ============================================================================

const SYSTEM = `Sen bir fitness koçusun ve kullanıcı ŞU AN antrenman yapıyor.

Setler arasında konuşuyorsun: cevabın KISA olmalı — en fazla 2-3 cümle.

Kurallar:
- Sana verilen antrenman verisi KESİNDİR. Sayı uydurma, yalnızca verilenleri kullan.
- Somut ol: "biraz daha ağır" değil, "32.5 kg dene".
- Tıbbi teşhis KOYMA. Ağrı, uyuşma veya sakatlık ima eden bir durumda
  antrenmanı durdurmasını ve bir uzmana danışmasını söyle.
- Emoji kullanma. Türkçe yaz. Egzersiz adlarını OLDUĞU GİBİ bırak.`;

interface Ctx {
  exerciseName?: string;
  muscleGroup?: string;
  equipment?: string;
  setNumber?: number;
  totalSets?: number;
  targetReps?: number | null;
  suggestion?: string;
  previous?: string;
  lastRir?: number | null;
  lastRpe?: number | null;
  completedSets?: number;
  totalVolume?: number;
}

function contextBlock(c: Ctx): string {
  const l: string[] = [];
  if (c.exerciseName) l.push(`Şu anki hareket: ${c.exerciseName}${c.muscleGroup ? ` (${c.muscleGroup})` : ""}`);
  if (c.equipment) l.push(`Ekipman: ${c.equipment}`);
  if (c.setNumber && c.totalSets) l.push(`Set: ${c.setNumber}/${c.totalSets}`);
  if (c.targetReps) l.push(`Hedef tekrar: ${c.targetReps}`);
  if (c.previous) l.push(`Bu harekette geçen seferki performansı: ${c.previous}`);
  if (c.suggestion) l.push(`Sistemin bugünkü önerisi: ${c.suggestion}`);
  if (c.lastRir !== null && c.lastRir !== undefined) l.push(`Son setteki RIR: ${c.lastRir}`);
  if (c.lastRpe !== null && c.lastRpe !== undefined) l.push(`Son setteki RPE: ${c.lastRpe}`);
  if (c.completedSets !== undefined) l.push(`Bu antrenmanda tamamlanan set: ${c.completedSets}`);
  if (c.totalVolume) l.push(`Bu antrenmandaki toplam hacim: ${c.totalVolume} kg`);
  return l.join("\n");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const rl = await aiRateGuard(request, supabase, user.id);
  if (rl) return rl;

  const body = await request.json().catch(() => ({}));
  const message = String(body?.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Boş mesaj." }, { status: 400 });
  if (message.length > 500) return NextResponse.json({ error: "Mesaj çok uzun." }, { status: 400 });

  const encoder = new TextEncoder();

  // --- ACİL DURUM: model hiç çalıştırılmadan kesin cevap -------------------
  const screen = screenUserMessage(message);
  if (screen.verdict === "block" && screen.message) {
    return new Response(encoder.encode(screen.message), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Safety": "blocked" },
    });
  }

  let provider: ReturnType<typeof getAIProvider>;
  try {
    provider = getAIProvider();
  } catch {
    return NextResponse.json({ error: "AI şu an kullanılamıyor." }, { status: 503 });
  }
  if (!provider) return NextResponse.json({ error: "AI yapılandırılmamış." }, { status: 503 });

  const ctx = contextBlock((body?.context ?? {}) as Ctx);
  const messages: ChatMessage[] = [
    { role: "system", content: `${SYSTEM}\n\n=== ANTRENMAN DURUMU ===\n${ctx}\n=== SON ===` },
    { role: "user", content: message },
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        for await (const chunk of provider.streamChat(messages, { temperature: 0.5, maxTokens: 220 })) {
          full += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
        // Cevap üretildikten SONRA deterministik tarama. Kalıp yakalanırsa
        // uyarı eklenir — model "güvenli" dese bile kalıplar üstündür.
        const flags = screenAnswer(full);
        if (flags.length) controller.enqueue(encoder.encode(`\n\n${PATTERN_WARNING}`));
      } catch {
        controller.enqueue(encoder.encode("Şu an cevap veremedim, birazdan tekrar dene."));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
