"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Loader2, Reply, Pin, Trash2, FileText, Download, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "../shared";
import { PRESENCE_DOT } from "@/lib/social/types";
import { type TeamMessage } from "@/lib/teams/types";
import { SmartImage } from "@/components/ui/SmartImage";

export function Bubble({
  m, grouped, canModerate, online, mediaUrl, onReply, onPin, onDelete,
}: {
  m: TeamMessage; grouped: boolean; canModerate: boolean; online: boolean; mediaUrl?: string;
  onReply: () => void; onPin: () => void; onDelete: () => void;
}) {
  const mine = m.is_me;
  const isSticker = m.kind === "gif";

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      className={cn("group flex items-end gap-2", mine && "flex-row-reverse")}
    >
      <div className="w-7 shrink-0">
        {!grouped && (
          <span className="relative block">
            <Avatar src={m.author.avatar_url} name={m.author.name} size={28} />
            {m.author.user_id && (
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-ink-card",
                  online ? PRESENCE_DOT.online : PRESENCE_DOT.offline
                )}
              />
            )}
          </span>
        )}
      </div>

      <div className={cn("flex max-w-[78%] flex-col", mine && "items-end")}>
        {!grouped && (
          <p className="mb-0.5 px-1 text-[10px] font-semibold text-fg-muted">{mine ? "Sen" : m.author.name}</p>
        )}

        <div
          className={cn(
            "relative rounded-2xl px-3 py-2 text-sm leading-snug",
            isSticker
              ? "bg-transparent px-1 py-0 text-3xl"
              : mine
                ? "rounded-br-md bg-brand text-black"
                : "rounded-bl-md border border-white/10 bg-ink-soft/80",
            m.pinned && !isSticker && "ring-1 ring-brand/50"
          )}
        >
          {m.reply_preview && (
            <div
              className={cn(
                "mb-1.5 rounded-lg border-l-2 px-2 py-1 text-[11px]",
                mine ? "border-black/30 bg-black/10" : "border-brand/60 bg-white/5"
              )}
            >
              <span className="font-bold">{m.reply_preview.name}</span>
              <span className="ml-1 opacity-80">{m.reply_preview.body}</span>
            </div>
          )}

          {m.kind === "image" && (
            mediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <SmartImage src={mediaUrl} alt="Sohbet görseli" width={320} height={240} sizes="320px" className="mb-1 max-h-60 w-auto rounded-xl object-cover" />
            ) : (
              <span className="mb-1 flex h-24 w-40 items-center justify-center rounded-xl bg-black/20">
                <Loader2 size={16} className="animate-spin opacity-60" />
              </span>
            )
          )}

          {m.kind === "voice" && <VoiceNote url={mediaUrl} mine={mine} />}

          {m.kind === "file" && (
            <a
              href={mediaUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
                mine ? "bg-black/10" : "bg-white/5"
              )}
            >
              <FileText size={14} />
              <span className="min-w-0 flex-1 truncate">{String(m.attachment?.name ?? "Dosya")}</span>
              {mediaUrl && <Download size={13} />}
            </a>
          )}

          {m.body && <p className="whitespace-pre-wrap break-words">{renderMentions(m.body, mine)}</p>}

          <span className={cn("mt-0.5 block text-[9px] tabular-nums", mine ? "text-black/50" : "text-fg-muted")}>
            {new Date(m.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Aksiyonlar */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button onClick={onReply} aria-label="Yanıtla" className="rounded p-1 text-fg-muted hover:text-fg">
          <Reply size={13} />
        </button>
        {canModerate && (
          <button
            onClick={onPin}
            aria-label="Sabitle"
            className={cn("rounded p-1 hover:text-fg", m.pinned ? "text-brand" : "text-fg-muted")}
          >
            <Pin size={13} />
          </button>
        )}
        {(mine || canModerate) && (
          <button onClick={onDelete} aria-label="Sil" className="rounded p-1 text-fg-muted hover:text-coral">
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

/** Sesli mesaj oynatıcı. */
function VoiceNote({ url, mine }: { url?: string; mine: boolean }) {
  const audio = React.useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = React.useState(false);

  function toggle() {
    if (!url) return;
    if (!audio.current) {
      audio.current = new Audio(url);
      audio.current.onended = () => setPlaying(false);
    }
    if (playing) { audio.current.pause(); setPlaying(false); }
    else { void audio.current.play(); setPlaying(true); }
  }

  React.useEffect(() => () => { audio.current?.pause(); audio.current = null; }, []);

  return (
    <button
      onClick={toggle}
      disabled={!url}
      className={cn(
        "mb-1 flex w-40 items-center gap-2 rounded-lg px-2 py-1.5 text-xs disabled:opacity-60",
        mine ? "bg-black/10" : "bg-white/5"
      )}
    >
      {!url ? <Loader2 size={14} className="animate-spin" /> : playing ? <Pause size={14} /> : <Play size={14} />}
      <span className="flex flex-1 items-center gap-0.5">
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.span
            key={i}
            animate={playing ? { scaleY: [0.4, 1, 0.5, 0.9, 0.4] } : { scaleY: 0.5 }}
            transition={{ duration: 1.1, repeat: playing ? Infinity : 0, delay: i * 0.05 }}
            className={cn("h-3 w-0.5 rounded-full", mine ? "bg-black/40" : "bg-brand/70")}
          />
        ))}
      </span>
    </button>
  );
}

/** @bahsetmeleri vurgular. */
function renderMentions(body: string, mine: boolean): React.ReactNode {
  const parts = body.split(/(@[\p{L}\p{N}]+)/u);
  if (parts.length === 1) return body;
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span key={i} className={cn("rounded px-0.5 font-bold", mine ? "bg-black/15" : "bg-brand/20 text-brand")}>
        {p}
      </span>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    )
  );
}

// --- Yardımcılar -------------------------------------------------------------
