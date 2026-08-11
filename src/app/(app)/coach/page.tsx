"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Sparkles, Boxes, X, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentProposals } from "@/components/coach/AgentProposals";
import { TOOL_LABELS } from "@/lib/ai/agent/types";
import { AGENT_EMOJI } from "@/lib/ai/agents/types";
import { Anatomy3D } from "@/components/anatomy3d/AnatomyViewerLoader";
import { parseMusclesFromText, buildMuscleStates, REGION_KEYS } from "@/lib/anatomy3d/regions";
import { useFeature } from "@/lib/premium/context";
import { PremiumGate, ProBadge } from "@/components/premium/PremiumGate";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const EMPTY_STATES = buildMuscleStates([], []);

const SUGGESTIONS = [
  "Bugün spor yapamadım, ne yapmalıyım?",
  "Kas kazanmak için ne yemeliyim?",
  "Programımı değiştirebilir miyiz?",
  "Kilo vermek için beslenme önerisi verir misin?",
];

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [showModel, setShowModel] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Son turda koçun hangi araçları kullandığı — kullanıcı cevabın nereden
  // geldiğini görsün diye gösteriliyor ("uydurmuyor, verine baktı").
  const [toolRun, setToolRun] = useState<{ name: string; ok: boolean; summary: string | null }[] | null>(null);
  // Arka planda hangi uzmanların çalıştığı. Kullanıcı TEK koçla konuşuyor;
  // bu rozet cevabın nereden geldiğini gösteriyor, ayrı ajanlarmış gibi sunmuyor.
  const [agentRun, setAgentRun] = useState<{ key: string; name: string; ok: boolean }[] | null>(null);
  // Onay bekleyen işlem sayısı değişince öneri kartı kendini yeniler.
  const [proposalCount, setProposalCount] = useState(0);
  const canUse3D = useFeature("anatomy_3d");
  const endRef = useRef<HTMLDivElement>(null);

  // İlk açılışta son sohbeti geri yükle (yenilenince/kapanınca silinmesin).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/coach", { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          if (alive && Array.isArray(data.messages) && data.messages.length) {
            setMessages(data.messages);
            if (data.conversationId) setConversationId(data.conversationId);
          }
        }
      } catch { /* sessiz */ }
      if (alive) setHydrated(true);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Koçun son mesajından kas bölgelerini canlı çıkar → 3D modeli sür.
  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant" && m.content.trim())?.content ?? "",
    [messages]
  );
  const modelStates = useMemo(() => {
    const parsed = parseMusclesFromText(lastAssistant);
    return REGION_KEYS.some((k) => parsed[k] !== "none") ? parsed : EMPTY_STATES;
  }, [lastAssistant]);
  const hasActive = modelStates !== EMPTY_STATES;

  // Koç ilk kez bir kas bölgesinden bahsedince modeli otomatik aç.
  useEffect(() => {
    if (hasActive && canUse3D) setShowModel(true);
  }, [hasActive, canUse3D]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;

    setMessages((m) => [...m, { role: "user", content }]);
    setInput("");
    setLoading(true);
    setToolRun(null);
    setAgentRun(null);

    // Boş asistan balonu ekle; token geldikçe doldururuz.
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, conversationId }),
      });

      // Free limit doldu (429) → Premium yönlendirmesi göster.
      if (res.status === 429) {
        const info = await res.json().catch(() => ({}));
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            content: `${info.error ?? "Günlük ücretsiz mesaj limitine ulaştın."}\n\nSınırsız AI koç için Premium'a yükselt → /premium`,
          };
          return copy;
        });
        return;
      }

      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let started = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // İlk satır metadata: `__meta:{json}` (agent) ya da eski `__cid:<id>`.
        // Eski biçim geriye dönük uyumluluk için korunuyor — dağıtım sırasında
        // eski istemci yeni sunucuya (ya da tersi) denk gelebilir.
        if (!started) {
          const nl = buffer.indexOf("\n");
          if (nl === -1) continue;
          const meta = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          started = true;

          if (meta.startsWith("__meta:")) {
            try {
              const m = JSON.parse(meta.slice(7)) as {
                cid?: string;
                tools?: { name: string; ok: boolean; summary: string | null }[];
                proposals?: number;
                agents?: { key: string; name: string; ok: boolean }[];
              };
              if (m.cid) setConversationId(m.cid);
              setToolRun(m.tools?.length ? m.tools : null);
              setAgentRun(m.agents?.length ? m.agents : null);
              if (m.proposals) setProposalCount((c) => c + m.proposals!);
            } catch { /* metadata bozuksa cevabı yine göster */ }
          } else if (meta.startsWith("__cid:")) {
            const cid = meta.slice(6).trim();
            if (cid) setConversationId(cid);
          }
        }

        const chunk = buffer;
        buffer = "";
        if (chunk) {
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = {
              role: "assistant",
              content: copy[copy.length - 1].content + chunk,
            };
            return copy;
          });
        }
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "Bağlantı hatası. Lütfen tekrar dene.",
        };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-14.5rem)] flex-col md:h-[calc(100vh-7rem)]">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="text-brand" size={24} /> Viva Koç
          </h1>
          <p className="text-sm text-fg-muted">
            Yaşına, hedefine ve antrenmanlarına göre kişisel tavsiye.
          </p>
        </div>
        <button
          onClick={() => setShowModel((v) => !v)}
          className={cn(
            "relative inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
            showModel ? "border-brand bg-brand/10 text-brand" : "border-ink-border text-fg-muted hover:text-fg"
          )}
          aria-label="3D kas modeli"
        >
          <Boxes size={15} /> 3D {!canUse3D && <ProBadge className="ml-0.5" />}
          {hasActive && !showModel && canUse3D && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-brand" />}
        </button>
      </header>

      {/* Canlı 3D kas modeli — koç bahsettikçe kaslar renklenir */}
      {showModel && (
        <div className="relative mb-4 shrink-0">
          <div className="mx-auto max-w-[240px]">
            {canUse3D ? (
              <Anatomy3D states={modelStates} />
            ) : (
              <PremiumGate feature="anatomy_3d" mode="replace"
                description="Koçun bahsettiği kasların canlı 3D modelde renklenmesi Premium'a özeldir." />
            )}
          </div>
          <button
            onClick={() => setShowModel(false)}
            className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-lg bg-ink-card/80 text-fg-muted backdrop-blur hover:text-fg"
            aria-label="Modeli gizle"
          >
            <X size={15} />
          </button>
          <p className="mt-1.5 text-center text-[11px] text-fg-muted">
            {hasActive ? "Koçun bahsettiği kaslar yanıyor 🟢 ana · 🟡 yardımcı" : "Koç bir kas grubundan bahsedince burada yanacak."}
          </p>
        </div>
      )}

      {/* Koçun onay bekleyen önerileri (kalori/program değişikliği) */}
      <AgentProposals refreshKey={proposalCount} />

      {/* Mesajlar */}
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 && hydrated && (
          <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand/10 text-3xl">
              🤖
            </div>
            <div>
              <p className="font-semibold">Merhaba! Ben senin AI koçunum.</p>
              <p className="mt-1 text-sm text-fg-muted">
                Aşağıdaki sorulardan biriyle başlayabilirsin.
              </p>
            </div>
            <div className="grid w-full max-w-md gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-ink-border bg-ink-card px-4 py-3 text-left text-sm text-fg transition-colors hover:border-brand/50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              m.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
                m.role === "user"
                  ? "bg-brand text-black"
                  : "border border-ink-border bg-ink-card text-fg"
              )}
            >
              {m.content ? (
                m.content
              ) : (
                <span className="flex gap-1 py-0.5">
                  <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Arka planda hangi uzmanların çalıştığı. Kullanıcı tek koçla
            konuşuyor; bu rozet cevabın derinliğini gösteriyor. */}
        {agentRun && agentRun.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pl-1">
            <span className="text-[11px] text-fg-muted">Değerlendiren:</span>
            {agentRun.map((a) => (
              <span
                key={a.key}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium",
                  a.ok ? "bg-brand/10 text-brand" : "bg-fg-muted/10 text-fg-muted line-through"
                )}
              >
                {AGENT_EMOJI[a.key as keyof typeof AGENT_EMOJI] ?? "🤖"} {a.name}
              </span>
            ))}
          </div>
        )}

        {/* Koçun bu turda hangi verilere baktığını göster — cevabın kaynağı
            görünür olsun diye. "Uyduruyor mu?" sorusunun somut cevabı. */}
        {toolRun && toolRun.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            {toolRun.map((t, i) => (
              <span
                key={`${t.name}-${i}`}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium",
                  t.ok
                    ? "bg-brand/10 text-brand"
                    : "bg-fg-muted/10 text-fg-muted"
                )}
                title={t.summary ?? undefined}
              >
                <Wrench size={11} />
                {TOOL_LABELS[t.name] ?? t.name}
              </span>
            ))}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Girdi */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-4 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Koçuna bir şey sor..."
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn-primary aspect-square !px-0 w-11"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

function Dot({ delay = "0ms" }: { delay?: string }) {
  return (
    <span
      className="h-2 w-2 animate-bounce rounded-full bg-fg/40"
      style={{ animationDelay: delay }}
    />
  );
}
