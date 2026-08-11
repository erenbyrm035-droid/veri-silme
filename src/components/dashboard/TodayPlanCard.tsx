"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Droplets, Beef, Dumbbell, Footprints, Moon, ChevronRight, Loader2, X, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { saveDailyMetric } from "@/lib/data/daily-actions";
import type { DailySummary } from "@/lib/data/dashboard";

type ItemKey = "water" | "protein" | "workout" | "steps" | "sleep";

interface Item {
  key: ItemKey;
  label: string;
  icon: React.ReactNode;
  value: number;
  goal: number;
  unit: string;
  done: boolean;
  href?: string;
  /** Elle giriş gerektiren maddeler (adım/uyku) için düzenleme anahtarı. */
  edit?: "steps" | "sleep";
  format?: (v: number) => string;
}

const hhmm = (min: number) => `${Math.floor(min / 60)}s ${min % 60}dk`;

/**
 * Günün görev merkezi — beş hedefin tek bakışta durumu.
 * Tamamlanma halkası animasyonlu; adım ve uyku doğrudan buradan kaydedilebilir.
 */
export function TodayPlanCard({ summary, workoutHref }: { summary: DailySummary; workoutHref: string }) {
  const [editing, setEditing] = React.useState<"steps" | "sleep" | null>(null);

  const items: Item[] = [
    {
      key: "water", label: "Su", icon: <Droplets size={15} />,
      value: summary.water_ml, goal: summary.water_goal, unit: "ml",
      done: summary.water_ml >= summary.water_goal, href: "/nutrition",
    },
    {
      key: "protein", label: "Protein", icon: <Beef size={15} />,
      value: summary.protein_g, goal: summary.protein_goal, unit: "g",
      done: summary.protein_g >= summary.protein_goal, href: "/nutrition",
    },
    {
      key: "workout", label: "Antrenman", icon: <Dumbbell size={15} />,
      value: summary.workout_done ? 1 : 0, goal: 1, unit: "",
      done: summary.workout_done, href: workoutHref,
      format: () => (summary.workout_done ? "Tamamlandı" : summary.workout_planned ? "Planlandı" : "Başlat"),
    },
    {
      key: "steps", label: "Adım", icon: <Footprints size={15} />,
      value: summary.steps, goal: summary.step_goal, unit: "",
      done: summary.steps >= summary.step_goal, edit: "steps",
    },
    {
      key: "sleep", label: "Uyku", icon: <Moon size={15} />,
      value: summary.sleep_minutes, goal: summary.sleep_goal, unit: "",
      done: summary.sleep_minutes >= summary.sleep_goal, edit: "sleep",
      format: (v) => (v > 0 ? hhmm(v) : "Kaydet"),
    },
  ];

  const pct = summary.completion_pct;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-card/70 p-4 backdrop-blur-xl sm:p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(80% 60% at 15% 0%, rgb(var(--brand) / 0.10) 0%, transparent 65%)" }}
      />

      <div className="relative flex items-start gap-4">
        <Ring pct={pct} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-brand">Bugünkü Plan</p>
          <p className="mt-0.5 text-lg font-black leading-tight">
            {summary.done_count}/{summary.total_count} hedef tamam
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {pct === 100
              ? "Günü eksiksiz kapattın. Efsanesin. 🔥"
              : pct >= 60
                ? "Az kaldı, bitirmeye çok yakınsın."
                : "Küçük bir adım bile seriyi sürdürür."}
          </p>
        </div>
      </div>

      <ul className="relative mt-4 space-y-1.5">
        {items.map((it) => (
          <ItemRow key={it.key} item={it} onEdit={() => it.edit && setEditing(it.edit)} />
        ))}
      </ul>

      <AnimatePresence>
        {editing && (
          <MetricSheet
            kind={editing}
            current={editing === "steps" ? summary.steps : summary.sleep_minutes}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const size = 76, stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          className="stroke-ink-soft"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          strokeLinecap="round"
          className="stroke-brand"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * Math.min(100, pct)) / 100 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-lg font-black tabular-nums">%{pct}</span>
      </div>
    </div>
  );
}

function ItemRow({ item, onEdit }: { item: Item; onEdit: () => void }) {
  const text = item.format
    ? item.format(item.value)
    : `${item.value.toLocaleString("tr-TR")}${item.unit ? ` ${item.unit}` : ""}`;
  const goalText = item.key === "workout" ? "" : ` / ${item.goal.toLocaleString("tr-TR")}${item.unit ? ` ${item.unit}` : ""}`;

  const inner = (
    <>
      <span
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors",
          item.done ? "bg-brand text-black" : "bg-ink-soft text-fg-muted"
        )}
      >
        {item.done ? <Check size={15} /> : item.icon}
      </span>
      <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold", item.done && "text-fg-muted line-through decoration-fg-muted/40")}>
        {item.label}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-fg-muted">
        {text}
        {item.key !== "sleep" || item.value > 0 ? goalText : ""}
      </span>
      {item.edit ? (
        <Pencil size={13} className="shrink-0 text-fg-muted/70" />
      ) : (
        <ChevronRight size={15} className="shrink-0 text-fg-muted/70" />
      )}
    </>
  );

  const cls = "flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.04]";

  return (
    <li>
      {item.edit ? (
        <button onClick={onEdit} className={cls}>{inner}</button>
      ) : (
        <Link href={item.href ?? "#"} className={cls}>{inner}</Link>
      )}
    </li>
  );
}

/** Adım / uyku girişi için alt sayfa. */
function MetricSheet({
  kind, current, onClose,
}: { kind: "steps" | "sleep"; current: number; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [steps, setSteps] = React.useState(current > 0 && kind === "steps" ? String(current) : "");
  const [hours, setHours] = React.useState(kind === "sleep" && current > 0 ? String(Math.floor(current / 60)) : "");
  const [mins, setMins] = React.useState(kind === "sleep" && current > 0 ? String(current % 60) : "");

  async function submit() {
    setBusy(true); setErr(null);
    const res = await saveDailyMetric(
      kind === "steps"
        ? { steps: Number(steps) || 0 }
        : { sleepMinutes: (Number(hours) || 0) * 60 + (Number(mins) || 0) }
    );
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? "Kaydedilemedi.");
    onClose();
    router.refresh();
  }

  const valid = kind === "steps" ? steps.trim() !== "" : hours.trim() !== "" || mins.trim() !== "";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center sm:p-4"
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-ink-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-lg font-bold">{kind === "steps" ? "Bugünkü Adım" : "Dün Gece Uyku"}</p>
          <button onClick={onClose} aria-label="Kapat" className="rounded-lg p-1 text-fg-muted hover:text-fg">
            <X size={18} />
          </button>
        </div>

        {kind === "steps" ? (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-fg-muted">Adım sayısı</span>
            <input
              autoFocus type="number" inputMode="numeric" min={0} max={200000}
              value={steps} onChange={(e) => setSteps(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && valid && submit()}
              placeholder="8500" className="input w-full text-lg"
            />
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-fg-muted">Saat</span>
              <input
                autoFocus type="number" inputMode="numeric" min={0} max={24}
                value={hours} onChange={(e) => setHours(e.target.value)}
                placeholder="7" className="input w-full text-lg"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-fg-muted">Dakika</span>
              <input
                type="number" inputMode="numeric" min={0} max={59}
                value={mins} onChange={(e) => setMins(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && valid && submit()}
                placeholder="30" className="input w-full text-lg"
              />
            </label>
          </div>
        )}

        {err && <p className="mt-2 text-xs text-coral">{err}</p>}

        <button onClick={submit} disabled={busy || !valid} className="btn-primary mt-4 w-full">
          {busy ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Kaydet"}
        </button>
        <p className="mt-2 text-center text-[11px] text-fg-muted">
          Akıllı saat entegrasyonu geldiğinde bu alan otomatik dolacak.
        </p>
      </motion.div>
    </motion.div>
  );
}
