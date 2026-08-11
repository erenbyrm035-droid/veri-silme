"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus, UserCheck, UserX, Check, X, Loader2, Users, Flame, Clock, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Glass, Avatar, Segments, compact } from "./shared";
import { respondFriendRequest, removeFriend, sendFriendRequest } from "@/lib/social/actions";
import { PRESENCE_DOT, lastSeenText } from "@/lib/social/types";
import type { FriendRequestView, FriendView } from "@/lib/social/types";
import type { TeamHub } from "@/lib/teams/types";

type Tab = "friends" | "requests" | "suggest";

export function TeamFriends({ hub }: { hub: TeamHub }) {
  const incoming = hub.friendRequests.filter((r) => !r.outgoing);
  const [tab, setTab] = React.useState<Tab>(incoming.length > 0 ? "requests" : "friends");
  const [q, setQ] = React.useState("");

  const tabs = React.useMemo(
    () => [
      { value: "friends" as Tab, label: `Arkadaşlar${hub.friends.length ? ` (${hub.friends.length})` : ""}` },
      { value: "requests" as Tab, label: incoming.length ? `İstekler (${incoming.length})` : "İstekler" },
      { value: "suggest" as Tab, label: "Takımdan Ekle" },
    ],
    [hub.friends.length, incoming.length]
  );

  const friends = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? hub.friends.filter((f) => f.name.toLowerCase().includes(needle)) : hub.friends;
  }, [hub.friends, q]);

  // Henüz arkadaş olmayan takım arkadaşları
  const suggestions = React.useMemo(
    () => hub.members.filter((m) => !m.is_me && m.social.friend === "none"),
    [hub.members]
  );

  return (
    <div className="space-y-3">
      <Segments value={tab} onChange={setTab} options={tabs} size="sm" className="w-full" />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16 }}
          className="space-y-2.5"
        >
          {tab === "friends" && (
            <>
              {hub.friends.length > 4 && (
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Arkadaş ara…"
                    className="input w-full !pl-9 !py-2 !text-sm"
                  />
                </div>
              )}
              {friends.length === 0 ? (
                <Empty
                  icon={<Users size={26} />}
                  title="Henüz arkadaşın yok"
                  desc="Takım arkadaşlarını ekleyerek onların aktivitelerini takip et ve birlikte antrenman yap."
                />
              ) : (
                friends.map((f, i) => <FriendRow key={f.user_id} friend={f} index={i} />)
              )}
            </>
          )}

          {tab === "requests" && (
            hub.friendRequests.length === 0 ? (
              <Empty
                icon={<UserPlus size={26} />}
                title="Bekleyen istek yok"
                desc="Gelen ve gönderdiğin arkadaşlık istekleri burada görünür."
              />
            ) : (
              hub.friendRequests.map((r, i) => <RequestRow key={r.id} req={r} index={i} />)
            )
          )}

          {tab === "suggest" && (
            suggestions.length === 0 ? (
              <Empty
                icon={<UserCheck size={26} />}
                title="Herkesi eklemişsin"
                desc="Bu takımdaki tüm üyelerle zaten bağlantın var."
              />
            ) : (
              suggestions.map((m, i) => (
                <SuggestRow
                  key={m.user_id}
                  index={i}
                  userId={m.user_id}
                  name={m.name}
                  avatar={m.avatar_url}
                  level={m.level}
                  xp={m.total_xp}
                />
              ))
            )
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function FriendRow({ friend, index }: { friend: FriendView; index: number }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function remove() {
    if (!confirm(`${friend.name} arkadaş listenden çıkarılsın mı?`)) return;
    setBusy(true);
    const res = await removeFriend(friend.user_id);
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.2) }}
    >
      <Glass className="flex items-center gap-3 p-3">
        <span className="relative shrink-0">
          <Avatar src={friend.avatar_url} name={friend.name} size={42} />
          <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-card", PRESENCE_DOT[friend.presence.status])} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold">{friend.name}</p>
            {friend.same_team && (
              <span className="shrink-0 rounded-full bg-brand/15 px-1.5 text-[10px] font-bold text-brand">Takım</span>
            )}
          </div>
          <p className="truncate text-[11px] text-fg-muted">
            Sv {friend.level} · {compact(friend.total_xp)} XP
            {friend.streak > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-0.5"><Flame size={9} className="text-coral" />{friend.streak}</span>
            )}
          </p>
          <p className="flex items-center gap-1 text-[10px] text-fg-muted/80">
            <Clock size={9} /> {lastSeenText(friend.presence)}
          </p>
        </div>
        <button
          onClick={remove}
          disabled={busy}
          aria-label="Arkadaşlıktan çıkar"
          className="shrink-0 rounded-lg p-1.5 text-fg-muted transition-colors hover:text-coral"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <UserX size={16} />}
        </button>
      </Glass>
    </motion.div>
  );
}

function RequestRow({ req, index }: { req: FriendRequestView; index: number }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function decide(accept: boolean) {
    setBusy(true);
    const res = await respondFriendRequest(req.id, accept);
    setBusy(false);
    if (res.ok) router.refresh();
  }

  async function cancel() {
    setBusy(true);
    const res = await removeFriend(req.user_id);
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.2) }}
    >
      <Glass className="flex items-center gap-3 p-3">
        <Avatar src={req.avatar_url} name={req.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{req.name}</p>
          <p className="text-[11px] text-fg-muted">
            {req.outgoing ? "İsteğin bekliyor" : "Seni arkadaş olarak eklemek istiyor"}
          </p>
        </div>
        {req.outgoing ? (
          <button
            onClick={cancel}
            disabled={busy}
            className="shrink-0 rounded-xl border border-ink-border bg-ink-soft px-3 py-1.5 text-xs font-semibold text-fg-muted"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : "İptal"}
          </button>
        ) : (
          <div className="flex shrink-0 gap-1.5">
            <button
              onClick={() => decide(true)}
              disabled={busy}
              aria-label="Kabul et"
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
        )}
      </Glass>
    </motion.div>
  );
}

function SuggestRow({
  index, userId, name, avatar, level, xp,
}: { index: number; userId: string; name: string; avatar: string | null; level: number; xp: number }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function add() {
    setBusy(true);
    const res = await sendFriendRequest(userId);
    setBusy(false);
    if (res.ok) { setSent(true); router.refresh(); }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.2) }}
    >
      <Glass className="flex items-center gap-3 p-3">
        <Avatar src={avatar} name={name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{name}</p>
          <p className="text-[11px] text-fg-muted">Sv {level} · {compact(xp)} XP</p>
        </div>
        <button
          onClick={add}
          disabled={busy || sent}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
            sent ? "bg-brand/15 text-brand" : "bg-brand text-black"
          )}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : sent ? <Check size={13} /> : <UserPlus size={13} />}
          {sent ? "Gönderildi" : "Ekle"}
        </button>
      </Glass>
    </motion.div>
  );
}

function Empty({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Glass className="p-10 text-center">
      <span className="mx-auto mb-2 block text-fg-muted/60">{icon}</span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-xs text-fg-muted">{desc}</p>
    </Glass>
  );
}
