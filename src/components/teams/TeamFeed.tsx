"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, ArrowUp } from "lucide-react";
import { Glass, Segments } from "./shared";
import { PostCard, EmptyFeed } from "@/components/feed/PostCard";
import { createPost } from "@/lib/teams/actions";
import { ROLE_RANK, type TeamHub } from "@/lib/teams/types";

type Filter = "all" | "friends" | "mine";

/**
 * Takım akışı.
 *
 * Gönderi kartı `components/feed/PostCard` içinde ortaklaştırıldı; burada
 * yalnızca takıma özgü kısımlar kalır: üyelik kontrolü, filtreler, composer ve
 * "yeni aktivite" bildirimi.
 */
export function TeamFeed({
  hub, newCount, onSeeNew,
}: { hub: TeamHub; newCount?: number; onSeeNew?: () => void }) {
  const { myRole, team, meId } = hub;
  const isMember = !!myRole;
  const canModerate = myRole ? ROLE_RANK[myRole] >= ROLE_RANK.moderator : false;
  const [filter, setFilter] = React.useState<Filter>("all");

  const friendIds = React.useMemo(() => new Set(hub.friends.map((f) => f.user_id)), [hub.friends]);
  const presenceById = React.useMemo(
    () => new Map(hub.members.map((m) => [m.user_id, m.presence])),
    [hub.members]
  );

  const posts = React.useMemo(() => {
    if (filter === "friends") {
      return hub.posts.filter((p) => p.author.user_id && friendIds.has(p.author.user_id));
    }
    if (filter === "mine") return hub.posts.filter((p) => p.author.user_id === meId);
    return hub.posts;
  }, [hub.posts, filter, friendIds, meId]);

  const filters = React.useMemo(
    () => [
      { value: "all" as Filter, label: "Tümü" },
      { value: "friends" as Filter, label: hub.friends.length ? `Arkadaşlar (${hub.friends.length})` : "Arkadaşlar" },
      { value: "mine" as Filter, label: "Benim" },
    ],
    [hub.friends.length]
  );

  const empty =
    filter === "friends"
      ? { title: "Arkadaş aktivitesi yok", desc: "Üyeler sekmesinden takım arkadaşlarını ekle; aktiviteleri burada görünsün." }
      : filter === "mine"
        ? { title: "Henüz paylaşımın yok", desc: "Antrenmanını tamamladığında otomatik olarak burada görünecek." }
        : { title: "Akış henüz boş", desc: isMember ? "İlk paylaşımı sen yap — antrenmanların otomatik düşer." : "Takıma katılarak paylaşıma başla." };

  return (
    <div className="space-y-3">
      {isMember && <Composer teamId={team.id} />}

      <div className="flex items-center justify-between gap-2">
        <Segments value={filter} onChange={setFilter} options={filters} size="sm" />
      </div>

      {/* Yeni aktivite bildirimi */}
      <AnimatePresence>
        {!!newCount && newCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            onClick={onSeeNew}
            className="mx-auto flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-xs font-bold text-black shadow-[0_4px_20px_-4px_rgb(var(--brand)/0.6)]"
          >
            <ArrowUp size={13} /> {newCount} yeni aktivite
          </motion.button>
        )}
      </AnimatePresence>

      {posts.length === 0 ? (
        <EmptyFeed title={empty.title} desc={empty.desc} />
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {posts.map((p, i) => (
              <PostCard
                key={p.id}
                post={p}
                index={i}
                canReact={isMember}
                canModerate={canModerate}
                meId={meId}
                online={presenceById.get(p.author.user_id ?? "")?.status !== "offline"}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function Composer({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function submit() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setErr(null);
    const res = await createPost(teamId, body);
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? "Paylaşılamadı.");
    setText("");
    router.refresh();
  }

  return (
    <Glass className="p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
        rows={2}
        maxLength={1000}
        placeholder="Takımına bir şeyler yaz…"
        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-fg-muted"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-fg-muted">{text.length}/1000</span>
        <button
          onClick={submit}
          disabled={busy || !text.trim()}
          className="btn-primary flex items-center gap-1.5 !px-3.5 !py-1.5 !text-xs disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Paylaş
        </button>
      </div>
      {err && <p className="mt-1 text-xs text-coral">{err}</p>}
    </Glass>
  );
}
