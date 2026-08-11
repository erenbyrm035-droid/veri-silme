"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Loader2, Check, X, Trophy, Clock, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Glass, compact } from "./shared";
import { SmartImage } from "@/components/ui/SmartImage";
import { challengeTeam, respondBattle } from "@/lib/teams/actions";
import {
  BATTLE_METRIC_LABEL, ROLE_RANK,
  type BattleView, type BattleMetric, type Opponent, type TeamRole,
} from "@/lib/teams/types";

const METRICS: { value: BattleMetric; label: string; emoji: string }[] = [
  { value: "xp", label: "XP", emoji: "⚡" },
  { value: "workouts", label: "Antrenman", emoji: "🏋️" },
  { value: "minutes", label: "Dakika", emoji: "⏱️" },
  { value: "volume_kg", label: "Hacim", emoji: "💪" },
  { value: "steps", label: "Adım", emoji: "🏃" },
];

const DURATIONS = [3, 7, 14] as const;

/** Takım savaşları — aktif savaş, bekleyen davetler ve geçmiş. */
export function TeamBattles({
  teamId, battles, opponents, myRole,
}: {
  teamId: string;
  battles: BattleView[];
  opponents: Opponent[];
  myRole: TeamRole | null;
}) {
  const canManage = myRole ? ROLE_RANK[myRole] >= ROLE_RANK.admin : false;

  const live = battles.filter((b) => b.status === "active");
  const pending = battles.filter((b) => b.status === "pending");
  const past = battles.filter((b) => b.status === "finished" || b.status === "declined");

  return (
    <div className="space-y-3">
      {canManage && <Challenge teamId={teamId} opponents={opponents} busyIds={battles.map((b) => b.them.id)} />}

      {live.length === 0 && pending.length === 0 && past.length === 0 && (
        <Glass className="p-10 text-center">
          <motion.span
            animate={{ rotate: [0, -12, 12, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-ink-soft/70 text-fg-muted"
          >
            <Swords size={24} />
          </motion.span>
          <p className="text-sm font-semibold">Henüz savaş yok</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-fg-muted">
            {canManage
              ? "Başka bir takıma meydan oku; belirlenen sürede hangi takımın daha çok kazandığı yarışsın."
              : "Takım yöneticiniz başka bir takıma meydan okuyabilir."}
          </p>
        </Glass>
      )}

      {pending.map((b) => (
        <PendingCard key={b.id} battle={b} canManage={canManage} />
      ))}
      {live.map((b) => (
        <BattleCard key={b.id} battle={b} />
      ))}
      {past.length > 0 && (
        <>
          <p className="px-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-fg-muted">Geçmiş</p>
          {past.map((b) => <BattleCard key={b.id} battle={b} />)}
        </>
      )}
    </div>
  );
}

function Challenge({
  teamId, opponents, busyIds,
}: { teamId: string; opponents: Opponent[]; busyIds: string[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [opponent, setOpponent] = React.useState<string | null>(null);
  const [metric, setMetric] = React.useState<BattleMetric>("xp");
  const [days, setDays] = React.useState<number>(7);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Zaten savaşta olduğumuz takımlar listelenmez — sunucu da reddederdi.
  const list = React.useMemo(
    () => opponents.filter((o) => !busyIds.includes(o.id)),
    [opponents, busyIds]
  );

  async function submit() {
    if (!opponent || busy) return;
    setBusy(true); setErr(null);
    const res = await challengeTeam({ teamId, opponentId: opponent, metric, days });
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? "Savaş açılamadı.");
    setOpen(false); setOpponent(null);
    router.refresh();
  }

  return (
    <Glass className="p-3.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 text-left"
        aria-expanded={open}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-coral/15 text-coral">
          <Swords size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Meydan oku</span>
          <span className="block text-[11px] text-fg-muted">
            Bir takım seç, metrik ve süre belirle.
          </span>
        </span>
        {open ? <Minus size={16} className="text-fg-muted" /> : <Plus size={16} className="text-fg-muted" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="mt-3.5 space-y-3 border-t border-white/8 pt-3.5">
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">Rakip</p>
                {list.length === 0 ? (
                  <p className="text-xs text-fg-muted">Uygun rakip takım yok.</p>
                ) : (
                  <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                    {list.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => setOpponent(o.id === opponent ? null : o.id)}
                        aria-pressed={o.id === opponent}
                        className={cn(
                          "flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl border p-1.5 transition-colors",
                          o.id === opponent ? "border-coral/60 bg-coral/10" : "border-white/8 hover:border-white/20"
                        )}
                      >
                        <span
                          className="grid h-9 w-9 place-items-center rounded-lg text-sm font-black"
                          style={{ background: `${o.color ?? "#A3E635"}22`, color: o.color ?? "#A3E635" }}
                        >
                          {o.badge ?? o.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="w-full truncate text-center text-[9px] font-semibold">{o.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">Metrik</p>
                <div className="flex flex-wrap gap-1.5">
                  {METRICS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMetric(m.value)}
                      aria-pressed={metric === m.value}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
                        metric === m.value
                          ? "border-coral/50 bg-coral/15 text-coral"
                          : "border-white/10 bg-ink-soft/60 text-fg-muted hover:border-coral/40"
                      )}
                    >
                      {m.emoji} {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">Süre</p>
                <div className="flex gap-1.5">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDays(d)}
                      aria-pressed={days === d}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors",
                        days === d
                          ? "border-coral/50 bg-coral/15 text-coral"
                          : "border-white/10 bg-ink-soft/60 text-fg-muted hover:border-coral/40"
                      )}
                    >
                      {d} gün
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={submit}
                disabled={!opponent || busy}
                className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-40"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Swords size={16} />}
                Meydan Oku
              </button>
              {err && <p className="text-xs text-coral">{err}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Glass>
  );
}

function PendingCard({ battle, canManage }: { battle: BattleView; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"yes" | "no" | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  async function decide(accept: boolean) {
    setBusy(accept ? "yes" : "no"); setErr(null);
    const res = await respondBattle(battle.id, accept);
    setBusy(null);
    if (!res.ok) return setErr(res.error ?? "İşlem yapılamadı.");
    router.refresh();
  }

  const days = Math.max(
    1,
    Math.round((new Date(battle.ends_at).getTime() - new Date(battle.starts_at).getTime()) / 86_400_000)
  );

  return (
    <Glass className="border-[#FFD34D]/30 p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FFD34D]/15 text-[#FFD34D]">
          <Clock size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            {battle.is_challenger ? "Davet gönderildi" : "Savaş daveti"}
          </p>
          <p className="text-[11px] text-fg-muted">
            {battle.them.name} · {BATTLE_METRIC_LABEL[battle.metric]} · {days} gün
          </p>
        </div>
      </div>

      {!battle.is_challenger && canManage && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => decide(true)}
            disabled={busy !== null}
            className="btn-primary flex flex-1 items-center justify-center gap-1.5 !py-2 !text-xs"
          >
            {busy === "yes" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Kabul Et
          </button>
          <button
            onClick={() => decide(false)}
            disabled={busy !== null}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ink-border bg-ink-soft py-2 text-xs font-semibold text-fg-muted hover:text-coral"
          >
            {busy === "no" ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
            Reddet
          </button>
        </div>
      )}
      {battle.is_challenger && (
        <p className="mt-2 text-[11px] text-fg-muted">
          Rakip takımın yanıtı bekleniyor. Kabul edilince skor sayılmaya başlar.
        </p>
      )}
      {err && <p className="mt-1.5 text-xs text-coral">{err}</p>}
    </Glass>
  );
}

function BattleCard({ battle }: { battle: BattleView }) {
  const total = battle.us.score + battle.them.score;
  const usPct = total > 0 ? Math.round((battle.us.score / total) * 100) : 50;
  const isLive = battle.status === "active";
  const declined = battle.status === "declined";

  const left = isLive
    ? Math.max(0, Math.ceil((new Date(battle.ends_at).getTime() - Date.now()) / 3_600_000))
    : 0;

  return (
    <Glass
      className={cn(
        "relative overflow-hidden p-4",
        isLive && "border-coral/30",
        battle.we_won === true && "border-brand/40",
        declined && "opacity-60"
      )}
    >
      {isLive && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(90% 70% at 50% 0%, rgba(255,107,107,0.10) 0%, transparent 60%)" }}
        />
      )}
      <div className="relative">
        <div className="flex items-center justify-center gap-1.5">
          {isLive ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-coral" />
              </span>
              <p className="text-[10px] font-black uppercase tracking-widest text-coral">
                Canlı · {left < 24 ? `${left} saat` : `${Math.ceil(left / 24)} gün`} kaldı
              </p>
            </>
          ) : declined ? (
            <p className="text-[10px] font-black uppercase tracking-widest text-fg-muted">Reddedildi</p>
          ) : (
            <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-fg-muted">
              <Trophy size={11} className={battle.we_won ? "text-[#FFD34D]" : undefined} />
              {battle.we_won === true ? "Kazandık" : battle.we_won === false ? "Kaybettik" : "Berabere"}
            </p>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Side side={battle.us} label="Biz" align="left" />
          <div className="shrink-0 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-fg-muted">
              {BATTLE_METRIC_LABEL[battle.metric]}
            </p>
            <p className="text-xs font-black text-fg-muted">VS</p>
          </div>
          <Side side={battle.them} label={battle.them.name} align="right" />
        </div>

        {/* Skor çubuğu — iki takımın oranı */}
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-ink-soft">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${usPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full bg-brand"
          />
          <div className="h-full flex-1 bg-coral/70" />
        </div>
        <div className="mt-1 flex justify-between text-[10px] font-bold tabular-nums">
          <span className="text-brand">{compact(battle.us.score)}</span>
          <span className="text-coral">{compact(battle.them.score)}</span>
        </div>
      </div>
    </Glass>
  );
}

function Side({ side, label, align }: { side: BattleView["us"]; label: string; align: "left" | "right" }) {
  const content = (
    <>
      <span
        className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl text-sm font-black"
        style={{ background: `${side.color ?? "#A3E635"}22`, color: side.color ?? "#A3E635" }}
      >
        {side.logo_url ? (
<SmartImage src={side.logo_url} alt={side.name} width={40} height={40} className="h-full w-full object-cover" />
        ) : (
          side.badge ?? side.name.charAt(0).toUpperCase()
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-xs font-bold", align === "right" && "text-right")}>
          {label}
        </span>
        <span className={cn("block text-lg font-black leading-tight tabular-nums", align === "right" && "text-right")}>
          {compact(side.score)}
        </span>
      </span>
    </>
  );

  const inner = align === "right" ? (
    <div className="flex min-w-0 flex-1 flex-row-reverse items-center gap-2">{content}</div>
  ) : (
    <div className="flex min-w-0 flex-1 items-center gap-2">{content}</div>
  );

  return side.slug ? <Link href={`/teams/${side.slug}`} className="min-w-0 flex-1">{inner}</Link> : inner;
}
