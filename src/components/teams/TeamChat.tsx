"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Smile, Loader2, Reply, Pin, Trash2, X, Dumbbell, UtensilsCrossed,
  ImageIcon, Paperclip, Mic, Square, AtSign, FileText, Download, Play, Pause,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { uploadToStorage } from "@/lib/storage/upload";
import { Glass, Avatar } from "./shared";
import { sendMessage, togglePinMessage, deleteMessage, signTeamMedia } from "@/lib/teams/actions";
import { PRESENCE_DOT } from "@/lib/social/types";
import {
  ROLE_RANK, type MessageKind, type TeamMemberView, type TeamMessage, type TeamRole,
} from "@/lib/teams/types";
import { SmartImage } from "@/components/ui/SmartImage";

const EMOJIS = [
  "💪", "🔥", "👏", "❤️", "😄", "😅", "🥲", "🎯", "🏆", "⚡",
  "🏋️", "🏃", "🚴", "🧘", "🥗", "🍗", "🥤", "💧", "😴", "📈",
  "🙌", "🤝", "✅", "🎉", "😎", "🤯", "🥇", "🥈", "🥉", "🫡",
];

/** Harici istek gerektirmeyen, büyük punto "GIF" benzeri sticker'lar. */
const STICKERS = ["💪🔥", "🏆🎉", "😤💯", "🥇✨", "🫡👊", "🍗🥗", "😴🛌", "🚀📈"];

const MAX_UPLOAD = 8 * 1024 * 1024; // 8 MB

export function TeamChat({
  teamId, initial, myRole, members, focusMention,
}: {
  teamId: string;
  initial: TeamMessage[];
  myRole: TeamRole;
  members: TeamMemberView[];
  focusMention?: string | null;
}) {
  const [messages, setMessages] = React.useState<TeamMessage[]>(initial);
  const [text, setText] = React.useState("");
  const [reply, setReply] = React.useState<TeamMessage | null>(null);
  const [picker, setPicker] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [live, setLive] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = React.useState<Record<string, string>>({});

  const scroller = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const photoRef = React.useRef<HTMLInputElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const canModerate = ROLE_RANK[myRole] >= ROLE_RANK.moderator;
  const meId = React.useMemo(() => members.find((m) => m.is_me)?.user_id ?? null, [members]);
  const memberMap = React.useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);
  const pinned = React.useMemo(() => messages.filter((m) => m.pinned).slice(-1)[0] ?? null, [messages]);
  const onlineCount = members.filter((m) => m.presence.status !== "offline").length;

  const scrollToEnd = React.useCallback((smooth = true) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  React.useEffect(() => { scrollToEnd(false); }, [scrollToEnd]);

  // Üyeler sekmesinden "Mesaj" ile gelindiğinde @bahsetmeyi hazırla
  React.useEffect(() => {
    if (!focusMention) return;
    setText((t) => (t.includes(`@${focusMention}`) ? t : `@${focusMention} `));
    inputRef.current?.focus();
  }, [focusMention]);

  // --- Ekli medya için imzalı URL'ler --------------------------------------
  React.useEffect(() => {
    const paths = messages
      .map((m) => (typeof m.attachment?.path === "string" ? (m.attachment.path as string) : null))
      .filter((p): p is string => !!p && !mediaUrls[p]);
    if (paths.length === 0) return;
    let cancelled = false;
    (async () => {
      const res = await signTeamMedia(teamId, paths);
      if (!cancelled && res.ok && res.data) setMediaUrls((prev) => ({ ...prev, ...res.data }));
    })();
    return () => { cancelled = true; };
  }, [messages, teamId, mediaUrls]);

  // --- Supabase Realtime ----------------------------------------------------
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`team-chat-${teamId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "team_messages", filter: `team_id=eq.${teamId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, toMessage(row, memberMap, meId, prev)];
          });
          requestAnimationFrame(() => scrollToEnd(true));
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "team_messages", filter: `team_id=eq.${teamId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setMessages((prev) =>
            prev.map((m) => (m.id === row.id ? { ...m, pinned: !!row.pinned, body: (row.body as string) ?? m.body } : m))
          );
        })
      .on("postgres_changes",
        { event: "DELETE", schema: "public", table: "team_messages" },
        (payload) => {
          const row = payload.old as Record<string, unknown>;
          setMessages((prev) => prev.filter((m) => m.id !== row.id));
        })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => { supabase.removeChannel(channel); };
  }, [teamId, memberMap, meId, scrollToEnd]);

  // --- @bahsetme -----------------------------------------------------------
  const mentionCandidates = React.useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members.filter((m) => !m.is_me && m.name.toLowerCase().includes(q)).slice(0, 5);
  }, [members, mentionQuery]);

  function onTextChange(value: string) {
    setText(value);
    const m = /(?:^|\s)@([\p{L}\p{N}]*)$/u.exec(value);
    setMentionQuery(m ? m[1] : null);
  }

  function applyMention(name: string) {
    setText((t) => t.replace(/(?:^|\s)@([\p{L}\p{N}]*)$/u, (full) => `${full.startsWith(" ") ? " " : ""}@${name} `));
    setMentionQuery(null);
    inputRef.current?.focus();
  }

  /** Metindeki @isim ifadelerinden kullanıcı kimliklerini çözer. */
  function resolveMentions(value: string): string[] {
    const ids: string[] = [];
    for (const m of members) {
      if (m.is_me) continue;
      if (value.toLowerCase().includes(`@${m.name.toLowerCase()}`)) ids.push(m.user_id);
    }
    return ids;
  }

  // --- Gönderme -------------------------------------------------------------
  async function send(draft?: { kind: MessageKind; attachment?: Record<string, unknown> }, override?: string) {
    const body = (override ?? text).trim();
    if (!body && !draft?.attachment) return;
    if (busy) return;
    setBusy(true); setErr(null);
    const res = await sendMessage(teamId, {
      body,
      kind: draft?.kind ?? "text",
      attachment: draft?.attachment,
      replyTo: reply?.id ?? null,
      mentions: resolveMentions(body),
    });
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? "Gönderilemedi.");
    setText(""); setReply(null); setPicker(false); setMentionQuery(null);
    inputRef.current?.focus();
  }

  // --- Dosya / fotoğraf yükleme --------------------------------------------
  async function upload(file: File, kind: MessageKind) {
    if (!meId) return;
    if (file.size > MAX_UPLOAD) return setErr("Dosya 8 MB sınırını aşıyor.");
    setUploading(true); setErr(null);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().slice(0, 8);
      const path = `${teamId}/${meId}/${crypto.randomUUID()}.${ext}`;
      // ownerFolder YOK: bu bucket'ta yol `takımId/kullanıcıId/...` biçiminde,
      // ilk klasör takım kimliği. Sahiplik kontrolünü RLS policy'si yapıyor.
      const up = await uploadToStorage(supabase, {
        bucket: "team-media", path, file, upsert: false,
        contentType: file.type || undefined,
      });
      if (!up.ok) throw new Error(up.error ?? "Dosya yüklenemedi.");
      await send(
        { kind, attachment: { path, name: file.name, size: file.size, mime: file.type } },
        kind === "image" ? "" : file.name
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yüklenemedi.");
    } finally {
      setUploading(false);
    }
  }

  async function pin(m: TeamMessage) {
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, pinned: !x.pinned } : x)));
    const res = await togglePinMessage(m.id);
    if (!res.ok) setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, pinned: m.pinned } : x)));
  }

  async function remove(m: TeamMessage) {
    if (!confirm("Mesaj silinsin mi?")) return;
    const snapshot = messages;
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    const res = await deleteMessage(m.id);
    if (!res.ok) setMessages(snapshot);
  }

  return (
    <Glass className="flex h-[64vh] min-h-[440px] flex-col overflow-hidden p-0">
      {/* Başlık */}
      <div className="flex items-center justify-between gap-2 border-b border-white/8 px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-bold">Takım Sohbeti</p>
          <p className="flex items-center gap-1 text-[10px] text-fg-muted">
            <span className={cn("h-1.5 w-1.5 rounded-full", PRESENCE_DOT.online)} />
            {onlineCount} çevrimiçi · {members.length} üye
          </p>
        </div>
        <span className={cn("flex shrink-0 items-center gap-1.5 text-[11px]", live ? "text-brand" : "text-fg-muted")}>
          <span className={cn("h-1.5 w-1.5 rounded-full", live ? "animate-pulse bg-brand" : "bg-fg-muted/50")} />
          {live ? "Canlı" : "Bağlanıyor…"}
        </span>
      </div>

      {/* Sabitlenmiş mesaj */}
      {pinned && (
        <div className="flex items-start gap-2 border-b border-white/8 bg-brand/8 px-3.5 py-2">
          <Pin size={13} className="mt-0.5 shrink-0 text-brand" />
          <p className="min-w-0 flex-1 truncate text-[11px] text-fg-muted">
            <span className="font-bold text-fg">{pinned.author.name}:</span> {pinned.body ?? "Ek"}
          </p>
          {canModerate && (
            <button onClick={() => pin(pinned)} aria-label="Sabitlemeyi kaldır" className="text-fg-muted hover:text-fg">
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Mesajlar */}
      <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="grid h-full place-items-center text-center">
            <div>
              <motion.span
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-ink-soft/70 text-fg-muted"
              >
                <Smile size={22} />
              </motion.span>
              <p className="text-sm font-semibold">Sohbet sessiz</p>
              <p className="mt-1 text-xs text-fg-muted">İlk mesajı sen yaz — fotoğraf ve dosya da paylaşabilirsin.</p>
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <Bubble
              key={m.id}
              m={m}
              mediaUrl={typeof m.attachment?.path === "string" ? mediaUrls[m.attachment.path as string] : undefined}
              grouped={
                i > 0 &&
                messages[i - 1].author.user_id === m.author.user_id &&
                withinMinutes(messages[i - 1].created_at, m.created_at, 5)
              }
              online={memberMap.get(m.author.user_id ?? "")?.presence.status !== "offline"}
              canModerate={canModerate}
              onReply={() => { setReply(m); inputRef.current?.focus(); }}
              onPin={() => pin(m)}
              onDelete={() => remove(m)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Yanıt önizleme */}
      {reply && (
        <div className="flex items-center gap-2 border-t border-white/8 px-3.5 py-2">
          <Reply size={13} className="shrink-0 text-brand" />
          <p className="min-w-0 flex-1 truncate text-[11px] text-fg-muted">
            <span className="font-bold text-fg">{reply.author.name}</span> · {reply.body ?? "ek"}
          </p>
          <button onClick={() => setReply(null)} aria-label="Yanıtı iptal et" className="text-fg-muted hover:text-fg">
            <X size={14} />
          </button>
        </div>
      )}

      {/* @bahsetme önerileri */}
      <AnimatePresence>
        {mentionCandidates.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/8"
          >
            <div className="max-h-40 overflow-y-auto p-1.5">
              {mentionCandidates.map((m) => (
                <button
                  key={m.user_id}
                  onClick={() => applyMention(m.name)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/6"
                >
                  <Avatar src={m.avatar_url} name={m.name} size={24} />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{m.name}</span>
                  <span className={cn("h-2 w-2 rounded-full", PRESENCE_DOT[m.presence.status])} />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emoji / sticker paneli */}
      <AnimatePresence>
        {picker && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-white/8"
          >
            <div className="px-3 py-2.5">
              <div className="flex flex-wrap gap-1">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setText((t) => t + e)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-lg transition-colors hover:bg-white/8"
                  >
                    {e}
                  </button>
                ))}
              </div>
              <p className="mb-1 mt-2 text-[10px] font-bold uppercase tracking-wide text-fg-muted">Sticker</p>
              <div className="flex flex-wrap gap-1.5">
                {STICKERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send({ kind: "gif", attachment: { sticker: s } }, s)}
                    className="rounded-xl border border-white/10 bg-ink-soft/60 px-2.5 py-1.5 text-lg transition-colors hover:border-brand/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Giriş */}
      <div className="border-t border-white/8 p-2.5">
        {err && <p className="mb-1.5 px-1 text-[11px] text-coral">{err}</p>}
        {uploading && (
          <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] text-brand">
            <Loader2 size={12} className="animate-spin" /> Yükleniyor…
          </p>
        )}

        {/* Gizli dosya girişleri */}
        <input
          ref={photoRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "image"); e.target.value = ""; }}
        />
        <input
          ref={fileRef} type="file" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "file"); e.target.value = ""; }}
        />

        <div className="flex items-center gap-1.5">
          <div className="no-scrollbar flex shrink-0 items-center gap-1.5 overflow-x-auto">
            <IconBtn active={picker} onClick={() => setPicker((v) => !v)} label="Emoji"><Smile size={17} /></IconBtn>
            <IconBtn onClick={() => photoRef.current?.click()} label="Fotoğraf"><ImageIcon size={16} /></IconBtn>
            <IconBtn onClick={() => fileRef.current?.click()} label="Dosya"><Paperclip size={16} /></IconBtn>
            <VoiceButton onRecorded={(f) => upload(f, "voice")} onError={setErr} />
            <IconBtn onClick={() => { onTextChange(`${text}${text.endsWith(" ") || !text ? "" : " "}@`); inputRef.current?.focus(); }} label="Bahset">
              <AtSign size={16} />
            </IconBtn>
            <IconBtn
              onClick={() => send({ kind: "workout", attachment: { shared: "workout" } }, "Bugünkü antrenmanımı paylaştım 💪")}
              label="Antrenman paylaş"
            >
              <Dumbbell size={16} />
            </IconBtn>
            <IconBtn
              onClick={() => send({ kind: "meal", attachment: { shared: "meal" } }, "Bugünkü öğünümü paylaştım 🥗")}
              label="Öğün paylaş"
            >
              <UtensilsCrossed size={16} />
            </IconBtn>
          </div>

          <input
            ref={inputRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setMentionQuery(null);
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Mesaj yaz…  @ ile bahset"
            maxLength={1000}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-soft/60 px-3 py-2 text-sm outline-none focus:border-brand/40"
          />
          <button
            onClick={() => send()}
            disabled={busy || !text.trim()}
            aria-label="Gönder"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-black transition-opacity disabled:opacity-40"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </Glass>
  );
}

function IconBtn({
  children, onClick, label, active,
}: { children: React.ReactNode; onClick: () => void; label: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors",
        active
          ? "border-brand/50 bg-brand/15 text-brand"
          : "border-white/10 bg-ink-soft/60 text-fg-muted hover:text-fg"
      )}
    >
      {children}
    </button>
  );
}

/** Sesli mesaj altyapısı — MediaRecorder ile kayıt, webm olarak yüklenir. */
function VoiceButton({
  onRecorded, onError,
}: { onRecorded: (f: File) => void; onError: (m: string) => void }) {
  const [recording, setRecording] = React.useState(false);
  const recorder = React.useRef<MediaRecorder | null>(null);
  const chunks = React.useRef<BlobPart[]>([]);

  async function start() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return onError("Bu cihazda ses kaydı desteklenmiyor.");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        if (blob.size > 0) onRecorded(new File([blob], `ses-${Date.now()}.webm`, { type: "audio/webm" }));
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      onError("Mikrofon izni verilmedi.");
    }
  }

  function stop() {
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  }

  return (
    <button
      onClick={recording ? stop : start}
      aria-label={recording ? "Kaydı bitir" : "Sesli mesaj"}
      title={recording ? "Kaydı bitir" : "Sesli mesaj"}
      className={cn(
        "relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors",
        recording
          ? "border-coral/50 bg-coral/15 text-coral"
          : "border-white/10 bg-ink-soft/60 text-fg-muted hover:text-fg"
      )}
    >
      {recording ? <Square size={14} /> : <Mic size={16} />}
      {recording && <span className="absolute inset-0 animate-ping rounded-xl bg-coral/20" />}
    </button>
  );
}

function Bubble({
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
function withinMinutes(a: string, b: string, mins: number): boolean {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) < mins * 60000;
}

/** Realtime satırını görünüm modeline çevirir. */
function toMessage(
  row: Record<string, unknown>,
  members: Map<string, TeamMemberView>,
  meId: string | null,
  prev: TeamMessage[]
): TeamMessage {
  const userId = (row.user_id as string) ?? null;
  const member = userId ? members.get(userId) : undefined;
  const replyId = (row.reply_to as string) ?? null;
  const src = replyId ? prev.find((p) => p.id === replyId) : null;
  return {
    id: row.id as string,
    body: (row.body as string) ?? null,
    kind: ((row.kind as string) ?? "text") as MessageKind,
    attachment: (row.attachment as Record<string, unknown>) ?? {},
    reply_to: replyId,
    reply_preview: src ? { name: src.author.name, body: (src.body ?? "").slice(0, 80) } : null,
    pinned: !!row.pinned,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
    author: {
      user_id: userId,
      name: member?.name ?? "Sporcu",
      avatar_url: member?.avatar_url ?? null,
    },
    is_me: !!userId && userId === meId,
  };
}
