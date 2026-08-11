"use client";

import { POSTURE_PROBLEMS, POSTURE_PROBLEM_LIST } from "@/lib/posture/problems";
import type { PostureProblem, PostureView } from "@/lib/database.types";
import { Check } from "lucide-react";

const VIEW_LABELS: Record<PostureView, string> = {
  front: "Önden Bakış",
  side: "Yandan Bakış",
  back: "Arkadan Bakış",
};

/**
 * Öz-değerlendirme: kullanıcı fotoğraflarına bakarak gözlemlediği problemleri
 * işaretler. Bu, AI görüntü analizi bağlanana kadar dürüst analiz sinyalidir.
 */
export function SelfAssessment({
  selected,
  onToggle,
}: {
  selected: Set<PostureProblem>;
  onToggle: (p: PostureProblem) => void;
}) {
  const views: PostureView[] = ["side", "front", "back"];
  return (
    <div className="space-y-5">
      {views.map((view) => {
        const problems = POSTURE_PROBLEM_LIST.filter(
          (p) => POSTURE_PROBLEMS[p].view === view
        );
        if (problems.length === 0) return null;
        return (
          <div key={view}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              {VIEW_LABELS[view]}
            </h4>
            <div className="space-y-2">
              {problems.map((p) => {
                const info = POSTURE_PROBLEMS[p];
                const active = selected.has(p);
                return (
                  <button
                    key={p}
                    onClick={() => onToggle(p)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? "border-brand bg-brand/10"
                        : "border-ink-border bg-ink-card hover:border-brand/40"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                        active ? "border-brand bg-brand text-black" : "border-ink-border"
                      }`}
                    >
                      {active && <Check size={13} />}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{info.label}</span>
                      <span className="block text-xs text-fg-muted">{info.assessment}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
