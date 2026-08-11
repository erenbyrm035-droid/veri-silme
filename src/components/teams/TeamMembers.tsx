"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, Shield, Star, MoreVertical, Check, X, Loader2, UserMinus,
  Flame, MessageSquare, Dumbbell, Award, Clock, Search, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Glass, Avatar, Segments, compact } from "./shared";
import { SocialActions } from "@/components/social/SocialActions";
import { PremiumCrown } from "@/components/premium/PremiumCrown";
import { setMemberRole, removeMember, decideJoinRequest } from "@/lib/teams/actions";
import { startLiveSession } from "@/lib/social/actions";
import { PRESENCE_DOT, lastSeenText } from "@/lib/social/types";
import {
  ROLE_LABEL, ROLE_RANK, type TeamHub, type TeamMemberView, type TeamRole,
} from "@/lib/teams/types";

const ROLE_ICON: Record<TeamRole, React.ReactNode> = {
  owner: <Crown size={12} className="text-[#FFD34D]" />,
  admin: <Shield size={12} className="text-brand" />,
  moderator: <Star size={12} className="text-[#8FE3FF]" />,
  member: null,
};

type Sort = "role" | "weekly" | "online";

const SORTS: { value: Sort; label: string }[] = [
  { value: "role", label: "Rol" },
  { value: "weekly", label: "Haftalık" },
  { value: "online", label: "Çevrimiçi" },
];

export function TeamMembers({ hub, onOpenChat }: { hub: TeamHub; onOpenChat?: (name: string) => void }) {
  const myRole = hub.myRole;
  const canManage = myRole ? ROLE_RANK[myRole] >= ROLE_RANK.admin : false;
  const [sort, setSort] = React.useState<Sort>("role");
  const [q, setQ] = React.useState("");

  const list = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle ? hub.members.filter((m) => m.name.toLowerCase().includes(needle)) : hub.members;
    const online = (m: TeamMemberView) => (m.presence.status === "offline" ? 0 : 1);
    return [...base].sort((a, b) => {
      if (sort === "weekly") return b.weekly_xp - a.weekly_xp;
      if (sort === "online") return online(b) - online(a) || b.weekly_xp - a.weekly_xp;
      return ROLE_RANK[b.role] - ROLE_RANK[a.role] || b.total_xp - a.total_xp;
    });
  }, [hub.members, sort, q]);

  const onlineCount = hub.members.filter((m) => m.presence.status !== "offline").length;

  return (
    <div className="space-y-3">
      {canManage && hub.joinRequests.length > 0 && (
        <Glass className="p-3.5">
          <p className="mb-2 text-sm font-bold">
            Katılım İstekleri
            <span className="ml-1.5 rounded-full bg-coral/20 px-1.5 py-0.5 text-[10px] font-bold text-coral">
              {hub.joinRequests.length}
            </span>
          </p>
          <div className="space-y-2">
            {hub.joinRequests.map((r) => <JoinRequestRow key={r.id} req={r} />)}
          </div>
        </Glass>
      )}

      {/* Arama + sıralama */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`${hub.members.length} üye içinde ara…`}
            className="input w-full !py-2 !pl-9 !text-sm"
          />
        </div>
        <Segments value={sort} onChange={setSort} options={SORTS} size="sm" />
      </div>

      <p className="px-1 text-[11px] text-fg-muted">
        <span className="font-bold text-brand">{onlineCount}</span> üye çevrimiçi ·{" "}
        <span className="font-bold">{hub.pulse.active_today}</span> üye bugün antrenman yaptı
      </p>

      {list.length === 0 ? (
        <Glass className="p-10 text-center">
          <Search size={26} className="mx-auto mb-2 text-fg-muted/60" />
          <p className="text-sm font-semibold">Eşleşen üye yok</p>
          <p className="mt-1 text-xs text-fg-muted">Farklı bir isim dene.</p>
        </Glass>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {list.map((m, i) => (
            <MemberCard
              key={m.user_id}
              member={m}
              index={i}
              rank={hub.members.findIndex((x) => x.user_id === m.user_id) + 1}
              myRole={myRole}
              teamId={hub.team.id}
              hasLive={!!hub.live}
              onOpenChat={onOpenChat}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JoinRequestRow({ req }: { req: TeamHub["joinRequests"][number] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function decide(approve: boolean) {
    setBusy(true);
    const res = await decideJoinRequest(req.id, approve);
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex items-center gap-2.5">
      <Avatar src={req.avatar_url} name={req.name} size={34} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{req.name}</p>
        {req.message && <p className="truncate text-[11px] text-fg-muted">{req.message}</p>}
      </div>
      <button
        onClick={() => decide(true)}
        disabled={busy}
        aria-label="Onayla"
        className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-black disabled:opacity-40"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
      </button>
      <button
        onClick={() => decide(false)}
        disabled={busy}
        aria-label="Reddet"
        className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-ink-soft text-fg-muted hover:text-coral"
      >
        <X size={15} />
      </button>
    </div>
  );
}

function MemberCard({
  member, index, rank, myRole, teamId, hasLive, onOpenChat,
}: {
  member: TeamMemberView;
  index: number;
  rank: number;
  myRole: TeamRole | null;
  teamId: string;
  hasLive: boolean;
  onOpenChat?: (name: string) => void;
}) {
  const router = useRouter();
  const [menu, setMenu] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const canManage =
    !!myRole && ROLE_RANK[myRole] >= ROLE_RANK.admin && ROLE_RANK[myRole] > ROLE_RANK[member.role] && !member.is_me;
  const assignable: TeamRole[] = myRole
    ? (["admin", "moderator", "member"] as TeamRole[]).filter((r) => ROLE_RANK[myRole] > ROLE_RANK[r])
    : [];

  async function assign(role: TeamRole) {
    setBusy(true);
    const res = await setMemberRole(teamId, member.user_id, role);
    setBusy(false); setMenu(false);
    if (res.ok) router.refresh(); else alert(res.error);
  }
  async function kick() {
    if (!confirm(`${member.name} takımdan çıkarılsın mı?`)) return;
    setBusy(true);
    const res = await removeMember(teamId, member.user_id);
    setBusy(false); setMenu(false);
    if (res.ok) router.refresh(); else alert(res.error);
  }
  async function transfer() {
    if (!confirm(`Kuruculuk ${member.name} kişisine devredilsin mi? Bu işlem geri alınamaz.`)) return;
    setBusy(true);
    const res = await setMemberRole(teamId, member.user_id, "owner");
    setBusy(false); setMenu(false);
    if (res.ok) router.refresh(); else alert(res.error);
  }

  async function trainTogether() {
    setBusy(true);
    const res = await startLiveSession(teamId);
    setBusy(false);
    if (res.ok) router.refresh(); else alert(res.error);
  }

  const joined = new Date(member.joined_at).toLocaleDateString("tr-TR", { month: "short", year: "numeric" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.02, 0.2) }}
    >
      <Glass className={cn("relative p-3.5", member.is_me && "border-brand/35 bg-brand/[0.04]")}>
        {/* Üst satır */}
        <div className="flex items-start gap-3">
          <span className="relative shrink-0">
            <Avatar
              src={member.avatar_url}
              name={member.name}
              size={48}
              ring={member.is_me ? "ring-2 ring-brand/50" : undefined}
            />
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink-card",
                PRESENCE_DOT[member.presence.status]
              )}
              title={lastSeenText(member.presence)}
            />
            {rank <= 3 && (
              <span className="absolute -left-1 -top-1 text-xs">
                {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
              </span>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {member.is_me ? (
                <p className="truncate text-sm font-bold">{member.name}</p>
              ) : (
                <Link href={`/u/${member.user_id}`} className="truncate text-sm font-bold hover:text-brand">
                  {member.name}
                </Link>
              )}
              {member.is_premium && <PremiumCrown />}
              {ROLE_ICON[member.role]}
              {member.is_me && (
                <span className="shrink-0 rounded-full bg-brand/20 px-1.5 text-[10px] font-bold text-brand">Sen</span>
              )}
            </div>
            <p className="text-[11px] text-fg-muted">
              {ROLE_LABEL[member.role]} · {joined}&apos;den beri
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-fg-muted/80">
              <Clock size={9} /> {lastSeenText(member.presence)}
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => setMenu((v) => !v)}
              aria-label="Üye işlemleri"
              className="shrink-0 rounded-lg p-1 text-fg-muted hover:text-fg"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <MoreVertical size={16} />}
            </button>
          )}
        </div>

        {/* Metrikler */}
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          <Metric icon={<Zap size={10} />} label="Seviye" value={String(member.level)} />
          <Metric icon={<Dumbbell size={10} />} label="XP" value={compact(member.total_xp)} />
          <Metric icon={<Flame size={10} />} label="Seri" value={String(member.streak)} />
          <Metric icon={<Award size={10} />} label="Rozet" value={String(member.badges)} />
        </div>

        {/* Haftalık katkı */}
        {member.weekly_xp > 0 && (
          <div className="mt-2.5">
            <div className="mb-1 flex items-center justify-between text-[10px]">
              <span className="font-semibold text-fg-muted">Bu hafta {compact(member.weekly_xp)} XP</span>
              <span className="font-bold tabular-nums text-brand">%{member.contribution}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-ink-soft">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, member.contribution)}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="h-full rounded-full bg-brand"
              />
            </div>
          </div>
        )}

        {/* Sosyal aksiyonlar — ortak `SocialActions` bileşeni (profil/keşif ile aynı) */}
        {!member.is_me && (
          <SocialActions
            userId={member.user_id}
            social={member.social}
            className="mt-3"
            extra={[
              {
                key: "chat",
                icon: <MessageSquare size={14} />,
                label: "Mesaj",
                onClick: () => onOpenChat?.(member.name),
              },
              {
                key: "train",
                icon: <Dumbbell size={14} />,
                label: hasLive ? "Katıl" : "Antrenman",
                onClick: trainTogether,
              },
            ]}
          />
        )}

        {/* Yönetim menüsü */}
        <AnimatePresence>
          {menu && canManage && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.14 }}
                className="absolute right-3 top-12 z-20 w-44 overflow-hidden rounded-xl border border-white/10 bg-ink-card shadow-xl"
              >
                {assignable.map((r) => (
                  <button
                    key={r}
                    onClick={() => assign(r)}
                    disabled={r === member.role}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-white/5 disabled:opacity-40"
                  >
                    {ROLE_ICON[r] ?? <span className="w-3" />} {ROLE_LABEL[r]} yap
                  </button>
                ))}
                {myRole === "owner" && (
                  <button
                    onClick={transfer}
                    className="flex w-full items-center gap-2 border-t border-white/8 px-3 py-2 text-left text-xs font-semibold text-[#FFD34D] hover:bg-white/5"
                  >
                    <Crown size={12} /> Kuruculuğu devret
                  </button>
                )}
                <button
                  onClick={kick}
                  className="flex w-full items-center gap-2 border-t border-white/8 px-3 py-2 text-left text-xs font-semibold text-coral hover:bg-white/5"
                >
                  <UserMinus size={12} /> Takımdan çıkar
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </Glass>
    </motion.div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-ink-soft/50 px-1 py-1.5 text-center">
      <p className="flex items-center justify-center gap-0.5 text-[9px] font-bold uppercase text-fg-muted">
        {icon}{label}
      </p>
      <p className="text-xs font-black tabular-nums">{value}</p>
    </div>
  );
}
