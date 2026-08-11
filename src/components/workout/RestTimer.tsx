"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, X, Plus, Timer } from "lucide-react";
import { VOICE_LINES } from "@/lib/voice/provider";

/**
 * Dinlenme sayacı — set sonrası otomatik başlar. Geri sayım halkası,
 * duraklat/devam, +15 sn ve atla. Basit bir "bip" Web Audio ile.
 *
 * Sesli koç açıksa (bkz. `useVoiceCoach`) başlangıçta, yarıda ve son üç
 * saniyede anons yapılır — telefona bakmadan antrenmana devam edilebilsin diye.
 */
export function RestTimer({
  seconds,
  onClose,
  onSpeak,
}: {
  seconds: number;
  onClose: () => void;
  /** Sesli koç kancasından gelir; verilmezse sessiz çalışır. */
  onSpeak?: (text: string, opts?: { interrupt?: boolean }) => void;
}) {
  const [total, setTotal] = useState(seconds);
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(true);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  // Anonsların tekrar etmemesi için hangi eşiklerin geçildiğini tutuyoruz.
  // (setLeft güncelleyicisi StrictMode'da iki kez çalışabilir.)
  const announced = useRef<Set<string>>(new Set());
  const speak = useRef(onSpeak);
  speak.current = onSpeak;

  useEffect(() => {
    speak.current?.(VOICE_LINES.restStart(seconds));
    // Yalnızca sayaç ilk kurulduğunda; `key` değiştiğinde bileşen yeniden kurulur.

  }, []);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => {
        setLeft((l) => (l <= 1 ? 0 : l - 1));
      }, 1000);
    }
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [running]);

  useEffect(() => {
    const half = Math.floor(total / 2);

    if (left === 0) {
      if (ref.current) clearInterval(ref.current);
      if (!announced.current.has("done")) {
        announced.current.add("done");
        beep();
        speak.current?.(VOICE_LINES.restDone, { interrupt: true });
      }
      return;
    }
    if (left === 3 && !announced.current.has("three")) {
      announced.current.add("three");
      speak.current?.(VOICE_LINES.restThree, { interrupt: true });
      return;
    }
    if (total >= 40 && left === half && !announced.current.has("half")) {
      announced.current.add("half");
      speak.current?.(VOICE_LINES.restHalf(left));
    }
  }, [left, total]);

  const pct = total > 0 ? (left / total) * 100 : 0;
  const r = 34;
  const circ = 2 * Math.PI * r;
  const mm = Math.floor(left / 60);
  const ss = left % 60;

  function beep() {
    try {
      const ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      o.start();
      o.stop(ctx.currentTime + 0.18);
    } catch {
      /* ses yoksa sorun değil */
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-4 rounded-2xl border border-ink-border bg-ink-card px-4 py-3 shadow-2xl md:bottom-6"
      >
        <div className="relative grid place-items-center">
          <svg width="84" height="84" className="-rotate-90">
            <circle cx="42" cy="42" r={r} fill="none" stroke="rgb(var(--border))" strokeWidth="6" />
            <circle
              cx="42"
              cy="42"
              r={r}
              fill="none"
              stroke={left === 0 ? "rgb(var(--coral))" : "rgb(var(--brand))"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ - (pct / 100) * circ}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <span className="absolute text-sm font-bold tabular-nums">
            {mm}:{ss.toString().padStart(2, "0")}
          </span>
        </div>

        <div className="flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Timer size={15} className="text-brand" />
            {left === 0 ? "Dinlenme bitti! 💪" : "Dinlenme"}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setRunning((r) => !r)}
              className="grid h-8 w-8 place-items-center rounded-lg bg-ink-soft text-fg-muted hover:text-fg"
              aria-label={running ? "Duraklat" : "Devam"}
            >
              {running ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button
              onClick={() => {
                setLeft((l) => l + 15);
                setTotal((t) => t + 15);
                // Süre uzadı; eşik anonsları yeniden yapılabilsin.
                announced.current.delete("three");
                announced.current.delete("half");
                announced.current.delete("done");
              }}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-ink-soft px-2.5 text-xs font-medium text-fg-muted hover:text-fg"
            >
              <Plus size={13} /> 15sn
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg text-fg-muted hover:bg-fg/5 hover:text-fg"
          aria-label="Kapat"
        >
          <X size={18} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
