// ============================================================================
// Sosyal katman — arkadaşlık, takip, presence, canlı antrenman.
// Client + server güvenli (server-only import yok).
// ============================================================================

export type PresenceStatus = "online" | "training" | "away" | "offline";

/** Bir kullanıcının bana göre sosyal durumu. */
export type FriendState = "none" | "pending_out" | "pending_in" | "friends";

export interface PresenceInfo {
  status: PresenceStatus;
  activity: string | null;
  last_seen_at: string | null;
}

export interface SocialState {
  friend: FriendState;
  /** pending_in durumunda cevaplanacak istek kimliği. */
  request_id: string | null;
  following: boolean;
  followed_by: boolean;
}

export interface PersonView {
  user_id: string;
  name: string;
  avatar_url: string | null;
  level: number;
  total_xp: number;
  streak: number;
  presence: PresenceInfo;
}

export interface FriendView extends PersonView {
  since: string | null;
  same_team: boolean;
}

export interface FriendRequestView {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
  /** true → ben gönderdim (giden istek) */
  outgoing: boolean;
}

export interface LiveParticipant {
  user_id: string;
  name: string;
  avatar_url: string | null;
  joined_at: string;
}

export interface LiveSessionView {
  id: string;
  title: string;
  status: "live" | "ended";
  started_at: string;
  ended_at: string | null;
  total_xp: number;
  host: { user_id: string | null; name: string; avatar_url: string | null };
  participants: LiveParticipant[];
  im_in: boolean;

  // --- Workout Party v2 (0044) ---
  /** null → arkadaş partisi (takıma bağlı değil). */
  team_id?: string | null;
  /** Aktivite anahtarı (bkz. `lib/workout/calories.ts`). */
  activity?: string;
  /** Kalori tahmininde kullanılan MET katsayısı. */
  met?: number;
}

export interface TeamPulse {
  online_now: number;
  active_today: number;
  active_week: number;
  participation_pct: number;
  live_session: string | null;
}

export interface TeamSeriesPoint {
  d: string;
  xp: number;
  workouts: number;
  minutes: number;
  calories: number;
  volume_kg: number;
  active_users: number;
}

export const PRESENCE_LABEL: Record<PresenceStatus, string> = {
  online: "Çevrimiçi",
  training: "Antrenmanda",
  away: "Uzakta",
  offline: "Çevrimdışı",
};

export const PRESENCE_DOT: Record<PresenceStatus, string> = {
  online: "bg-brand",
  training: "bg-[#FFB020]",
  away: "bg-[#8FE3FF]",
  offline: "bg-fg-muted/40",
};

/** last_seen_at'ten çevrimiçi durumu türetir (2 dk eşiği). */
export function derivePresence(
  status: string | null | undefined,
  lastSeen: string | null | undefined,
  activity?: string | null
): PresenceInfo {
  if (!lastSeen) return { status: "offline", activity: null, last_seen_at: null };
  const fresh = Date.now() - new Date(lastSeen).getTime() < 2 * 60 * 1000;
  const s = (status ?? "online") as PresenceStatus;
  return {
    status: fresh ? (s === "offline" ? "online" : s) : "offline",
    activity: fresh ? (activity ?? null) : null,
    last_seen_at: lastSeen,
  };
}

/** "3 dk önce görüldü" biçiminde son görülme metni. */
export function lastSeenText(p: PresenceInfo): string {
  if (p.status !== "offline") return p.activity ? `${PRESENCE_LABEL[p.status]} · ${p.activity}` : PRESENCE_LABEL[p.status];
  if (!p.last_seen_at) return "Çevrimdışı";
  const mins = Math.floor((Date.now() - new Date(p.last_seen_at).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} dk önce`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} gün önce`;
  return "Uzun süredir yok";
}
