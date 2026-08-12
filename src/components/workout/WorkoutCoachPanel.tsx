"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, ChevronDown, Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Antrenman içi AI koç.
//
// MOBİLDE VARSAYILAN KAPALI: setler arasında ekranın yarısını kaplayan bir
// sohbet, asıl işi (set kaydetme) zorlaştırır. Kullanıcı ihtiyaç duyunca açar.
// Desktopta iki sütunun altında, açık durur.
//
// HIZLI SORULAR: antrenman sırasında klavye açıp yazmak zahmetli. En sık
// sorulan üç şey tek dokunuşla gönderilir.
// ============================================================================

export interface CoachContext {
  exerciseName?: string;
  muscleGroup?: string;
  equipment?: string | null;
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

const HIZLI = [
  "Bu ağırlık doğru mu?",
  "Form için ipucu ver",
  "Yorgunum, ne yapmalıyım?",
];

export function WorkoutCoachPanel({ context }: { context: CoachContext }) {
  const [acik, setAcik] = React.useState(false);
  const [soru, setSoru] = React.useState("");
  const [cevap, setCevap] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [engellendi, setEngellendi] = React.useState(false);

  async function sor(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setCevap("");
    setEngellendi(false);
    setSoru("");

    try {
      const res = await fetch("/api/workout/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, context }),
      });

      if (!res.ok || !res.body) {
        setCevap("Şu an cevap veremedim.");
        setBusy(false);
        return;
      }
      // Acil durum kalıbı yakalandıysa sunucu modeli hiç çağırmadan
      // yönlendirme mesajı döndürür; bunu ayrı biçimde gösteriyoruz.
      if (res.headers.get("X-Safety") === "blocked") setEngellendi(true);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setCevap(acc);
      }
    } catch {
      setCevap("Bağlantı hatası.");
    }
    setBusy(false);
  }

  return (
    <div className="rounded-2xl border border-ink-border bg-ink-card">
      <button
        onClick={() => setAcik((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        aria-expanded={acik}
      >
        <Sparkles size={16} className="shrink-0 text-brand" />
        <span className="flex-1 text-sm font-semibold">Koça sor</span>
        <ChevronDown size={16} className={cn("shrink-0 text-fg-muted transition-transform", acik && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {acik && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-ink-border px-4 py-3">
              {cevap !== null && (
                <div
                  className={cn(
                    "rounded-xl px-3 py-2.5 text-sm leading-relaxed",
                    engellendi
                      ? "border border-coral/40 bg-coral/10 text-coral"
                      : "bg-ink-soft text-fg-muted"
                  )}
                >
                  {engellendi && (
                    <p className="mb-1 flex items-center gap-1.5 font-semibold">
                      <ShieldAlert size={14} /> Önemli
                    </p>
                  )}
                  {cevap || (busy ? "…" : "")}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {HIZLI.map((h) => (
                  <button
                    key={h}
                    onClick={() => sor(h)}
                    disabled={busy}
                    className="rounded-lg bg-ink-soft px-2.5 py-1.5 text-xs text-fg-muted transition-colors hover:text-fg disabled:opacity-50"
                  >
                    {h}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); sor(soru); }}
                className="flex gap-2"
              >
                <input
                  value={soru}
                  onChange={(e) => setSoru(e.target.value)}
                  placeholder="Bir şey sor…"
                  maxLength={500}
                  className="input flex-1 text-sm"
                  aria-label="Koça sorun"
                />
                <button
                  type="submit"
                  disabled={busy || !soru.trim()}
                  className="btn-primary px-4 disabled:opacity-50"
                  aria-label="Gönder"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
