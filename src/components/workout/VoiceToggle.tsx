"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Crown, Sparkles, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoiceProviderId } from "@/lib/voice/provider";

/**
 * Sesli koç anahtarı.
 *
 * Varsayılan kapalı; kullanıcı jesti olmadan ses çalmak hem tarayıcı
 * politikalarına takılır hem de salonda istenmez. Açıldığında sağlayıcı seçimi
 * de burada yapılır — Premium değilse ElevenLabs seçeneği kilitli gösterilir
 * ("neden kapalı" açıkça belli olsun diye gizlenmez).
 */
export function VoiceToggle({
  enabled, provider, isPremium, onToggle, onProvider,
}: {
  enabled: boolean;
  provider: VoiceProviderId;
  isPremium: boolean;
  onToggle: () => void;
  onProvider: (p: VoiceProviderId) => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="rounded-2xl border border-ink-border bg-ink-card p-3">
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggle}
          aria-pressed={enabled}
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors",
            enabled ? "bg-brand/15 text-brand" : "bg-ink-soft text-fg-muted"
          )}
          aria-label={enabled ? "Sesli koçu kapat" : "Sesli koçu aç"}
        >
          {enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Sesli koç</p>
          <p className="text-[11px] text-fg-muted">
            {enabled
              ? provider === "elevenlabs"
                ? "Gerçekçi ses açık — set ve dinlenme anonsları"
                : "Açık — set ve dinlenme anonsları"
              : "Kapalı. Telefona bakmadan antrenman için aç."}
          </p>
        </div>

        {enabled && (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Ses ayarları"
            aria-expanded={open}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fg-muted hover:bg-fg/5 hover:text-fg"
          >
            <Settings2 size={16} />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {enabled && open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink-border pt-3">
              <button
                onClick={() => onProvider("web-speech")}
                aria-pressed={provider === "web-speech"}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
                  provider === "web-speech"
                    ? "border-brand/50 bg-brand/15 text-brand"
                    : "border-ink-border bg-ink-soft text-fg-muted hover:text-fg"
                )}
              >
                Cihaz sesi · ücretsiz
              </button>

              {isPremium ? (
                <button
                  onClick={() => onProvider("elevenlabs")}
                  aria-pressed={provider === "elevenlabs"}
                  className={cn(
                    "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
                    provider === "elevenlabs"
                      ? "border-[#FFD34D]/50 bg-[#FFD34D]/15 text-[#FFD34D]"
                      : "border-ink-border bg-ink-soft text-fg-muted hover:text-fg"
                  )}
                >
                  <Sparkles size={11} /> Gerçekçi ses
                </button>
              ) : (
                <Link
                  href="/premium"
                  className="flex items-center gap-1 rounded-lg border border-[#FFD34D]/30 bg-[#FFD34D]/8 px-2.5 py-1.5 text-[11px] font-bold text-[#FFD34D]"
                >
                  <Crown size={11} /> Gerçekçi ses · Premium
                </Link>
              )}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-fg-muted">
              Cihaz sesi tarayıcının kendi Türkçe motorunu kullanır; internet
              gerektirmez ve ücretsizdir.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
