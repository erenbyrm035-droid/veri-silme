"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { Send, Loader2, Globe, Users, Lock, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Glass, Segments } from "@/components/teams/shared";
import { PostCard, EmptyFeed } from "./PostCard";
import { WorkoutParty } from "@/components/social/WorkoutParty";
import { createFeedPost } from "@/lib/social/actions";
import type { FeedScope } from "@/lib/social/feed";
import type { FriendView, LiveSessionView } from "@/lib/social/types";
import type { PostVisibility, TeamPost } from "@/lib/teams/types";

const SCOPES: { value: FeedScope; label: string }[] = [
  { value: "friends", label: "Arkadaşlarım" },
  { value: "public", label: "Keşfet" },
  { value: "mine", label: "Benim" },
];

const VIS: { value: PostVisibility; label: string; icon: React.ReactNode }[] = [
  { value: "friends", label: "Arkadaşlar", icon: <Users size={12} /> },
  { value: "public", label: "Herkese açık", icon: <Globe size={12} /> },
  { value: "team", label: "Takımım", icon: <Lock size={12} /> },
];

export function FeedClient({
  posts, scope, meId, friendCount, hasTeam, friends, party, weightKg,
}: {
  posts: TeamPost[];
  scope: FeedScope;
  meId: string;
  friendCount: number;
  hasTeam: boolean;
  friends: FriendView[];
  party: LiveSessionView | null;
  weightKg: number | null;
}) {
  const router = useRouter();

  function changeScope(next: FeedScope) {
    // Kapsam URL'de tutulur: paylaşılabilir, geri tuşuyla gezilebilir ve
    // sunucu tarafında yeniden veri çeker (istemcide filtrelemek yerine).
    router.push(next === "friends" ? "/feed" : `/feed?kapsam=${next}`);
  }

  const empty =
    scope === "mine"
      ? { title: "Henüz paylaşımın yok", desc: "Bir şeyler yaz ya da antrenmanını tamamla — otomatik olarak burada görünür." }
      : scope === "public"
        ? { title: "Keşfedilecek bir şey yok", desc: "Herkese açık paylaşımlar burada listelenir. İlk paylaşımı sen yapabilirsin." }
        : { title: "Akışın sessiz", desc: friendCount === 0
            ? "Henüz arkadaşın yok. Keşfet sekmesinden sporcu ekle, aktiviteleri burada görünsün."
            : "Arkadaşların henüz bir şey paylaşmadı." };

  return (
    <div className="space-y-4">
      <WorkoutParty party={party} friends={friends} meId={meId} weightKg={weightKg} />

      <Composer hasTeam={hasTeam} />

      <div className="flex items-center justify-between gap-2">
        <Segments value={scope} onChange={changeScope} options={SCOPES} size="sm" />
        {friendCount === 0 && (
          <Link
            href="/discover"
            className="flex shrink-0 items-center gap-1 rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1.5 text-[11px] font-bold text-brand"
          >
            <UserPlus size={12} /> Sporcu bul
          </Link>
        )}
      </div>

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
                canReact
                canModerate={false}
                meId={meId}
                showAuthorLink
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function Composer({ hasTeam }: { hasTeam: boolean }) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [vis, setVis] = React.useState<PostVisibility>("friends");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const options = hasTeam ? VIS : VIS.filter((v) => v.value !== "team");

  async function submit() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setErr(null);
    const res = await createFeedPost({ body, visibility: vis });
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
        placeholder="Bugün nasıl gitti?"
        aria-label="Gönderi metni"
        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-fg-muted"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => setVis(o.value)}
              aria-pressed={vis === o.value}
              title={`Görünürlük: ${o.label}`}
              className={cn(
                "flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition-colors",
                vis === o.value
                  ? "border-brand/50 bg-brand/15 text-brand"
                  : "border-white/10 bg-ink-soft/60 text-fg-muted hover:border-brand/40"
              )}
            >
              {o.icon} {o.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-fg-muted">{text.length}/1000</span>
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
