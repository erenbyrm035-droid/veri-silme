"use client";

// ============================================================================
// Akış gönderisi — takım akışı ile kişisel akışın ORTAK kartı.
//
// Bu dosya `TeamFeed.tsx` içinden çıkarıldı. Takım akışı ve /feed sayfası aynı
// bileşeni kullanır; tek fark hangi gönderi listesinin verildiği. Böylece tepki
// animasyonu, yorum kutusu ve sistem aktivitesi rozetleri tek yerde bakım görür.
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Loader2, MessageCircle, Trash2, Pin, Sparkles, Trophy, Rss,
  Flame, Dumbbell, UserPlus, Target, Zap, Salad, Footprints, Radio,
  Globe, Users, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Glass, Avatar, timeAgo, compact } from "@/components/teams/shared";
import { togglePostReaction, addComment, deletePost } from "@/lib/teams/actions";
import { PRESENCE_DOT } from "@/lib/social/types";
import { PremiumCrown } from "@/components/premium/PremiumCrown";
import { REACTIONS, type PostKind, type ReactionKind, type TeamPost } from "@/lib/teams/types";

/** Sistem aktivitelerinin görsel kimliği. */
export const KIND_STYLE: Record<PostKind, { icon: React.ReactNode; ring: string; emoji: string }> = {
  post:          { icon: <MessageCircle size={13} />, ring: "text-brand",       emoji: "❤️" },
  workout:       { icon: <Dumbbell size={13} />,      ring: "text-brand",       emoji: "🔥" },
  badge:         { icon: <Trophy size={13} />,        ring: "text-[#FFD34D]",   emoji: "🏆" },
  streak:        { icon: <Flame size={13} />,         ring: "text-coral",       emoji: "🔥" },
  level_up:      { icon: <Sparkles size={13} />,      ring: "text-[#C084FC]",   emoji: "⚡" },
  member_joined: { icon: <UserPlus size={13} />,      ring: "text-[#8FE3FF]",   emoji: "👤" },
  quest:         { icon: <Target size={13} />,        ring: "text-brand",       emoji: "🎯" },
  xp:            { icon: <Zap size={13} />,           ring: "text-brand",       emoji: "💪" },
  live_workout:  { icon: <Radio size={13} />,         ring: "text-coral",       emoji: "🏋️" },
  nutrition:     { icon: <Salad size={13} />,         ring: "text-brand",       emoji: "🥗" },
  steps:         { icon: <Footprints size={13} />,    ring: "text-[#8FE3FF]",   emoji: "🏃" },
};

export const VISIBILITY_META = {
  public:  { icon: <Globe size={11} />, label: "Herkese açık" },
  friends: { icon: <Users size={11} />, label: "Arkadaşlar" },
  team:    { icon: <Lock size={11} />,  label: "Takım" },
} as const;

export function PostCard({
  post, index, canReact, canModerate, meId, online, showAuthorLink,
}: {
  post: TeamPost;
  index: number;
  /** Tepki/yorum verebilir mi? (takım akışında üye olmayanlar veremez) */
  canReact: boolean;
  canModerate: boolean;
  meId: string;
  online?: boolean;
  /** Yazar adı sporcu profiline bağlansın mı? (kişisel akışta evet) */
  showAuthorLink?: boolean;
}) {
  const router = useRouter();
  const [reactions, setReactions] = React.useState(post.reactions);
  const [mine, setMine] = React.useState<ReactionKind[]>(post.my_reactions);
  const [open, setOpen] = React.useState(false);
  const [burst, setBurst] = React.useState<string | null>(null);

  React.useEffect(() => {
    setReactions(post.reactions);
    setMine(post.my_reactions);
  }, [post.reactions, post.my_reactions]);

  async function react(kind: ReactionKind, emoji: string) {
    if (!canReact) return;
    const active = mine.includes(kind);
    setMine((m) => (active ? m.filter((k) => k !== kind) : [...m, kind]));
    setReactions((r) => ({ ...r, [kind]: Math.max(0, (r[kind] ?? 0) + (active ? -1 : 1)) }));
    if (!active) { setBurst(emoji); setTimeout(() => setBurst(null), 700); }
    const res = await togglePostReaction(post.id, kind);
    if (!res.ok) { setMine(post.my_reactions); setReactions(post.reactions); }
  }

  async function remove() {
    if (!confirm("Bu gönderi silinsin mi?")) return;
    const res = await deletePost(post.id);
    if (res.ok) router.refresh();
  }

  const canDelete = canModerate || (!post.is_system && post.author.user_id === meId);
  const style = KIND_STYLE[post.kind] ?? KIND_STYLE.post;
  const vis = post.visibility && post.visibility !== "team" ? VISIBILITY_META[post.visibility] : null;
  const meta = post.meta ?? {};

  const authorName = showAuthorLink && post.author.user_id && post.author.user_id !== meId ? (
    <Link href={`/u/${post.author.user_id}`} className="truncate text-sm font-bold hover:text-brand">
      {post.author.name}
    </Link>
  ) : (
    <p className="truncate text-sm font-bold">{post.author.name}</p>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.24, delay: Math.min(index * 0.02, 0.18) }}
    >
      <Glass className={cn("relative overflow-hidden p-3.5", post.pinned && "border-brand/35")}>
        {/* Tepki patlaması */}
        <AnimatePresence>
          {burst && (
            <motion.span
              initial={{ opacity: 0, scale: 0.4, y: 10 }}
              animate={{ opacity: [0, 1, 0], scale: [0.4, 1.6, 1.9], y: -34 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="pointer-events-none absolute bottom-8 left-8 z-10 text-2xl"
            >
              {burst}
            </motion.span>
          )}
        </AnimatePresence>

        <div className="flex items-start gap-2.5">
          <span className="relative shrink-0">
            <Avatar src={post.author.avatar_url} name={post.author.name} size={38} />
            {post.author.user_id && typeof online === "boolean" && (
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-card",
                  online ? PRESENCE_DOT.online : PRESENCE_DOT.offline
                )}
              />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {authorName}
              {post.author.is_premium && <PremiumCrown />}
              {post.is_system && (
                <span className={cn("flex shrink-0 items-center gap-1 rounded-full bg-white/6 px-1.5 py-0.5 text-[10px] font-bold", style.ring)}>
                  {style.icon}
                </span>
              )}
              {post.pinned && <Pin size={12} className="shrink-0 text-brand" />}
              <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-fg-muted">
                {vis && <span title={vis.label}>{vis.icon}</span>}
                {timeAgo(post.created_at)}
              </span>
            </div>

            {post.team_name && (
              <p className="mt-0.5 text-[10px] font-semibold text-fg-muted">
                {post.team_slug ? (
                  <Link href={`/teams/${post.team_slug}`} className="hover:text-brand">
                    {post.team_name}
                  </Link>
                ) : post.team_name}
              </p>
            )}

            {post.body && (
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg/90">
                {post.is_system && <span className="mr-1">{style.emoji}</span>}
                {post.body}
              </p>
            )}

            <MetaChips kind={post.kind} meta={meta} />

            {/* Tepkiler */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {REACTIONS.map((r) => {
                const count = reactions[r.kind] ?? 0;
                const active = mine.includes(r.kind);
                return (
                  <button
                    key={r.kind}
                    onClick={() => react(r.kind, r.emoji)}
                    disabled={!canReact}
                    title={r.label}
                    aria-label={r.label}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition-all active:scale-90",
                      active
                        ? "border-brand/50 bg-brand/15 text-brand"
                        : "border-white/10 bg-ink-soft/60 text-fg-muted hover:border-white/25",
                      !canReact && "cursor-default opacity-60"
                    )}
                  >
                    <span className="text-xs leading-none">{r.emoji}</span>
                    {count > 0 && <span className="tabular-nums">{count}</span>}
                  </button>
                );
              })}
              <button
                onClick={() => setOpen((v) => !v)}
                aria-label="Yorumlar"
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors",
                  open ? "border-brand/50 bg-brand/15 text-brand" : "border-white/10 bg-ink-soft/60 text-fg-muted hover:border-white/25"
                )}
              >
                <MessageCircle size={12} />
                {post.comment_count > 0 && <span className="tabular-nums">{post.comment_count}</span>}
              </button>
              {canDelete && (
                <button
                  onClick={remove}
                  aria-label="Gönderiyi sil"
                  className="ml-auto rounded-full p-1 text-fg-muted transition-colors hover:text-coral"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <Comments post={post} canWrite={canReact} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Glass>
    </motion.div>
  );
}

/** Aktivite türüne göre ek bilgi rozetleri. */
function MetaChips({ kind, meta }: { kind: PostKind; meta: Record<string, unknown> }) {
  const chips: string[] = [];
  const num = (k: string) => (typeof meta[k] === "number" ? (meta[k] as number) : null);

  if (kind === "workout" && num("minutes")) chips.push(`${num("minutes")} dk`);
  if (kind === "live_workout") {
    if (num("participants")) chips.push(`${num("participants")} katılımcı`);
    if (num("minutes")) chips.push(`${num("minutes")} dk`);
    if (num("calories")) chips.push(`${compact(num("calories")!)} kcal`);
    if (num("total_xp")) chips.push(`+${compact(num("total_xp")!)} XP`);
  }
  if (kind === "quest" && num("reward_xp")) chips.push(`+${compact(num("reward_xp")!)} XP ödül`);
  if (kind === "streak" && num("streak")) chips.push(`${num("streak")} günlük seri`);
  if (kind === "level_up" && num("level")) chips.push(`Seviye ${num("level")}`);
  if (kind === "steps" && num("steps")) chips.push(`${compact(num("steps")!)} adım`);
  if (kind === "xp" && num("xp")) chips.push(`+${compact(num("xp")!)} XP`);
  if (kind === "badge" && typeof meta.tier === "string") chips.push(String(meta.tier));

  if (chips.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span key={c} className="rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">
          {c}
        </span>
      ))}
    </div>
  );
}

function Comments({ post, canWrite }: { post: TeamPost; canWrite: boolean }) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const res = await addComment(post.id, body);
    setBusy(false);
    if (res.ok) { setText(""); router.refresh(); }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-white/8 pt-3">
      {post.comments.length === 0 && <p className="text-[11px] text-fg-muted">Henüz yorum yok.</p>}
      {post.comment_count > post.comments.length && (
        <p className="text-[10px] text-fg-muted">
          Son {post.comments.length} yorum gösteriliyor ({post.comment_count} toplam)
        </p>
      )}
      {post.comments.map((c) => (
        <div key={c.id} className="flex items-start gap-2">
          <Avatar src={c.author.avatar_url} name={c.author.name} size={24} />
          <div className="min-w-0 flex-1 rounded-xl bg-ink-soft/60 px-2.5 py-1.5">
            <p className="text-[11px] font-bold">
              {c.author.name}
              <span className="ml-1.5 font-normal text-fg-muted">{timeAgo(c.created_at)}</span>
            </p>
            <p className="whitespace-pre-wrap break-words text-xs text-fg/90">{c.body}</p>
          </div>
        </div>
      ))}

      {canWrite && (
        <div className="flex items-center gap-2 pt-1">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Yorum yaz…"
            maxLength={500}
            className="flex-1 rounded-xl border border-white/10 bg-ink-soft/60 px-3 py-1.5 text-xs outline-none focus:border-brand/40"
          />
          <button
            onClick={submit}
            disabled={busy || !text.trim()}
            aria-label="Yorumu gönder"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand text-black disabled:opacity-40"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}

export function EmptyFeed({ title, desc }: { title: string; desc: string }) {
  return (
    <Glass className="relative overflow-hidden p-10 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(70% 60% at 50% 0%, rgba(163,230,53,0.08) 0%, transparent 65%)" }}
      />
      <div className="relative">
        <motion.span
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-ink-soft/70 text-fg-muted"
        >
          <Rss size={24} />
        </motion.span>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-fg-muted">{desc}</p>
      </div>
    </Glass>
  );
}
