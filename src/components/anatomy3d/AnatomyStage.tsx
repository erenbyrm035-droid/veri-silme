"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { PremiumAnatomySVG } from "./PremiumAnatomySVG";
import { ANATOMY_MODEL_URL } from "@/lib/anatomy3d/model-config";
import {
  REGION_LABELS, REGION_INFO, REGION_SLUG, STATE_COLOR,
  type RegionKey, type MuscleState,
} from "@/lib/anatomy3d/regions";
import { X, ChevronRight, Sparkles, Boxes } from "lucide-react";

// GLB (Three.js) yalnızca bir model URL'i tanımlıysa ve istemcide yüklenir.
const AnatomyViewer = dynamic(() => import("./AnatomyViewer").then((m) => m.AnatomyViewer), {
  ssr: false,
  loading: () => (
    <div className="grid aspect-square w-full place-items-center rounded-2xl border border-ink-border bg-ink-card">
      <p className="text-xs text-fg-muted">3D model yükleniyor…</p>
    </div>
  ),
});

/**
 * Anatomi sahnesi — GLB modeli varsa gerçek 3D, yoksa zarif 2B placeholder.
 * Kas seçildiğinde cam efektli bilgi kartı gösterir (ad/görev/egzersizler/AI).
 * Egzersiz, AI Koç, Program ve Postür aynı `states` arayüzünü kullanır.
 */
export function AnatomyStage({ states }: { states: Record<RegionKey, MuscleState> }) {
  const [selected, setSelected] = useState<RegionKey | null>(null);
  const useGLB = !!ANATOMY_MODEL_URL;

  return (
    <div className="glass overflow-hidden rounded-3xl p-4">
      <div className="relative">
        {useGLB ? (
          <AnatomyViewer states={states} modelUrl={ANATOMY_MODEL_URL!} onSelect={setSelected} />
        ) : (
          <PremiumAnatomySVG states={states} selected={selected} onSelect={setSelected} />
        )}

        {/* Renk efsanesi */}
        <div className="absolute right-1 top-1 flex flex-col gap-1 rounded-xl border border-ink-border bg-ink-card/80 p-2 text-[11px] backdrop-blur">
          <Legend color={STATE_COLOR.primary} label="Ana kas" />
          <Legend color={STATE_COLOR.secondary} label="Yardımcı" />
          <Legend color={STATE_COLOR.none} label="Pasif" />
        </div>

        {!useGLB && (
          <div className="pointer-events-none absolute left-1 top-1 inline-flex items-center gap-1 rounded-lg border border-brand/30 bg-ink-card/80 px-2 py-1 text-[11px] font-medium text-brand backdrop-blur">
            <Boxes size={11} /> 3D model yakında
          </div>
        )}
      </div>

      {/* Seçilen kas bilgi kartı */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-3 rounded-2xl border border-ink-border bg-ink-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: STATE_COLOR[states[selected] ?? "none"] }}
                />
                <div>
                  <h4 className="text-sm font-bold">{REGION_LABELS[selected]}</h4>
                  <p className="text-[11px] text-fg-muted">
                    {states[selected] === "primary" ? "Ana çalışan kas" : states[selected] === "secondary" ? "Yardımcı kas" : "Bu harekette pasif"}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fg-muted hover:text-fg" aria-label="Kapat">
                <X size={15} />
              </button>
            </div>

            <p className="mt-3 text-sm text-fg-muted">{REGION_INFO[selected]}</p>

            <div className="mt-3 flex items-start gap-2 rounded-xl bg-brand/5 p-2.5">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-brand" />
              <p className="text-xs text-fg-muted">
                {states[selected] === "primary"
                  ? `Bu harekette ${REGION_LABELS[selected]} ana yükü taşır — kontrollü tempo ve tam açıklık en iyi gelişimi verir.`
                  : states[selected] === "secondary"
                    ? `${REGION_LABELS[selected]} destekleyici rol oynar; ana kasa odaklan, bu kas stabiliteye katkı verir.`
                    : `${REGION_LABELS[selected]} bu harekette birincil hedef değil. Onu hedefleyen hareketlere göz at.`}
              </p>
            </div>

            <Link
              href={`/anatomy/${REGION_SLUG[selected]}`}
              className="mt-3 flex items-center justify-between rounded-xl bg-ink-soft px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-fg/5"
            >
              Kas detayı & en iyi egzersizler
              <ChevronRight size={16} className="text-fg-muted" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-fg-muted">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {label}
    </span>
  );
}
