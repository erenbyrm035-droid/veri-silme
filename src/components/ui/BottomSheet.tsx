"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Mobil öncelikli alt sayfa (bottom sheet). Masaüstünde ortalanmış modal gibi
 * davranır. Framer Motion ile açılış/kapanış animasyonu + backdrop.
 * document.body'e portal ile taşınır — böylece sayfadaki hiçbir eleman
 * (grafik halkaları, sticky bar vb.) panelin üstüne binemez.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-ink-border bg-ink-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[85dvh] sm:rounded-3xl sm:pb-5"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            drag={reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) onClose();
            }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-fg/20 sm:hidden" />
            {title && (
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">{title}</h3>
                <button
                  onClick={onClose}
                  className="grid h-8 w-8 place-items-center rounded-lg text-fg-muted hover:bg-fg/5 hover:text-fg"
                  aria-label="Kapat"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
