"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

const STEPS = [
  "Profilin analiz ediliyor",
  "Kalori ve protein hedefin hesaplanıyor",
  "Kişisel antrenman programın oluşturuluyor",
  "Haftalık öneriler hazırlanıyor",
];

/**
 * Onboarding sonrası premium AI analiz ekranı.
 * Adımlar sırayla tamamlanır; asıl kayıt/işlem üst bileşende yürür.
 */
export function AiAnalysisScreen({ error }: { error?: string | null }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (error) return;
    const t = setInterval(() => {
      setActive((a) => (a < STEPS.length ? a + 1 : a));
    }, 900);
    return () => clearInterval(t);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      {/* Pulsan halka */}
      <div className="relative mb-8 grid place-items-center">
        {!reduce && (
          <>
            <motion.span
              className="absolute h-28 w-28 rounded-full border border-brand/30"
              animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.span
              className="absolute h-28 w-28 rounded-full border border-brand/30"
              animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.9 }}
            />
          </>
        )}
        <div className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-brand to-coral text-4xl shadow-2xl">
          🧠
        </div>
      </div>

      <h1 className="text-balance text-xl font-bold sm:text-2xl">
        AI senin için kişisel fitness planını hazırlıyor...
      </h1>
      <p className="mt-2 max-w-xs text-sm text-fg-muted">
        Bu birkaç saniye sürebilir. Verilerin analiz ediliyor.
      </p>

      {/* Adım listesi */}
      <div className="mt-8 w-full max-w-xs space-y-2.5 text-left">
        {STEPS.map((s, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <motion.div
              key={s}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: done || current ? 1 : 0.4 }}
              className="flex items-center gap-3"
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                  done ? "bg-brand text-black" : "bg-ink-soft text-fg-muted"
                }`}
              >
                {done ? (
                  <Check size={14} />
                ) : current ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <span className="text-[11px]">{i + 1}</span>
                )}
              </span>
              <span className={`text-sm ${done || current ? "text-fg" : "text-fg-muted"}`}>
                {s}
              </span>
            </motion.div>
          );
        })}
      </div>

      {error && (
        <p className="mt-6 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
