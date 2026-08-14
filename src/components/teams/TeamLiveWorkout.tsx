"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Play, LogIn, LogOut, Square, Loader2, Users, Zap, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Glass, Avatar } from "./shared";
import { useElapsed } from "@/lib/social/hooks";
import { startLiveSession, joinLiveSession, leaveLiveSession, endLiveSession } from "@/lib/social/actions";
import type { LiveSessionView } from "@/lib/social/types";
import type { TeamHub } from "@/lib/teams/types";
import { ROLE_RANK } from "@/lib/teams/types";

/** Birlikte antrenman — canlı oturum başlat, katıl, bitir. */
export function TeamLiveWorkout({ hub }: { hub: TeamHub }) {
  const { live, myRole, meId, team } = hub;
  const isMember = !!myRole;
  const canEnd =
    !!live && (live.host.user_id === meId || (myRole ? ROLE_RANK[myRole] >= ROLE_RANK.moderator : false));

  if (!isMember) {
    return (
      <Glass className="p-10 text-center">
        <Radio size={26} className="mx-auto mb-2 text-fg-muted/60" />
        <p className="text-sm font-semibold">Birlikte antrenman üyelere özel</p>
        <p className="mt-1 text-xs text-fg-muted">Takıma katıl, arkadaşlarınla aynı anda antrenman yap.</p>
      </Glass>
    );
  }

  return live ? (
    <ActiveSession session={live} canEnd={canEnd} />
  ) : (
    <IdleState teamId={team.id} />
  );
}

function IdleState({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function start() {
    setBusy(true); setErr(null);
    const res = await startLiveSession(teamId);
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? "Başlatılamadı.");
    router.refresh();
  }

  return (
    <Glass className="relative overflow-hidden p-8 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(80% 60% at 50% 0%, rgba(163,230,53,0.10) 0%, transparent 65%)" }}
      />
      <div className="relative">
        <motion.span
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-brand/15 text-brand"
        >
          <Radio size={26} />
        </motion.span>
        <p className="text-base font-bold">Şu anda aktif antrenman yok</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-fg-muted">
          Oturumu sen başlat; takımdaki herkese bildirim gider, katılan herkes bonus XP kazanır.
        </p>
        <button onClick={start} disabled={busy} className="btn-primary mx-auto mt-4 flex items-center gap-2">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Birlikte Antrenmanı Başlat
        </button>
        {err && <p className="mt-2 text-xs text-coral">{err}</p>}
      </div>
    </Glass>
  );
}

function ActiveSession({
  session, canEnd,
}: { session: LiveSessionView; canEnd: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"join" | "leave" | "end" | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<number | null>(null);
  const elapsed = useElapsed(session.started_at);

  async function run(kind: "join" | "leave" | "end") {
    setBusy(kind); setErr(null);
    const res =
      kind === "join" ? await joinLiveSession(session.id)
      : kind === "leave" ? await leaveLiveSession(session.id)
      : await endLiveSession(session.id);
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

          <p className="mt-2 text-lg font-black">{session.title}</p>
          <p className="text-[11px] text-fg-muted">
            {session.host.name} başlattı ·{" "}
            {new Date(session.started_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          </p>

          {/* Katılımcılar */}
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
              <Users size={11} /> Şu anda aktif ({session.participants.length})
            </p>
            <div className="flex flex-wrap gap-2.5">
              <AnimatePresence initial={false}>
                {session.participants.map((p) => (
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
              {session.participants.length === 0 && (
                <p className="text-xs text-fg-muted">Henüz kimse katılmadı.</p>
              )}
            </div>
          </div>

          {/* Aksiyonlar */}
          <div className="mt-4 flex flex-wrap gap-2">
            {session.im_in ? (
              <button
                onClick={() => run("leave")}
                disabled={busy !== null}
                className="flex items-center gap-1.5 rounded-xl border border-ink-border bg-ink-soft px-3.5 py-2 text-sm font-semibold text-fg-muted hover:text-coral"
              >
                {busy === "leave" ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
                Antrenmandan Ayrıl
              </button>
            ) : (
              <button onClick={() => run("join")} disabled={busy !== null} className="btn-primary flex items-center gap-2">
                {busy === "join" ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                Antrenmana Katıl
              </button>
            )}
            {canEnd && (
              <button
                onClick={() => run("end")}
                disabled={busy !== null}
                className="flex items-center gap-1.5 rounded-xl border border-coral/40 bg-coral/10 px-3.5 py-2 text-sm font-semibold text-coral"
              >
                {busy === "end" ? <Loader2 size={15} className="animate-spin" /> : <Square size={14} />}
                Oturumu Bitir
              </button>
            )}
          </div>
          {err && <p className="mt-2 text-xs text-coral">{err}</p>}
        </div>
      </Glass>

      {/* Bonus bilgisi */}
      <Glass className="flex items-start gap-2.5 p-3.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
          <Zap size={15} />
        </span>
        <p className="text-xs leading-relaxed text-fg-muted">
          Oturum bittiğinde katılan herkes <span className="font-bold text-fg">bonus XP</span> kazanır —
          taban 25 XP, katılan her ek kişi için +3 XP. Sonuç otomatik olarak takım akışına düşer.
        </p>
      </Glass>

      <AnimatePresence>
        {summary !== null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn("rounded-2xl border border-brand/40 bg-brand/10 px-4 py-3 text-center text-sm font-bold text-brand")}
          >
            Oturum tamamlandı · takıma {summary} XP eklendi 🎉
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
