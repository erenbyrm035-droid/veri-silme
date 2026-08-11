"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Lock, Check, Loader2, Sparkles, CalendarDays, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { claimSeasonTier } from "@/lib/gamification/actions";
import {
  REWARD_ICON,
  type SeasonState, type SeasonTrack, type SeasonReward,
} from "@/lib/gamification/season-types";

/**
 * Battle Pass — sezon kademesi merdiveni.
 *
 * İki şerit: ücretsiz (herkes) ve premium. Kademe kilidi SEZON XP'sine bağlı —
 * yaşam boyu XP'ye değil (bkz. migration 0045: `season_xp` artık gerçekten
 * sezon penceresindeki XP'yi tutuyor, eskiden `total_xp` kopyasıydı).
 */
export function BattlePass({ state }: { state: SeasonState }) {
  if (!state.active || !state.season) return <NoSeason />;

  const { season } = state;
  const progressPct =
    state.next_req_xp && state.next_req_xp > 0
      ? Math.min(100, Math.round((state.season_xp / state.next_req_xp) * 100))
      : 100;

  return (
    <div className="space-y-4">
      <SeasonHeader
        season={season}
        seasonXp={state.season_xp}
        tier={state.tier}
        maxTier={state.max_tier}
        nextReqXp={state.next_req_xp}
        progressPct={progressPct}
        isPremium={state.is_premium}
      />

      {!state.is_premium && (
        <Link
          href="/premium"
          className="flex items-center gap-2.5 rounded-2xl border border-[#FFD34D]/35 bg-[#FFD34D]/8 p-3.5 transition-colors hover:border-[#FFD34D]/60"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FFD34D]/15 text-[#FFD34D]">
            <Crown size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Premium şeridi kilitli</p>
            <p className="text-[11px] text-fg-muted">
              Premium&apos;a geç, her kademede ikinci ödülü de al.
            </p>
          </div>
        </Link>
      )}

      <div className="space-y-2.5">
        {state.tracks.map((t, i) => (
          <TierRow key={t.id} track={t} index={i} isPremium={state.is_premium} seasonXp={state.season_xp} />
        ))}
      </div>
    </div>
  );
}

function NoSeason() {
  return (
    <div className="rounded-2xl border border-ink-border bg-ink-card p-10 text-center">
      <motion.span
        animate={{ rotate: [0, 8, -8, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-ink-soft text-fg-muted"
      >
        <CalendarDays size={24} />
      </motion.span>
      <p className="text-sm font-semibold">Şu anda aktif sezon yok</p>
      <p className="mx-auto mt-1 max-w-xs text-xs text-fg-muted">
        Yeni sezon başladığında kademeler ve ödüller burada görünecek. Bu arada
        kazandığın XP seviyene işlemeye devam ediyor.
      </p>
    </div>
  );
}

function SeasonHeader({
  season, seasonXp, tier, maxTier, nextReqXp, progressPct, isPremium,
}: {
  season: NonNullable<SeasonState["season"]>;
  seasonXp: number; tier: number; maxTier: number;
  nextReqXp: number | null; progressPct: number; isPremium: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-card p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(85% 75% at 15% 0%, rgba(192,132,252,0.16) 0%, transparent 62%)" }}
      />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#C084FC]">
              <Sparkles size={12} /> Sezon {season.number}
              {isPremium && (
                <span className="ml-1 rounded-full bg-[#FFD34D]/20 px-1.5 py-0.5 text-[9px] text-[#FFD34D]">
                  PREMIUM
                </span>
              )}
            </p>
            <h3 className="mt-0.5 truncate text-xl font-black">{season.name}</h3>
            {season.theme && <p className="text-xs text-fg-muted">{season.theme}</p>}
          </div>
          <div className="text-right">
            <p className="text-3xl font-black leading-none tabular-nums">{tier}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-fg-muted">
              / {maxTier} kademe
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold">
            <span className="flex items-center gap-1 tabular-nums text-fg-muted">
              <Zap size={11} className="text-brand" /> {seasonXp.toLocaleString("tr-TR")} sezon XP
            </span>
            <span className="tabular-nums text-fg-muted">
              {nextReqXp !== null
                ? `Sonraki kademe: ${nextReqXp.toLocaleString("tr-TR")}`
                : "Tüm kademeler açık 🎉"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink-soft">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-brand to-[#C084FC]"
            />
          </div>
          <p className="mt-2 text-[11px] text-fg-muted">
            Sezon bitimine{" "}
            <span className="font-bold text-fg">{season.days_left} gün</span> ·{" "}
            {new Date(season.ends_on).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}
          </p>
        </div>
      </div>
    </div>
  );
}

function TierRow({
  track, index, isPremium, seasonXp,
}: { track: SeasonTrack; index: number; isPremium: boolean; seasonXp: number }) {
  const remaining = Math.max(0, track.req_xp - seasonXp);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.25) }}
      className={cn(
        "rounded-2xl border p-3 transition-colors",
        track.unlocked ? "border-brand/30 bg-ink-card" : "border-ink-border bg-ink-card/60"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-black tabular-nums",
            track.unlocked ? "bg-brand/15 text-brand" : "bg-ink-soft text-fg-muted"
          )}
        >
          {track.unlocked ? track.tier : <Lock size={15} />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold">
            Kademe {track.tier}
            <span className="ml-1.5 font-normal tabular-nums text-fg-muted">
              {track.req_xp.toLocaleString("tr-TR")} XP
            </span>
          </p>
          {!track.unlocked && (
            <p className="text-[10px] text-fg-muted tabular-nums">
              {remaining.toLocaleString("tr-TR")} XP kaldı
            </p>
          )}
        </div>
      </div>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
        <RewardSlot
          trackId={track.id}
          lane="free"
          reward={track.free_reward}
          unlocked={track.unlocked}
          claimed={track.free_claimed}
          claimable={track.free_claimable}
          locked={false}
        />
        <RewardSlot
          trackId={track.id}
          lane="premium"
          reward={track.premium_reward}
          unlocked={track.unlocked}
          claimed={track.premium_claimed}
          claimable={track.premium_claimable}
          locked={!isPremium}
        />
      </div>
    </motion.div>
  );
}

function RewardSlot({
  trackId, lane, reward, unlocked, claimed, claimable, locked,
}: {
  trackId: string;
  lane: "free" | "premium";
  reward: SeasonReward | null;
  unlocked: boolean;
  claimed: boolean;
  claimable: boolean;
  /** Premium şerit için: kullanıcı premium değil. */
  locked: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(claimed);
  const [err, setErr] = React.useState<string | null>(null);
  const [burst, setBurst] = React.useState(false);

  React.useEffect(() => setDone(claimed), [claimed]);

  if (!reward) {
    return (
      <div className="rounded-xl border border-dashed border-white/8 px-3 py-2.5 text-center text-[10px] text-fg-muted/60">
        {lane === "premium" ? "Premium ödül yok" : "Ödül yok"}
      </div>
    );
  }

  async function claim() {
    if (busy || done || !claimable) return;
    setBusy(true); setErr(null);
    const res = await claimSeasonTier(trackId, lane);
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? "Alınamadı.");
    setDone(true);
    setBurst(true);
    setTimeout(() => setBurst(false), 900);
  }

  const isPremiumLane = lane === "premium";
  const accent = isPremiumLane ? "#FFD34D" : "#A3E635";

  return (
    <div className="relative">
      <button
        onClick={claim}
        disabled={!claimable || busy || done}
        aria-label={`${reward.label} — ${isPremiumLane ? "Premium" : "Ücretsiz"} şerit`}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all",
          done
            ? "border-white/8 bg-ink-soft/40 opacity-60"
            : claimable
              ? "border-current bg-current/10 hover:brightness-125 active:scale-[0.98]"
              : "border-white/8 bg-ink-soft/40 opacity-70 cursor-default"
        )}
        style={claimable && !done ? { color: accent } : undefined}
      >
        <span className="text-lg leading-none">{reward.icon ?? REWARD_ICON[reward.type]}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-bold text-fg">{reward.label}</span>
          <span className="block text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
            {isPremiumLane ? "Premium" : "Ücretsiz"}
          </span>
        </span>
        <span className="shrink-0">
          {busy ? <Loader2 size={14} className="animate-spin text-fg-muted" />
            : done ? <Check size={14} className="text-brand" />
            : locked ? <Crown size={13} className="text-[#FFD34D]" />
            : !unlocked ? <Lock size={12} className="text-fg-muted" />
            : <span className="text-[10px] font-black" style={{ color: accent }}>AL</span>}
        </span>
      </button>

      <AnimatePresence>
        {burst && (
          <motion.span
            initial={{ opacity: 0, scale: 0.5, y: 6 }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 1.8], y: -28 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            className="pointer-events-none absolute left-3 top-1 z-10 text-xl"
          >
            {reward.icon ?? REWARD_ICON[reward.type]}
          </motion.span>
        )}
      </AnimatePresence>

      {err && <p className="mt-1 px-1 text-[10px] text-coral">{err}</p>}
    </div>
  );
}
