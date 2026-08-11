"use client";

import { motion } from "framer-motion";
import { Info, ShieldCheck } from "lucide-react";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { FindingCard } from "./FindingCard";
import { CorrectiveProgramView } from "./CorrectiveProgramView";
import { POSTURE_DISCLAIMER } from "@/lib/posture/problems";
import { normalizeEnv } from "@/lib/posture/assemble";
import type { PostureAnalysis } from "@/lib/database.types";

const SCORE_META = [
  { key: "posture_score", label: "Postür", color: "#e7fb00" },
  { key: "mobility_score", label: "Mobilite", color: "#38bdf8" },
  { key: "symmetry_score", label: "Simetri", color: "#fb7185" },
  { key: "recovery_score", label: "Toparlanma", color: "#34d399" },
] as const;

/** Bir postür analizinin tam sonucu: skorlar, özet, bulgular, program. */
export function AnalysisResult({ analysis }: { analysis: PostureAnalysis }) {
  const findings = analysis.findings ?? [];
  const problems = findings.map((f) => f.problem);

  return (
    <div className="space-y-5">
      {/* Skorlar */}
      <div className="card">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-fg-muted">
          Analiz Skorların
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SCORE_META.map((s, i) => (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              className="flex flex-col items-center"
            >
              <ProgressRing value={analysis[s.key]} size={92} color={s.color}>
                <span className="text-xl font-bold">{analysis[s.key]}</span>
              </ProgressRing>
              <span className="mt-2 text-xs font-medium text-fg-muted">{s.label}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Özet */}
      {analysis.summary && (
        <div className="card flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
            <Info size={18} />
          </span>
          <p className="text-sm leading-relaxed">{analysis.summary}</p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-200/90">
        <ShieldCheck size={18} className="mt-0.5 shrink-0" />
        <p className="text-xs leading-relaxed">{POSTURE_DISCLAIMER}</p>
      </div>

      {/* Bulgular */}
      {findings.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-bold">
            Tespit Edilen Bulgular ({findings.length})
          </h2>
          {findings.map((f) => (
            <FindingCard key={f.problem} finding={f} />
          ))}
        </div>
      ) : (
        <div className="card text-center">
          <p className="text-sm text-fg-muted">
            Belirgin bir postür problemi işaretlenmedi. Genel mobilite ve denge
            programına devam edebilirsin.
          </p>
        </div>
      )}

      {/* Düzeltici program */}
      {problems.length > 0 && (
        <CorrectiveProgramView
          problems={problems}
          initialEnv={normalizeEnv(analysis.environment)}
        />
      )}
    </div>
  );
}
