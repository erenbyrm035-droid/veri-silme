"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Users, MessageSquare, Rss, Target, CalendarDays, Award,
  Radio, Heart, BarChart3, Swords,
} from "lucide-react";
import { Segments } from "./shared";
import { TeamHero, LevelUpCelebration, LiveBanner } from "./TeamHero";
import { TeamMvp } from "./TeamMvp";
import { TeamStatsPanel } from "./TeamStats";
import { TeamFeed } from "./TeamFeed";
import { TeamChat } from "./TeamChat";
import { TeamQuests } from "./TeamQuests";
import { TeamMembers } from "./TeamMembers";
import { TeamEvents } from "./TeamEvents";
import { TeamBadges } from "./TeamBadges";
import { TeamFriends } from "./TeamFriends";
import { TeamLiveWorkout } from "./TeamLiveWorkout";
import { TeamBattles } from "./TeamBattles";
import { LiveNotifications } from "./LiveNotifications";
import { InviteModal } from "./InviteModal";
import { joinTeam, leaveTeam } from "@/lib/teams/actions";
import { usePresenceHeartbeat, useTeamLiveData } from "@/lib/social/hooks";
import { ROLE_RANK, type TeamHub } from "@/lib/teams/types";

type Tab = "feed" | "chat" | "live" | "quests" | "battles" | "members" | "friends" | "events" | "badges" | "stats";

export function TeamHubClient({ hub }: { hub: TeamHub }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("feed");
  const [invite, setInvite] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [newPosts, setNewPosts] = React.useState(0);
  const [chatMention, setChatMention] = React.useState<string | null>(null);

  const { team, stats, myRole, meId } = hub;
  const isMember = !!myRole;
  const canManage = myRole ? ROLE_RANK[myRole] >= ROLE_RANK.admin : false;
  const pending = hub.joinRequests.length;
  const incomingFriends = hub.friendRequests.filter((r) => !r.outgoing).length;
  // Yanıt bekleyen savaş daveti (bize gelen) — sekmede rozet olarak gösterilir.
  const battleAlerts = hub.battles.filter((b) => b.status === "pending" && !b.is_challenger).length;

  // Çevrimiçi durumu + canlı veri akışı
  usePresenceHeartbeat(isMember ? team.id : null);
  useTeamLiveData(team.id, {
    enabled: isMember,
    onNewPost: React.useCallback(() => setNewPosts((n) => n + 1), []),
  });

  // Akış sekmesine dönüldüğünde "yeni" sayacını sıfırla
  React.useEffect(() => { if (tab === "feed") setNewPosts(0); }, [tab]);

  const weeklyTotal = React.useMemo(
    () => hub.members.reduce((s, m) => s + m.weekly_xp, 0),
    [hub.members]
  );

  const tabs = React.useMemo(() => {
    const base: { value: Tab; label: string; icon: React.ReactNode }[] = [
      { value: "feed", label: "Akış", icon: <Rss size={14} /> },
    ];
    if (isMember) {
      base.push(
        { value: "chat", label: "Sohbet", icon: <MessageSquare size={14} /> },
        { value: "live", label: hub.live ? "Canlı ●" : "Birlikte", icon: <Radio size={14} /> },
      );
    }
    base.push(
      { value: "quests", label: "Görevler", icon: <Target size={14} /> },
      { value: "battles", label: battleAlerts > 0 ? `Savaş (${battleAlerts})` : "Savaş", icon: <Swords size={14} /> },
      { value: "members", label: pending > 0 ? `Üyeler (${pending})` : "Üyeler", icon: <Users size={14} /> },
    );
    if (isMember) {
      base.push({
        value: "friends",
        label: incomingFriends > 0 ? `Arkadaşlar (${incomingFriends})` : "Arkadaşlar",
        icon: <Heart size={14} />,
      });
    }
    base.push(
      { value: "events", label: "Etkinlik", icon: <CalendarDays size={14} /> },
      { value: "badges", label: "Rozetler", icon: <Award size={14} /> },
      { value: "stats", label: "İstatistik", icon: <BarChart3 size={14} /> },
    );
    return base;
  }, [isMember, pending, incomingFriends, hub.live, battleAlerts]);

  async function handleJoin() {
    setBusy(true); setMsg(null);
    const res = await joinTeam(team.id);
    setBusy(false);
    if (!res.ok) return setMsg(res.error ?? "Katılınamadı.");
    setMsg(res.data?.status === "requested" ? "Katılım isteğin gönderildi." : null);
    router.refresh();
  }

  async function handleLeave() {
    if (!confirm("Takımdan ayrılmak istediğine emin misin?")) return;
    setBusy(true);
    const res = await leaveTeam(team.id);
    setBusy(false);
    if (!res.ok) return setMsg(res.error ?? "Ayrılınamadı.");
    router.push("/teams");
  }

  function openChatWith(name: string) {
    setChatMention(name);
    setTab("chat");
  }

  return (
    <div className="space-y-4">
      {isMember && <LiveNotifications userId={meId} />}
      <LevelUpCelebration teamId={team.id} level={stats.level} />

      <Link href="/teams" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft size={16} /> Takımlar
      </Link>

      <TeamHero
        hub={hub}
        canManage={canManage}
        busy={busy}
        message={msg}
        onJoin={handleJoin}
        onLeave={handleLeave}
        onInvite={() => setInvite(true)}
      />

      {isMember && hub.live && tab !== "live" && (
        <LiveBanner count={hub.live.participants.length} onOpen={() => setTab("live")} />
      )}

      <TeamMvp mvp={hub.mvp} weeklyTotal={weeklyTotal} />

      <Segments value={tab} onChange={setTab} options={tabs} size="sm" className="w-full" />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {tab === "feed" && (
            <TeamFeed hub={hub} newCount={newPosts} onSeeNew={() => { setNewPosts(0); router.refresh(); }} />
          )}
          {tab === "chat" && isMember && (
            <TeamChat
              teamId={team.id}
              initial={hub.messages}
              myRole={myRole!}
              members={hub.members}
              focusMention={chatMention}
            />
          )}
          {tab === "live" && <TeamLiveWorkout hub={hub} />}
          {tab === "quests" && <TeamQuests hub={hub} />}
          {tab === "battles" && (
            <TeamBattles
              teamId={team.id}
              battles={hub.battles}
              opponents={hub.battleOpponents}
              myRole={myRole}
            />
          )}
          {tab === "members" && <TeamMembers hub={hub} onOpenChat={isMember ? openChatWith : undefined} />}
          {tab === "friends" && isMember && <TeamFriends hub={hub} />}
          {tab === "events" && <TeamEvents hub={hub} />}
          {tab === "badges" && <TeamBadges badges={hub.badges} />}
          {tab === "stats" && (
            <TeamStatsPanel
              stats={stats}
              pulse={hub.pulse}
              series={hub.series}
              memberCount={team.member_count}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {invite && hub.inviteCode && (
        <InviteModal teamId={team.id} slug={team.slug} code={hub.inviteCode} onClose={() => setInvite(false)} />
      )}
    </div>
  );
}
