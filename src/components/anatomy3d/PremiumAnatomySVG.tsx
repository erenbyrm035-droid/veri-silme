"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Segmented } from "@/components/ui/Segmented";
import { STATE_COLOR, type RegionKey, type MuscleState } from "@/lib/anatomy3d/regions";

/**
 * Premium 2B anatomi — gerçek GLB modeli entegre edilene kadarki ZARİF placeholder.
 * (Kapsül/kukla değil.) Ön/Arka görünüm, neon durum renkleri, tıkla-seç.
 * Aynı `states` (bölge→durum) arayüzünü kullanır; GLB gelince şeffafça değişir.
 */

type El = { region: RegionKey; node: React.ReactNode };

const FRONT: El[] = [
  { region: "neck", node: <rect x="100" y="70" width="20" height="16" rx="6" /> },
  { region: "shoulders", node: <><ellipse cx="70" cy="112" rx="17" ry="14" /><ellipse cx="150" cy="112" rx="17" ry="14" /></> },
  { region: "chest", node: <><path d="M92 112 q20 -6 20 16 q0 14 -20 13 q-15 0 -15 -15 q0 -11 15 -14z" /><path d="M128 112 q-20 -6 -20 16 q0 14 20 13 q15 0 15 -15 q0 -11 -15 -14z" /></> },
  { region: "biceps", node: <><ellipse cx="57" cy="148" rx="10" ry="20" /><ellipse cx="163" cy="148" rx="10" ry="20" /></> },
  { region: "forearms", node: <><ellipse cx="48" cy="190" rx="9" ry="20" /><ellipse cx="172" cy="190" rx="9" ry="20" /></> },
  { region: "obliques", node: <><path d="M93 150 q-7 22 0 44 q-9 -2 -10 -22 q-1 -16 10 -22z" /><path d="M127 150 q7 22 0 44 q9 -2 10 -22 q1 -16 -10 -22z" /></> },
  { region: "abs", node: <rect x="96" y="150" width="28" height="48" rx="9" /> },
  { region: "quads", node: <><ellipse cx="97" cy="272" rx="15" ry="38" /><ellipse cx="123" cy="272" rx="15" ry="38" /></> },
  { region: "calves", node: <><ellipse cx="97" cy="368" rx="11" ry="28" /><ellipse cx="123" cy="368" rx="11" ry="28" /></> },
];

const BACK: El[] = [
  { region: "traps", node: <path d="M94 104 q26 -12 32 0 q-5 26 -16 30 q-11 -4 -16 -30z" /> },
  { region: "shoulders", node: <><ellipse cx="70" cy="112" rx="17" ry="14" /><ellipse cx="150" cy="112" rx="17" ry="14" /></> },
  { region: "lats", node: <><path d="M96 134 q-16 6 -16 34 q0 9 16 11 q7 -26 0 -45z" /><path d="M124 134 q16 6 16 34 q0 9 -16 11 q-7 -26 0 -45z" /></> },
  { region: "triceps", node: <><ellipse cx="57" cy="148" rx="10" ry="20" /><ellipse cx="163" cy="148" rx="10" ry="20" /></> },
  { region: "forearms", node: <><ellipse cx="48" cy="190" rx="9" ry="20" /><ellipse cx="172" cy="190" rx="9" ry="20" /></> },
  { region: "lowerback", node: <rect x="98" y="182" width="24" height="28" rx="8" /> },
  { region: "glutes", node: <><ellipse cx="98" cy="226" rx="16" ry="16" /><ellipse cx="122" cy="226" rx="16" ry="16" /></> },
  { region: "hamstrings", node: <><ellipse cx="97" cy="284" rx="14" ry="34" /><ellipse cx="123" cy="284" rx="14" ry="34" /></> },
  { region: "calves", node: <><ellipse cx="98" cy="372" rx="11" ry="28" /><ellipse cx="122" cy="372" rx="11" ry="28" /></> },
];

export function PremiumAnatomySVG({
  states,
  selected,
  onSelect,
}: {
  states: Record<RegionKey, MuscleState>;
  selected: RegionKey | null;
  onSelect: (r: RegionKey) => void;
}) {
  const [view, setView] = useState<"front" | "back">("front");
  const regions = view === "front" ? FRONT : BACK;

  return (
    <div className="flex flex-col items-center gap-3">
      <Segmented
        options={[{ value: "front", label: "Ön" }, { value: "back", label: "Arka" }]}
        value={view}
        onChange={(v) => setView(v as "front" | "back")}
      />
      <svg viewBox="0 0 220 470" className="h-[360px] w-auto max-w-full" role="img" aria-label="Anatomi haritası">
        <defs>
          <filter id="neon" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgb(var(--surface-2))" />
            <stop offset="1" stopColor="rgb(var(--surface))" />
          </linearGradient>
        </defs>

        {/* Vücut silueti */}
        <g fill="url(#skin)" stroke="rgb(var(--border))" strokeWidth="1.4">
          <circle cx="110" cy="46" r="21" />
          <rect x="100" y="64" width="20" height="14" rx="4" />
          <path d="M68 108 q42 -22 84 0 q-6 62 -13 100 q-29 12 -58 0 q-7 -38 -13 -100z" />
          <path d="M62 110 q-15 30 -15 86 q6 6 12 0 q6 -54 15 -80z" />
          <path d="M158 110 q15 30 15 86 q-6 6 -12 0 q-6 -54 -15 -80z" />
          <path d="M82 200 q28 12 56 0 q6 22 2 42 q-30 10 -60 0 q-4 -20 2 -42z" />
          <path d="M84 236 q-6 104 6 196 q10 4 14 -2 q4 -100 2 -194 q-12 4 -22 0z" />
          <path d="M136 236 q6 104 -6 196 q-10 4 -14 -2 q-4 -100 -2 -194 q12 4 22 0z" />
        </g>

        {/* Kas bölgeleri */}
        <g>
          {regions.map((r) => {
            const state = states[r.region] ?? "none";
            const active = state !== "none";
            const isSel = selected === r.region;
            return (
              <motion.g
                key={`${view}-${r.region}`}
                onClick={() => onSelect(r.region)}
                className="cursor-pointer"
                initial={false}
                animate={{
                  fill: STATE_COLOR[state],
                  opacity: active ? 0.95 : 0.5,
                }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                style={{
                  filter: active ? "url(#neon)" : undefined,
                  stroke: isSel ? "#ffffff" : "transparent",
                  strokeWidth: 1.5,
                }}
              >
                {r.node}
              </motion.g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
