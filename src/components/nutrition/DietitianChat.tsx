"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Salad, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "Bugün kalan kalorimle ne yiyebilirim?",
  "Antrenman sonrası ne yemeliyim?",
  "Kilo vermek için akşam önerisi ver",
  "Yeterli protein alıyor muyum?",
];

/**
 * AI Diyetisyen — RAG destekli sohbet. Kullanıcının tüm verilerini + doğrulanmış
 * besin veritabanını kullanarak gerçek bir diyetisyen gibi yanıt verir.
 */
export function DietitianChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const history = messages.slice(-8);
    setMessages((m) => [...m, { role: "user", content }, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/dietitian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history }),
      });
      if (res.status === 429) {
        const info = await res.json().catch(() => ({}));
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: "assistant", content: `${info.error ?? "Saatlik ücretsiz mesaj limitine ulaştın."}\n\nSınırsız AI diyetisyen için Premium'a yükselt → /premium` };
          return c;
        });
        return;
      }
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: "assistant", content: c[c.length - 1].content + chunk };
          return c;
        });
      }
    } catch {
      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = { role: "assistant", content: "Bağlantı hatası. Lütfen tekrar dene." };
        return c;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-17.5rem)] max-h-[680px] min-h-[340px] flex-col overflow-hidden rounded-2xl border border-ink-border bg-ink-card md:h-[calc(100dvh-13rem)]">
      <div className="flex items-center gap-2.5 border-b border-ink-border px-4 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand"><Salad size={19} /></span>
        <div className="min-w-0">
          <p className="text-sm font-bold">AI Diyetisyen</p>
          <p className="truncate text-[11px] text-fg-muted">Verilerine ve besin veritabanına göre kişisel öneri</p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-6 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-3xl">🥗</div>
            <p className="text-sm text-fg-muted">Diyetisyenine bir şey sor. Profilini, günlük makrolarını ve besin veritabanını kullanır.</p>
            <div className="grid w-full gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="rounded-xl border border-ink-border bg-ink-soft px-3 py-2.5 text-left text-sm transition-colors hover:border-brand/50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
              m.role === "user" ? "bg-brand text-black" : "border border-ink-border bg-ink-soft text-fg"
            )}>
              {m.content || <span className="flex gap-1 py-0.5"><Dot /><Dot d="150ms" /><Dot d="300ms" /></span>}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t border-ink-border p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Diyetisyenine sor…" className="input flex-1" />
        <button type="submit" disabled={loading || !input.trim()} className="btn-primary aspect-square !px-0 w-11">
          {loading ? <Sparkles size={18} className="animate-pulse" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
}

function Dot({ d = "0ms" }: { d?: string }) {
  return <span className="h-2 w-2 animate-bounce rounded-full bg-fg/40" style={{ animationDelay: d }} />;
}
