"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Target, Plus, Loader2, Check, Trash2, Gift, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Glass, compact } from "./shared";
import { createQuest, completeQuest, deleteQuest } from "@/lib/teams/actions";
import {
  QUEST_METRIC_LABEL, ROLE_RANK, type QuestMetric, type TeamHub, type TeamQuest,
} from "@/lib/teams/types";
import { useModal, modalProps } from "@/lib/a11y/use-modal";

const METRICS = Object.entries(QUEST_METRIC_LABEL) as [QuestMetric, string][];

export function TeamQuests({ hub }: { hub: TeamHub }) {
  const canManage = hub.myRole ? ROLE_RANK[hub.myRole] >= ROLE_RANK.admin : false;
  const [open, setOpen] = React.useState(false);

  const active = hub.quests.filter((q) => q.status !== "completed");
  const done = hub.quests.filter((q) => q.status === "completed");

  return (
    <div className="space-y-3">
      {canManage && (
        <button onClick={() => setOpen(true)} className="btn-primary flex w-full items-center justify-center gap-2">
          <Plus size={17} /> Takım Görevi Oluştur
        </button>
      )}

      {hub.quests.length === 0 ? (
        <Glass className="p-10 text-center">
          <Target size={26} className="mx-auto mb-2 text-fg-muted/60" />
          <p className="text-sm font-semibold">Aktif görev yok</p>
          <p className="mt-1 text-xs text-fg-muted">
            {canManage ? "Takımına ortak bir hedef koy." : "Yöneticiler yakında yeni bir hedef belirleyecek."}
          </p>
        </Glass>
      ) : (
        <>
          <div className="space-y-2.5">
            {active.map((q, i) => <QuestCard key={q.id} quest={q} index={i} canManage={canManage} />)}
          </div>
          {done.length > 0 && (
            <>
              <p className="pt-1 text-[11px] font-bold uppercase tracking-wide text-fg-muted">Tamamlananlar</p>
              <div className="space-y-2.5">
                {done.map((q, i) => <QuestCard key={q.id} quest={q} index={i} canManage={canManage} />)}
              </div>
            </>
          )}
        </>
      )}

      {open && <QuestModal teamId={hub.team.id} onClose={() => setOpen(false)} />}
    </div>
  );
}

function QuestCard({ quest, index, canManage }: { quest: TeamQuest; index: number; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const pct = Math.max(0, Math.min(1, quest.target > 0 ? quest.progress / quest.target : 0));
  const completed = quest.status === "completed";
  const reached = quest.progress >= quest.target;

  async function finish() {
    setBusy(true);
    const res = await completeQuest(quest.id);
    setBusy(false);
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  async function remove() {
    if (!confirm("Görev arşivlensin mi?")) return;
    const res = await deleteQuest(quest.id);
    if (res.ok) router.refresh();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.2) }}
    >
      <Glass className={cn("p-3.5", completed && "border-brand/35 bg-brand/5")}>
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
              completed ? "bg-brand text-black" : "bg-brand/15 text-brand"
            )}
          >
            {completed ? <Check size={17} /> : <Target size={17} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 font-bold leading-tight">{quest.title}</p>
              {canManage && !completed && (
                <button onClick={remove} aria-label="Görevi arşivle" className="shrink-0 text-fg-muted hover:text-coral">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            {quest.description && <p className="mt-0.5 text-xs text-fg-muted">{quest.description}</p>}

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-muted">
              <span className="flex items-center gap-1">
                <Gift size={11} className="text-brand" /> +{quest.reward_xp} XP (takıma)
              </span>
              {quest.ends_on && (
                <span className="flex items-center gap-1">
                  <CalendarClock size={11} />
                  {new Date(quest.ends_on).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>

            <div className="mt-2.5">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-semibold">{QUEST_METRIC_LABEL[quest.metric]}</span>
                <span className="tabular-nums text-fg-muted">
                  {compact(Math.round(quest.progress))} / {compact(quest.target)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink-soft">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct * 100}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className={cn("h-full rounded-full", completed ? "bg-brand" : "bg-gradient-to-r from-brand/70 to-brand")}
                />
              </div>
            </div>

            {canManage && !completed && reached && (
              <button onClick={finish} disabled={busy} className="btn-primary mt-2.5 !py-1.5 !text-xs">
                {busy ? <Loader2 size={13} className="mx-auto animate-spin" /> : "Görevi Tamamla ve Ödülü Ver"}
              </button>
            )}
          </div>
        </div>
      </Glass>
    </motion.div>
  );
}

function QuestModal({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [metric, setMetric] = React.useState<QuestMetric>("workouts");
  const [target, setTarget] = React.useState("100");
  const [reward, setReward] = React.useState("500");
  const [endsOn, setEndsOn] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true); setErr(null);
    const res = await createQuest(teamId, {
      title, description: desc, metric,
      target: Number(target) || 0,
      rewardXp: Number(reward) || 100,
      endsOn: endsOn || null,
    });
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? "Oluşturulamadı.");
    onClose();
    router.refresh();
  }

  const modalRef = useModal<HTMLDivElement>(true, onClose);

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        {...modalProps()}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-ink-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-5"
      >
        <p className="mb-3 text-lg font-bold">Takım Görevi</p>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Görev başlığı" className="input w-full" autoFocus />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Açıklama (isteğe bağlı)" rows={2} className="input w-full resize-none" />
          <div>
            <p className="mb-1.5 text-xs font-semibold text-fg-muted">Ölçüt</p>
            <div className="flex flex-wrap gap-1.5">
              {METRICS.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setMetric(key)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                    metric === key ? "border-brand bg-brand text-black" : "border-white/10 bg-ink-soft text-fg-muted hover:text-fg"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-fg-muted">Hedef</span>
              <input value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="input w-full" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-fg-muted">Ödül XP</span>
              <input value={reward} onChange={(e) => setReward(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="input w-full" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-fg-muted">Bitiş (isteğe bağlı)</span>
            <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className="input w-full" />
          </label>
          {err && <p className="text-xs text-coral">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 rounded-xl border border-ink-border bg-ink-soft py-2.5 text-sm font-semibold">Vazgeç</button>
            <button onClick={submit} disabled={busy || !title.trim()} className="btn-primary flex-1">
              {busy ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Oluştur"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
