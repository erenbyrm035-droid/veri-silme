"use client";

import * as React from "react";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
import { Sparkles, X } from "lucide-react";

/** Sayı sayaç animasyonu (XP / skor artışları için). */
export function CountUp({ to, duration = 1, className }: { to: number; duration?: number; className?: string }) {
  const mv = useMotionValue(0);
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    const controls = animate(mv, to, { duration, ease: "easeOut", onUpdate: (v) => setVal(Math.round(v)) });
    return controls.stop;
  }, [to, duration, mv]);
  return <span className={className}>{val.toLocaleString("tr-TR")}</span>;
}

/** Level Up kutlama modalı — leveled_up olduğunda gösterilir. */
export function LevelUpModal({ open, level, title, color, onClose }: { open: boolean; level: number; title: string; color: string; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-ink-border bg-ink-card p-8 text-center"
            initial={{ scale: 0.7, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 16, stiffness: 220 }} onClick={(e) => e.stopPropagation()}
          >
            {/* Işıma halkaları */}
            {[0, 1, 2].map((i) => (
              <motion.div key={i} className="absolute left-1/2 top-24 -z-0 h-40 w-40 -translate-x-1/2 rounded-full"
                style={{ background: `radial-gradient(circle, ${color}44, transparent 70%)` }}
                initial={{ scale: 0.4, opacity: 0.8 }} animate={{ scale: 2.2, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }} />
            ))}
            <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-fg-muted hover:bg-fg/5"><X size={18} /></button>
            <motion.div className="relative mx-auto grid h-24 w-24 place-items-center rounded-full text-3xl font-black text-black"
              style={{ background: color }} initial={{ rotate: -20 }} animate={{ rotate: [-20, 8, 0] }} transition={{ delay: 0.2, duration: 0.6 }}>
              {level}
            </motion.div>
            <motion.p className="mt-5 flex items-center justify-center gap-1.5 text-sm font-semibold text-brand"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <Sparkles size={15} /> SEVİYE ATLADIN
            </motion.p>
            <motion.h2 className="mt-1 text-2xl font-bold tracking-tight" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
              {title}
            </motion.h2>
            <p className="mt-1 text-sm text-fg-muted">Seviye {level}&apos;e ulaştın. Muhteşem gidiyorsun!</p>
            <ConfettiBurst color={color} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ConfettiBurst({ color }: { color: string }) {
  const pieces = React.useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    id: i, x: (Math.random() - 0.5) * 300, r: Math.random() * 360,
    c: [color, "#A3E635", "#FBBF24", "#FB7185", "#38BDF8"][i % 5], delay: Math.random() * 0.2,
  })), [color]);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-16">
      {pieces.map((p) => (
        <motion.span key={p.id} className="absolute left-1/2 h-2 w-2 rounded-sm" style={{ background: p.c }}
          initial={{ y: 0, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: 260, x: p.x, opacity: 0, rotate: p.r }}
          transition={{ duration: 1.6, delay: p.delay, ease: "easeOut" }} />
      ))}
    </div>
  );
}

/** XP kazanım rozeti — kısa "+N XP" patlaması. */
export function XpBurst({ amount }: { amount: number }) {
  return (
    <motion.span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-bold text-brand"
      initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300 }}>
      +{amount} XP
    </motion.span>
  );
}
