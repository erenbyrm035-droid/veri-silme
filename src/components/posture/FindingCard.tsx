"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, AlertTriangle } from "lucide-react";
import type { PostureFinding, RiskLevel } from "@/lib/database.types";
import { RISK_LABELS } from "@/lib/posture/problems";

const RISK_STYLE: Record<RiskLevel, string> = {
  low: "bg-emerald-500/15 text-emerald-400",
  moderate: "bg-amber-500/15 text-amber-400",
  high: "bg-red-500/15 text-red-400",
};

/** Tek postür bulgusu: güven, risk, kaslar ve AI açıklamaları. */
export function FindingCard({ finding }: { finding: PostureFinding }) {
  const [open, setOpen] = useState(false);
  const e = finding.explanation;

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">{finding.label}</h3>
          <p className="mt-1 text-sm text-fg-muted">{finding.description}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${RISK_STYLE[finding.risk]}`}
        >
          {RISK_LABELS[finding.risk]} risk
        </span>
      </div>

      {/* Güven skoru */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-fg-muted">
          <span>Güven skoru</span>
          <span className="font-semibold text-fg">%{finding.confidence}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-soft">
          <div
            className="h-full rounded-full bg-brand transition-all duration-700"
            style={{ width: `${finding.confidence}%` }}
          />
        </div>
      </div>

      {/* Kaslar */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MuscleList title="Zayıf kaslar" items={finding.weak_muscles} tone="weak" />
        <MuscleList title="Gergin kaslar" items={finding.tight_muscles} tone="tight" />
      </div>
      {finding.affected_muscles.length > 0 && (
        <p className="mt-3 text-xs text-fg-muted">
          <span className="font-semibold text-fg">Etkilenen bölge:</span>{" "}
          {finding.affected_muscles.join(", ")}
        </p>
      )}

      {/* AI açıklama akordiyonu */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-4 flex w-full items-center justify-between rounded-xl bg-ink-soft px-3.5 py-2.5 text-sm font-semibold"
      >
        <span>AI Açıklaması</span>
        <ChevronDown
          size={16}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <dl className="mt-3 space-y-3 text-sm">
              <Row q="Bu problem ne anlama geliyor?" a={e.meaning} />
              <Row q="Günlük hayatta nasıl etkiler?" a={e.daily_life} />
              <Row q="Spor performansını nasıl etkiler?" a={e.sport_performance} />
              <Row q="Düzelmesi ne kadar sürer?" a={e.recovery_time} />
              <div className="flex gap-2 rounded-xl bg-amber-500/10 p-3 text-amber-300/90">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span className="text-xs">{e.cautions}</span>
              </div>
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MuscleList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "weak" | "tight";
}) {
  return (
    <div className="rounded-xl border border-ink-border bg-ink-card p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((m) => (
          <span
            key={m}
            className={`rounded-md px-2 py-0.5 text-xs ${
              tone === "weak"
                ? "bg-sky-500/15 text-sky-300"
                : "bg-orange-500/15 text-orange-300"
            }`}
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

function Row({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <dt className="font-semibold">{q}</dt>
      <dd className="mt-0.5 text-fg-muted">{a}</dd>
    </div>
  );
}
