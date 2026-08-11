"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { heartbeat } from "./actions";
import type { PresenceStatus } from "./types";

const HEARTBEAT_MS = 45_000;

/**
 * Kullanıcının çevrimiçi durumunu canlı tutar.
 * Sekme arka plana alındığında duraklar, geri gelince hemen bildirir.
 */
export function usePresenceHeartbeat(teamId: string | null, status: PresenceStatus = "online") {
  React.useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const beat = () => {
      if (stopped || document.visibilityState !== "visible") return;
      void heartbeat({ status, teamId });
    };

    beat();
    timer = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [teamId, status]);
}

/**
 * Takım verisini canlı tutar: akış, tepki, yorum, görev, etkinlik, canlı oturum
 * ve presence değişimlerinde sunucu bileşenlerini tazeler.
 *
 * `router.refresh()` çağrıları toplanır (debounce) — saniyede onlarca olay
 * gelse bile tek bir yenileme yapılır.
 */
export function useTeamLiveData(teamId: string, opts?: { onNewPost?: () => void; enabled?: boolean }) {
  const router = useRouter();
  const [connected, setConnected] = React.useState(false);
  const onNewPost = opts?.onNewPost;
  const enabled = opts?.enabled ?? true;

  const pending = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = React.useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => { pending.current = null; router.refresh(); }, 1200);
  }, [router]);

  React.useEffect(() => {
    if (!enabled || !teamId) return;
    const supabase = createClient();
    const teamFilter = `team_id=eq.${teamId}`;

    const channel: RealtimeChannel = supabase
      .channel(`team-live-${teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_posts", filter: teamFilter },
        (payload) => { if (payload.eventType === "INSERT") onNewPost?.(); refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "team_post_reactions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_post_comments" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_quests", filter: teamFilter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_events", filter: teamFilter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_live_sessions", filter: teamFilter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_live_participants" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, refresh)
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      if (pending.current) clearTimeout(pending.current);
      supabase.removeChannel(channel);
    };
  }, [teamId, enabled, refresh, onNewPost]);

  return { connected };
}

export interface LiveNotice {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  created_at: string;
}

/**
 * Kullanıcıya gelen bildirimleri canlı dinler.
 * Ekranda gösterilen liste en fazla 4 öğe tutar; her biri 6 sn sonra düşer.
 */
export function useLiveNotifications(userId: string | null) {
  const [notices, setNotices] = React.useState<LiveNotice[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setNotices((n) => n.filter((x) => x.id !== id));
  }, []);

  React.useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notify-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const r = payload.new as Record<string, unknown>;
          const notice: LiveNotice = {
            id: (r.id as string) ?? crypto.randomUUID(),
            title: (r.title as string) ?? "Bildirim",
            body: (r.body as string) ?? null,
            href: (r.href as string) ?? null,
            created_at: (r.created_at as string) ?? new Date().toISOString(),
          };
          setNotices((n) => [notice, ...n].slice(0, 4));
          setTimeout(() => dismiss(notice.id), 6000);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, dismiss]);

  return { notices, dismiss };
}

/** Bir zaman damgasından itibaren canlı akan süre (sa:dk:sn). */
export function useElapsed(startIso: string | null | undefined): string {
  const [, tick] = React.useReducer((x: number) => x + 1, 0);

  React.useEffect(() => {
    if (!startIso) return;
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startIso]);

  if (!startIso) return "00:00";
  const secs = Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
