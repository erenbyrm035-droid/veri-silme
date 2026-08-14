"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Crown, Plus, LogOut, ChevronDown, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import { createTeam, joinTeam, leaveTeam, teamRoster } from "@/lib/gamification/actions";
import type { TeamView, TeamRosterMember } from "@/lib/gamification/queries";
import { SmartImage } from "@/components/ui/SmartImage";
import { Empty } from "./shared";

export function TeamsTab({ teams }: { teams: { teams: TeamView[]; myTeamId: string | null } }) {
  const [list, setList] = React.useState(teams.teams);
  const [myTeam, setMyTeam] = React.useState(teams.myTeamId);
  const [name, setName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  function refreshLocal(teamId: string, joined: boolean) {
    setMyTeam(joined ? teamId : null);
    setList((l) => l.map((t) => ({ ...t, is_member: t.id === teamId ? joined : (joined ? false : t.is_member), member_count: t.id === teamId ? t.member_count + (joined ? 1 : -1) : t.member_count })));
  }

  function onJoin(t: TeamView) { start(async () => { const r = await joinTeam(t.id); if (r.ok) refreshLocal(t.id, true); }); }
  function onLeave(t: TeamView) { start(async () => { const r = await leaveTeam(t.id); if (r.ok) refreshLocal(t.id, false); }); }
  function onCreate() {
    setMsg(null);
    start(async () => {
      const r = await createTeam(name);
      if (!r.ok) return setMsg(r.error ?? "Oluşturulamadı.");
      setName(""); setCreating(false); setMsg("Takım oluşturuldu! Sayfayı yenileyerek görebilirsin.");
    });
  }

  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [rosters, setRosters] = React.useState<Record<string, TeamRosterMember[]>>({});
  const [loadingRoster, setLoadingRoster] = React.useState<string | null>(null);

  function toggleExpand(teamId: string) {
    if (expanded === teamId) { setExpanded(null); return; }
    setExpanded(teamId);
    if (!rosters[teamId]) {
      setLoadingRoster(teamId);
      teamRoster(teamId).then((r) => {
        if (r.ok && r.data) setRosters((m) => ({ ...m, [teamId]: r.data! }));
        setLoadingRoster(null);
      });
    }
  }

  const rankStyle = (rank: number) =>
    rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-300" : rank === 3 ? "text-amber-600" : "text-fg-muted";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Takımlar <span className="text-fg-muted">· puan = üyelerin XP toplamı</span></h3>
        {!myTeam && (
          <button onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-bold text-black">
            <Plus size={14} /> Takım Oluştur
          </button>
        )}
      </div>
      {creating && (
        <div className="flex gap-2 rounded-2xl border border-ink-border bg-ink-card p-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Takım adı"
            className="flex-1 rounded-xl border border-ink-border bg-ink-soft px-3 py-2 text-sm outline-none focus:border-brand" />
          <button onClick={onCreate} disabled={pending} className="rounded-xl bg-brand px-3 py-2 text-xs font-bold text-black">Oluştur</button>
        </div>
      )}
      {msg && <p className="rounded-xl bg-brand/10 px-3 py-2 text-sm text-brand">{msg}</p>}
      {list.length === 0 && <Empty icon={Users} text="Henüz takım yok. İlk takımı sen oluştur!" />}
      <div className="space-y-2">
        {list.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className={cn("overflow-hidden rounded-2xl border bg-ink-card", t.is_member ? "border-brand/40" : "border-ink-border")}>
            <div className="flex items-center gap-3 p-4">
              <div className="flex w-6 shrink-0 items-center justify-center">
                {t.rank <= 3 ? <Medal size={18} className={rankStyle(t.rank)} /> : <span className="text-xs font-bold text-fg-muted">{t.rank}</span>}
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-black text-black" style={{ background: t.color ?? "#A3E635" }}>
                {t.badge ?? t.name.charAt(0).toUpperCase()}
              </span>
              <button onClick={() => toggleExpand(t.id)} className="min-w-0 flex-1 text-left">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                  {t.name}
                  {t.is_member && <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[11px] font-bold text-brand">Takımım</span>}
                </p>
                <p className="text-xs text-fg-muted">
                  {t.member_count} üye · {t.points.toLocaleString("tr-TR")} XP
                  {t.weekly_points > 0 && <span className="text-brand"> · +{t.weekly_points.toLocaleString("tr-TR")} bu hafta</span>}
                </p>
              </button>
              {t.is_member ? (
                <button onClick={() => onLeave(t)} disabled={pending || t.is_owner} className="inline-flex items-center gap-1 rounded-xl bg-ink-soft px-3 py-2 text-xs font-semibold text-fg-muted disabled:opacity-50">
                  <LogOut size={13} /> {t.is_owner ? "Kurucu" : "Ayrıl"}
                </button>
              ) : (
                <button onClick={() => onJoin(t)} disabled={pending || !!myTeam} className="rounded-xl bg-brand px-3 py-2 text-xs font-bold text-black disabled:opacity-40">Katıl</button>
              )}
              <button onClick={() => toggleExpand(t.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fg-muted hover:text-fg" aria-label="Kadroyu göster">
                <ChevronDown size={16} className={cn("transition-transform", expanded === t.id && "rotate-180")} />
              </button>
            </div>
            <AnimatePresence initial={false}>
              {expanded === t.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                  className="border-t border-ink-border">
                  {loadingRoster === t.id ? (
                    <p className="p-4 text-center text-xs text-fg-muted">Kadro yükleniyor…</p>
                  ) : (rosters[t.id]?.length ?? 0) === 0 ? (
                    <p className="p-4 text-center text-xs text-fg-muted">Üye bulunamadı.</p>
                  ) : (
                    <div className="divide-y divide-ink-border">
                      {rosters[t.id].map((m, idx) => (
                        <div key={m.user_id} className={cn("flex items-center gap-3 px-4 py-2.5", m.is_me && "bg-brand/5")}>
                          <span className="w-5 shrink-0 text-center text-xs font-bold text-fg-muted">{idx + 1}</span>
                          {m.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <SmartImage src={m.avatar_url} alt={m.name} width={28} height={28} className="h-7 w-7 shrink-0 rounded-full object-cover" />
                          ) : (
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-soft text-[11px] font-bold text-fg-muted">{m.name.charAt(0).toUpperCase()}</span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 truncate text-xs font-semibold">
                              {m.name}
                              {m.role === "owner" && <Crown size={11} className="shrink-0 text-yellow-400" />}
                              {m.is_me && <span className="text-[11px] text-brand">(sen)</span>}
                            </p>
                            <p className="text-[11px] text-fg-muted">Sv {m.level}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-bold">{m.total_xp.toLocaleString("tr-TR")} XP</p>
                            {m.weekly_xp > 0 && <p className="text-[11px] text-brand">+{m.weekly_xp.toLocaleString("tr-TR")} bu hafta</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// --- Timeline ----------------------------------------------------------------
