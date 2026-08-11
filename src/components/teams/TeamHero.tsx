"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, Shield, Users, Trophy, Radio, UserPlus, LogOut, Loader2, Sparkles, MapPin, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Glass, Avatar, compact } from "./shared";
import { teamXpForLevel, teamLevelProgress, type TeamHub } from "@/lib/teams/types";
import { SmartImage } from "@/components/ui/SmartImage";

/** Takım ana kartı — banner, logo, kimlik, seviye barı, aksiyonlar. */
export function TeamHero({
  hub, canManage, busy, message, onJoin, onLeave, onInvite,
}: {
  hub: TeamHub;
  canManage: boolean;
  busy: boolean;
  message: string | null;
  onJoin: () => void;
  onLeave: () => void;
  onInvite: () => void;
}) {
  const { team, stats, pulse, myRole } = hub;
  const isMember = !!myRole;
  const progress = teamLevelProgress(stats.total_xp, stats.level);
  const curXp = teamXpForLevel(stats.level);
  const nextXp = teamXpForLevel(stats.level + 1);
  const accent = team.color ?? "#A3E635";

  const created = new Date(team.created_at).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

  return (
    <Glass className="relative overflow-hidden p-0">
      {/* Banner */}
      <div className="relative h-32 sm:h-44">
        {team.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <SmartImage src={team.cover_url} alt="" fill sizes="100vw" priority className="object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                `radial-gradient(120% 100% at 20% 0%, ${accent}38 0%, transparent 60%),` +
                `radial-gradient(90% 90% at 90% 20%, ${accent}22 0%, transparent 65%)`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-card via-ink-card/50 to-transparent" />

        {/* Rozetler */}
        <div className="absolute right-3 top-3 flex flex-wrap items-center justify-end gap-1.5">
          {pulse.online_now > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-brand/40 bg-black/45 px-2.5 py-1 text-[11px] font-bold text-brand backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
              {pulse.online_now} çevrimiçi
            </span>
          )}
          <span className="flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[11px] font-bold backdrop-blur">
            <Trophy size={11} className="text-[#FFD34D]" /> #{team.rank || "—"}
          </span>
          <span className="rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[11px] font-bold backdrop-blur">
            Sv {stats.level}
          </span>
        </div>
      </div>

      <div className="-mt-11 px-4 pb-4 sm:px-5">
        {/* Kimlik */}
        <div className="flex items-end gap-3">
          <div className="relative">
            <Avatar src={team.logo_url} name={team.name} size={80} className="text-3xl" ring="ring-4 ring-ink-card" />
            <span
              className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-ink-card text-[11px] font-black text-black"
              style={{ background: accent }}
            >
              {stats.level}
            </span>
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="truncate text-xl font-black leading-tight sm:text-2xl">{team.name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-fg-muted">
              <span className="flex items-center gap-1">
                <Users size={11} /> {team.member_count}/{team.member_limit}
              </span>
              {team.city && <span className="flex items-center gap-1"><MapPin size={11} /> {team.city}</span>}
              <span className="flex items-center gap-1"><CalendarDays size={11} /> {created}</span>
            </div>
          </div>
        </div>

        {team.description && (
          <p className="mt-3 text-sm leading-relaxed text-fg-muted">{team.description}</p>
        )}

        {/* Seviye barı */}
        <div className="mt-3.5">
          <div className="mb-1.5 flex items-end justify-between">
            <span className="text-xs font-bold">
              Seviye {stats.level}
              <span className="ml-1.5 font-medium text-fg-muted">→ {stats.level + 1}</span>
            </span>
            <span className="text-[11px] tabular-nums text-fg-muted">
              {compact(Math.max(0, stats.total_xp - curXp))} / {compact(Math.max(1, nextXp - curXp))} XP
            </span>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-ink-soft">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              className="relative h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${accent}99, ${accent})` }}
            >
              <motion.span
                aria-hidden
                animate={{ x: ["-100%", "400%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "linear", repeatDelay: 1.2 }}
                className="absolute inset-y-0 w-1/4 bg-white/30 blur-[2px]"
              />
            </motion.div>
          </div>
        </div>

        {/* Kurucu + yöneticiler */}
        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          {hub.owner && (
            <span className="flex items-center gap-1.5">
              <Crown size={13} className="text-[#FFD34D]" />
              <Avatar src={hub.owner.avatar_url} name={hub.owner.name} size={20} />
              <span className="font-semibold">{hub.owner.name}</span>
              <span className="text-fg-muted">· Kurucu</span>
            </span>
          )}
          {hub.admins.length > 0 && (
            <span className="flex items-center gap-1.5 text-fg-muted">
              <Shield size={13} className="text-brand" />
              <span className="flex -space-x-1.5">
                {hub.admins.slice(0, 4).map((a) => (
                  <Avatar key={a.user_id} src={a.avatar_url} name={a.name} size={20} ring="ring-2 ring-ink-card" />
                ))}
              </span>
              {hub.admins.length > 4 && <span>+{hub.admins.length - 4}</span>}
              <span>yönetici</span>
            </span>
          )}
        </div>

        {/* Aksiyonlar */}
        <div className="mt-4 flex flex-wrap gap-2">
          {!isMember ? (
            <button onClick={onJoin} disabled={busy} className="btn-primary flex items-center gap-2">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {team.join_policy === "open" ? "Takıma Katıl" : "Katılma İsteği Gönder"}
            </button>
          ) : (
            <>
              {canManage && (
                <button onClick={onInvite} className="btn-primary flex items-center gap-2">
                  <UserPlus size={16} /> Davet Et
                </button>
              )}
              <button
                onClick={onLeave}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-xl border border-ink-border bg-ink-soft px-3.5 py-2 text-sm font-semibold text-fg-muted transition-colors hover:text-coral"
              >
                <LogOut size={15} /> Ayrıl
              </button>
            </>
          )}
        </div>
        {message && <p className="mt-2 text-xs text-brand">{message}</p>}
      </div>
    </Glass>
  );
}

/**
 * Seviye atlama kutlaması. Takım seviyesi değiştiğinde bir kez gösterilir;
 * hangi seviyenin kutlandığı localStorage'da tutulur.
 */
export function LevelUpCelebration({ teamId, level }: { teamId: string; level: number }) {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || level < 2) return;
    const key = `viva_team_level_${teamId}`;
    const seen = Number(window.localStorage.getItem(key) ?? "0");
    if (seen === 0) { window.localStorage.setItem(key, String(level)); return; }
    if (level > seen) {
      window.localStorage.setItem(key, String(level));
      setShow(true);
      const t = setTimeout(() => setShow(false), 4200);
      return () => clearTimeout(t);
    }
  }, [teamId, level]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShow(false)}
          className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-6 backdrop-blur-sm"
        >
          {/* Işık huzmesi */}
          <motion.div
            aria-hidden
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1.6, opacity: [0, 0.55, 0] }}
            transition={{ duration: 2.2, ease: "easeOut" }}
            className="pointer-events-none absolute h-72 w-72 rounded-full bg-brand blur-[90px]"
          />

          <motion.div
            initial={{ scale: 0.7, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="relative z-10 text-center"
          >
            <motion.div
              animate={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 0.9, repeat: 2 }}
              className="mx-auto grid h-24 w-24 place-items-center rounded-3xl bg-brand text-4xl font-black text-black shadow-[0_0_60px_-10px_rgb(var(--brand))]"
            >
              {level}
            </motion.div>
            <p className="mt-4 text-2xl font-black">Takım seviye atladı!</p>
            <p className="mt-1 text-sm text-fg-muted">Artık {level}. seviyedesiniz. Yeni rozetlerin kilidi açıldı.</p>
            <div className="mt-3 flex items-center justify-center gap-1.5 text-brand">
              <Sparkles size={16} />
              <span className="text-xs font-bold uppercase tracking-wide">Tebrikler</span>
              <Sparkles size={16} />
            </div>
          </motion.div>

          {/* Konfeti */}
          {Array.from({ length: 18 }).map((_, i) => (
            <motion.span
              key={i}
              aria-hidden
              initial={{ opacity: 0, y: 0, x: 0, scale: 0.6 }}
              animate={{
                opacity: [0, 1, 0],
                y: [0, -140 - Math.random() * 160],
                x: [(Math.random() - 0.5) * 60, (Math.random() - 0.5) * 320],
                rotate: Math.random() * 540,
              }}
              transition={{ duration: 1.8 + Math.random(), delay: Math.random() * 0.5, ease: "easeOut" }}
              className={cn(
                "pointer-events-none absolute h-2 w-2 rounded-[2px]",
                i % 3 === 0 ? "bg-brand" : i % 3 === 1 ? "bg-[#FFD34D]" : "bg-white"
              )}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Canlı antrenman uyarı şeridi. */
export function LiveBanner({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onOpen}
      className="flex w-full items-center gap-2.5 rounded-2xl border border-coral/40 bg-coral/10 px-3.5 py-2.5 text-left transition-colors hover:bg-coral/15"
    >
      <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-coral/20 text-coral">
        <Radio size={15} />
        <span className="absolute inset-0 animate-ping rounded-full bg-coral/25" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">Şu anda birlikte antrenman var</span>
        <span className="block text-[11px] text-fg-muted">{count} kişi antrenmanda · katılmak için dokun</span>
      </span>
    </motion.button>
  );
}
