"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, Plus, Loader2, MapPin, Users, Check, Radio, Swords, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";
import { Glass } from "./shared";
import { createEvent, toggleEventJoin } from "@/lib/teams/actions";
import { EVENT_KIND_LABEL, ROLE_RANK, type EventKind, type TeamEvent, type TeamHub } from "@/lib/teams/types";
import { useModal, modalProps } from "@/lib/a11y/use-modal";

const KIND_ICON: Record<EventKind, React.ReactNode> = {
  challenge: <Swords size={16} />,
  meetup: <Coffee size={16} />,
  live: <Radio size={16} />,
  monthly: <CalendarDays size={16} />,
};

const KINDS = Object.entries(EVENT_KIND_LABEL) as [EventKind, string][];

export function TeamEvents({ hub }: { hub: TeamHub }) {
  const canManage = hub.myRole ? ROLE_RANK[hub.myRole] >= ROLE_RANK.moderator : false;
  const isMember = !!hub.myRole;
  const [open, setOpen] = React.useState(false);

  const now = Date.now();
  const upcoming = hub.events.filter((e) => new Date(e.ends_at ?? e.starts_at).getTime() >= now);
  const past = hub.events.filter((e) => new Date(e.ends_at ?? e.starts_at).getTime() < now);

  return (
    <div className="space-y-3">
      {canManage && (
        <button onClick={() => setOpen(true)} className="btn-primary flex w-full items-center justify-center gap-2">
          <Plus size={17} /> Etkinlik Oluştur
        </button>
      )}

      {hub.events.length === 0 ? (
        <Glass className="p-10 text-center">
          <CalendarDays size={26} className="mx-auto mb-2 text-fg-muted/60" />
          <p className="text-sm font-semibold">Planlanmış etkinlik yok</p>
          <p className="mt-1 text-xs text-fg-muted">
            {canManage ? "Haftalık meydan okuma veya grup antrenmanı planla." : "Yöneticiler yakında bir etkinlik açacak."}
          </p>
        </Glass>
      ) : (
        <>
          <div className="space-y-2.5">
            {upcoming.map((e, i) => <EventCard key={e.id} event={e} index={i} isMember={isMember} />)}
          </div>
          {past.length > 0 && (
            <>
              <p className="pt-1 text-[11px] font-bold uppercase tracking-wide text-fg-muted">Geçmiş</p>
              <div className="space-y-2.5 opacity-60">
                {past.map((e, i) => <EventCard key={e.id} event={e} index={i} isMember={false} />)}
              </div>
            </>
          )}
        </>
      )}

      {open && <EventModal teamId={hub.team.id} onClose={() => setOpen(false)} />}
    </div>
  );
}

function EventCard({ event, index, isMember }: { event: TeamEvent; index: number; isMember: boolean }) {
  const router = useRouter();
  const [going, setGoing] = React.useState(event.im_going);
  const [count, setCount] = React.useState(event.participants);
  const [busy, setBusy] = React.useState(false);

  async function toggle() {
    if (!isMember || busy) return;
    setBusy(true);
    const next = !going;
    setGoing(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    const res = await toggleEventJoin(event.id);
    setBusy(false);
    if (!res.ok) { setGoing(event.im_going); setCount(event.participants); }
    else router.refresh();
  }

  const start = new Date(event.starts_at);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.2) }}
    >
      <Glass className="p-3.5">
        <div className="flex items-start gap-3">
          <div className="grid w-12 shrink-0 place-items-center rounded-xl border border-white/10 bg-ink-soft/70 py-1.5">
            <span className="text-[10px] font-bold uppercase text-brand">
              {start.toLocaleDateString("tr-TR", { month: "short" })}
            </span>
            <span className="text-lg font-black leading-none tabular-nums">{start.getDate()}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                {KIND_ICON[event.kind]} {EVENT_KIND_LABEL[event.kind]}
              </span>
            </div>
            <p className="mt-1 font-bold leading-tight">{event.title}</p>
            {event.description && <p className="mt-0.5 text-xs text-fg-muted">{event.description}</p>}

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-muted">
              <span className="tabular-nums">
                {start.toLocaleString("tr-TR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
              {event.location && (
                <span className="flex items-center gap-1"><MapPin size={11} /> {event.location}</span>
              )}
              <span className="flex items-center gap-1"><Users size={11} /> {count} katılımcı</span>
            </div>

            {isMember && (
              <button
                onClick={toggle}
                disabled={busy}
                className={cn(
                  "mt-2.5 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
                  going
                    ? "border-brand bg-brand text-black"
                    : "border-white/10 bg-ink-soft text-fg-muted hover:border-brand/40 hover:text-fg"
                )}
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : going ? <Check size={13} /> : <Users size={13} />}
                {going ? "Katılıyorsun" : "Katılacağım"}
              </button>
            )}
          </div>
        </div>
      </Glass>
    </motion.div>
  );
}

function EventModal({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [kind, setKind] = React.useState<EventKind>("challenge");
  const [startsAt, setStartsAt] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function submit() {
    if (!startsAt) return setErr("Başlangıç tarihi gerekli.");
    setBusy(true); setErr(null);
    const res = await createEvent(teamId, {
      title, description: desc, kind,
      startsAt: new Date(startsAt).toISOString(),
      location,
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
        <p className="mb-3 text-lg font-bold">Takım Etkinliği</p>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Etkinlik adı" className="input w-full" autoFocus />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Açıklama (isteğe bağlı)" rows={2} className="input w-full resize-none" />
          <div>
            <p className="mb-1.5 text-xs font-semibold text-fg-muted">Tür</p>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setKind(key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                    kind === key ? "border-brand bg-brand text-black" : "border-white/10 bg-ink-soft text-fg-muted hover:text-fg"
                  )}
                >
                  {KIND_ICON[key]} {label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-fg-muted">Başlangıç</span>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="input w-full" />
          </label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Konum (isteğe bağlı)" className="input w-full" />
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
