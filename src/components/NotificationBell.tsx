"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { AppNotification } from "@/lib/database.types";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Bell, CheckCheck, Dumbbell, Apple, Trophy, Sparkles, Info, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  info: Info,
  workout: Dumbbell,
  nutrition: Apple,
  achievement: Trophy,
  coach: Sparkles,
} as const;

/** "3 dk önce" gibi göreli zaman (bildirimler arası tutarlılık için). */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return "az önce";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export function NotificationBell({ userId }: { userId: string }) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setItems(data as AppNotification[]);
  }, [supabase, userId]);

  // İlk yükleme + canlı güncelleme: realtime kanalı, sekme odağı ve periyodik yenileme.
  // Realtime kurulumu tamamen best-effort; hata olsa bile sayfayı asla kırmaz,
  // yoklama + odak yenileme her koşulda bildirimleri güncel tutar.
  useEffect(() => {
    void load();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          () => void load()
        )
        .subscribe();
    } catch {
      channel = null;
    }

    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    // Realtime yayını açık değilse bile güncel kalsın diye yedek yoklama.
    const interval = window.setInterval(() => void load(), 45000);

    return () => {
      try {
        if (channel) void supabase.removeChannel(channel);
      } catch {
        /* yoksay */
      }
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(interval);
    };
  }, [supabase, userId, load]);

  const unread = items.filter((n) => !n.read).length;

  async function markAll() {
    if (!unread) return;
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
  }

  async function markOne(id: string) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x)));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  }

  async function removeOne(id: string) {
    setItems((xs) => xs.filter((x) => x.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  }

  async function clearAll() {
    if (!items.length) return;
    setItems([]);
    await supabase.from("notifications").delete().eq("user_id", userId);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-ink-border text-fg-muted transition-colors hover:border-brand/50 hover:text-fg"
        aria-label={unread ? `Bildirimler (${unread} okunmamış)` : "Bildirimler"}
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[11px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Bildirimler">
        {items.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {unread > 0 && (
              <button
                onClick={() => void markAll()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-border px-3 py-1.5 text-xs font-semibold text-fg-muted transition-colors hover:border-brand/50 hover:text-fg"
              >
                <CheckCheck size={14} /> Tümünü okundu işaretle
              </button>
            )}
            <button
              onClick={() => void clearAll()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-border px-3 py-1.5 text-xs font-semibold text-fg-muted transition-colors hover:border-coral/50 hover:text-coral"
            >
              <Trash2 size={14} /> Tümünü temizle
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg-muted">
            Henüz bildirim yok. Antrenman yaptıkça burada güncellemeler görürsün. 🔔
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-0.5">
            {items.map((n) => {
              const Icon = ICONS[n.type] ?? Info;
              const inner = (
                <>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-soft text-brand">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-fg">{n.title}</p>
                      <time className="mt-0.5 shrink-0 text-[11px] uppercase tracking-wide text-fg-muted">
                        {timeAgo(n.created_at)}
                      </time>
                    </div>
                    {n.body && <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{n.body}</p>}
                  </div>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-coral" />}
                </>
              );
              const contentClass = "flex min-w-0 flex-1 gap-3 text-left";
              return (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-1 rounded-xl border p-3 transition-colors",
                    n.read ? "border-ink-border bg-transparent" : "border-brand/30 bg-brand/5"
                  )}
                >
                  {n.href ? (
                    <Link
                      href={n.href}
                      onClick={() => {
                        void markOne(n.id);
                        setOpen(false);
                      }}
                      className={contentClass}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button onClick={() => void markOne(n.id)} className={contentClass}>
                      {inner}
                    </button>
                  )}
                  <button
                    onClick={() => void removeOne(n.id)}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-fg-muted transition-colors hover:bg-fg/5 hover:text-coral"
                    aria-label="Bildirimi sil"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
