"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio, Play, LogIn, LogOut, Square, Loader2, Users, Zap, Timer, Flame, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Glass, Avatar } from "@/components/teams/shared";
import { useElapsed } from "@/lib/social/hooks";
import {
  startFriendParty, joinLiveSession, leaveLiveSession, endLiveSession,
} from "@/lib/social/actions";
import { ACTIVITIES, activityOf, estimateCalories, type ActivityKey } from "@/lib/workout/calories";
import type { FriendView, LiveSessionView } from "@/lib/social/types";

/**
 * Workout Party — arkadaşlarla eşzamanlı antrenman.
 *
 * Takım oturumundan (`TeamLiveWorkout`) farkı: takım üyeliği gerekmez, davet
 * arkadaş listesinden yapılır ve aktivite seçimi kalori tahminini belirler.
 * Kalori istemcide anlık gösterilir; kesin değer oturum bitince
 * `end_live_session()` RPC'sinde katılımcının gerçek kilosuyla hesaplanır.
 */
export function WorkoutParty({
  party, friends, meId, weightKg,
}: {
  party: LiveSessionView | null;
  friends: FriendView[];
  meId: string;
  weightKg: number | null;
}) {
  return party ? (
    <ActiveParty party={party} meId={meId} weightKg={weightKg} />
  ) : (
    <IdleParty friends={friends} />
  );
}

function IdleParty({ friends }: { friends: FriendView[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [activity, setActivity] = React.useState<ActivityKey>("strength");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function start() {
    setBusy(true); setErr(null);
    const res = await startFriendParty({ activity, friendIds: picked });
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? "Başlatılamadı.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Glass className="relative overflow-hidden p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(80% 60% at 50% 0%, rgba(163,230,53,0.10) 0%, transparent 65%)" }}
      />
      <div className="relative">
        <div className="flex items-center gap-3">
          <motion.span
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand"
          >
            <Radio size={20} />
          </motion.span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Workout Party</p>
            <p className="text-[11px] text-fg-muted">
              Arkadaşlarınla aynı anda antrenman yap, herkes bonus XP kazansın.
            </p>
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            className="btn-primary flex shrink-0 items-center gap-1.5 !px-3 !py-1.5 !text-xs"
          >
            <Play size={14} /> Başlat
          </button>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-3 border-t border-white/8 pt-4">
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
                    Aktivite
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ACTIVITIES.map((a) => (
                      <button
                        key={a.key}
                        onClick={() => setActivity(a.key)}
                        aria-pressed={activity === a.key}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
                          activity === a.key
                            ? "border-brand/50 bg-brand/15 text-brand"
                            : "border-white/10 bg-ink-soft/60 text-fg-muted hover:border-brand/40"
                        )}
                      >
                        {a.emoji} {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
                    Davet et {picked.length > 0 && `(${picked.length})`}
                  </p>
                  {friends.length === 0 ? (
                    <p className="text-xs text-fg-muted">
                      Henüz arkadaşın yok. Keşfet sekmesinden sporcu ekleyebilirsin.
                    </p>
                  ) : (
                    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                      {friends.map((f) => {
                        const on = picked.includes(f.user_id);
                        return (
                          <button
                            key={f.user_id}
                            onClick={() =>
                              setPicked((p) => (on ? p.filter((x) => x !== f.user_id) : [...p, f.user_id]))
                            }
                            aria-pressed={on}
                            className="flex w-14 shrink-0 flex-col items-center gap-1"
                          >
                            <Avatar
                              src={f.avatar_url}
                              name={f.name}
                              size={40}
                              ring={on ? "ring-2 ring-brand" : "ring-1 ring-white/10"}
                            />
                            <span className={cn("w-full truncate text-center text-[9px] font-semibold", on ? "text-brand" : "text-fg-muted")}>
                              {f.name.split(" ")[0]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button onClick={start} disabled={busy} className="btn-primary flex w-full items-center justify-center gap-2">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                  Partiyi Başlat
                </button>
                {err && <p className="text-xs text-coral">{err}</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Glass>
  );
}

function ActiveParty({
  party, meId, weightKg,
}: { party: LiveSessionView; meId: string; weightKg: number | null }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"join" | "leave" | "end" | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<number | null>(null);
  const elapsed = useElapsed(party.started_at);

  const act = activityOf(party.activity);
  const canEnd = party.host.user_id === meId;

  // Anlık kalori: geçen süre × MET × kilo. Kesin değeri oturum bitince RPC yazar.
  const minutes = Math.max(0, (Date.now() - new Date(party.started_at).getTime()) / 60000);
  const kcal = estimateCalories(minutes, weightKg, party.met ?? act.met);

  async function run(kind: "join" | "leave" | "end") {
    setBusy(kind); setErr(null);
    const res =
      kind === "join" ? await joinLiveSession(party.id)
      : kind === "leave" ? await leaveLiveSession(party.id)
      : await endLiveSession(party.id);
    setBusy(null);
    if (!res.ok) return setErr(res.error ?? "İşlem yapılamadı.");
    if (kind === "end" && "data" in res && res.data) setSummary((res.data as { totalXp: number }).totalXp);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Glass className="relative overflow-hidden border-coral/30 p-0">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(90% 70% at 20% 0%, rgba(255,107,107,0.14) 0%, transparent 60%)" }}
        />
        <div className="relative p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-coral" />
            </span>
            <p className="text-[11px] font-black uppercase tracking-widest text-coral">Canlı</p>
            <span className="ml-auto flex items-center gap-1 text-xs font-bold tabular-nums">
              <Timer size={13} className="text-fg-muted" /> {elapsed}
            </span>
          </div>

          <p className="mt-2 text-lg font-black">{party.title}</p>
          <p className="text-[11px] text-fg-muted">
            {party.host.name} başlattı ·{" "}
            {new Date(party.started_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          </p>

          {/* Anlık metrikler */}
          {party.im_in && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="flex items-center gap-1 rounded-lg bg-coral/10 px-2 py-1 text-[11px] font-bold text-coral">
                <Flame size={12} /> ~{kcal} kcal
              </span>
              <span className="flex items-center gap-1 rounded-lg bg-brand/10 px-2 py-1 text-[11px] font-bold text-brand">
                {act.emoji} {act.label} · MET {(party.met ?? act.met).toFixed(1)}
              </span>
            </div>
          )}

          {/* Katılımcılar */}
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
              <Users size={11} /> Şu anda aktif ({party.participants.length})
            </p>
            <div className="flex flex-wrap gap-2.5">
              <AnimatePresence initial={false}>
                {party.participants.map((p) => (
                  <motion.div
                    key={p.user_id}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ type: "spring", stiffness: 320, damping: 24 }}
                    className="flex w-16 flex-col items-center gap-1"
                  >
                    <span className="relative">
                      <Avatar src={p.avatar_url} name={p.name} size={44} ring="ring-2 ring-brand/60" />
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-card bg-brand" />
                    </span>
                    <span className="w-full truncate text-center text-[10px] font-semibold">
                      {p.name.split(" ")[0]}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {party.participants.length === 0 && (
                <p className="text-xs text-fg-muted">Henüz kimse katılmadı.</p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {party.im_in ? (
              <button
                onClick={() => run("leave")}
                disabled={busy !== null}
                className="flex items-center gap-1.5 rounded-xl border border-ink-border bg-ink-soft px-3.5 py-2 text-sm font-semibold text-fg-muted hover:text-coral"
              >
                {busy === "leave" ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
                Ayrıl
              </button>
            ) : (
              <button onClick={() => run("join")} disabled={busy !== null} className="btn-primary flex items-center gap-2">
                {busy === "join" ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                Katıl
              </button>
            )}
            {canEnd && (
              <button
                onClick={() => run("end")}
                disabled={busy !== null}
                className="flex items-center gap-1.5 rounded-xl border border-coral/40 bg-coral/10 px-3.5 py-2 text-sm font-semibold text-coral"
              >
                {busy === "end" ? <Loader2 size={15} className="animate-spin" /> : <Square size={14} />}
                Partiyi Bitir
              </button>
            )}
          </div>
          {err && <p className="mt-2 text-xs text-coral">{err}</p>}
        </div>
      </Glass>

      <AnimatePresence>
        {summary !== null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 rounded-2xl border border-brand/40 bg-brand/10 px-4 py-3 text-center text-sm font-bold text-brand"
          >
            <Zap size={15} /> Parti tamamlandı · toplam {summary} XP dağıtıldı 🎉
            <button onClick={() => setSummary(null)} aria-label="Kapat" className="ml-1 text-brand/70 hover:text-brand">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
