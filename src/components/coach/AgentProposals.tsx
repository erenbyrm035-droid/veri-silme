"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, ShieldQuestion, Loader2 } from "lucide-react";
import { listProposals, approveProposal, rejectProposal } from "@/app/(app)/coach/actions";
import { TOOL_LABELS, type AgentAction } from "@/lib/ai/agent/types";

// ============================================================================
// Onay bekleyen agent önerileri.
//
// Koç kalori hedefini ya da program yoğunluğunu değiştirmek istediğinde
// değişikliği UYGULAMAZ; buraya bir öneri kartı düşer. Kullanıcı onaylayana
// kadar veritabanında hiçbir şey değişmez.
//
// NEDEN AYRI COMPONENT: Sohbet balonlarının içine gömseydik geçmişi
// kaydırınca kaybolurdu. Onay bekleyen bir işlem, konuşmanın neresinde
// olursan ol görünmeli.
// ============================================================================

export function AgentProposals({ refreshKey = 0 }: { refreshKey?: number }) {
  const [items, setItems] = useState<AgentAction[]>([]);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const load = useCallback(() => {
    listProposals()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  function decide(id: string, approve: boolean) {
    setBusyId(id);
    startTransition(async () => {
      const res = approve ? await approveProposal(id) : await rejectProposal(id);
      setNote({ ok: res.ok, text: res.message });
      setBusyId(null);
      // Karara bağlanan kart listeden düşsün; kalanlar sunucudan tazelensin.
      setItems((prev) => prev.filter((i) => i.id !== id));
      load();
    });
  }

  if (items.length === 0 && !note) return null;

  return (
    <div className="mb-3 space-y-2">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.07] p-3"
          >
            <div className="flex items-start gap-2.5">
              <ShieldQuestion size={18} className="mt-0.5 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Koç bir değişiklik öneriyor — onayın olmadan uygulanmadı
                </p>
                <p className="mt-1 text-sm text-fg">
                  {item.summary ?? TOOL_LABELS[item.tool] ?? item.tool}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => decide(item.id, true)}
                disabled={busyId === item.id}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
              >
                {busyId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Onayla ve uygula
              </button>
              <button
                onClick={() => decide(item.id, false)}
                disabled={busyId === item.id}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-ink-border px-3 py-2 text-xs font-semibold text-fg-muted transition-colors hover:text-fg disabled:opacity-50"
              >
                <X size={14} /> Reddet
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {note && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={
            note.ok
              ? "rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400"
              : "rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400"
          }
        >
          {note.text}
        </motion.p>
      )}
    </div>
  );
}
