"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "lucide-react";
import { useLiveNotifications } from "@/lib/social/hooks";

/**
 * Sağ üstte biriken canlı bildirim balonları.
 * Supabase Realtime üzerinden anlık gelir, 6 sn sonra kendiliğinden kapanır.
 */
export function LiveNotifications({ userId }: { userId: string }) {
  const { notices, dismiss } = useLiveNotifications(userId);

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[70] flex w-[min(340px,calc(100vw-1.5rem))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {notices.map((n) => {
          const inner = (
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
                <Bell size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{n.title}</p>
                {n.body && <p className="line-clamp-2 text-[11px] leading-snug text-fg-muted">{n.body}</p>}
              </div>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismiss(n.id); }}
                aria-label="Kapat"
                className="shrink-0 rounded-lg p-1 text-fg-muted transition-colors hover:text-fg"
              >
                <X size={14} />
              </button>
            </div>
          );

          return (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              className="pointer-events-auto rounded-2xl border border-white/12 bg-ink-card/95 p-3 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.6)] backdrop-blur-xl"
            >
              {n.href ? <Link href={n.href} onClick={() => dismiss(n.id)}>{inner}</Link> : inner}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
