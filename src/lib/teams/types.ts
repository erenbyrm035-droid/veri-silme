// ============================================================================
// Takımlar (Topluluk) — paylaşılan tipler. Client + server güvenli.
// ============================================================================

import type {
  FriendRequestView, FriendView, LiveSessionView, PresenceInfo, SocialState,
  TeamPulse, TeamSeriesPoint,
} from "@/lib/social/types";
// --- Takım savaşları (0045) -------------------------------------------------
// NOT: Bu tipler `lib/teams/battles.ts` yerine burada duruyor çünkü orası
// `server-only`. İstemci bileşenleri (TeamBattles.tsx) etiketleri ve tipleri
// buradan alır; sunucu katmanı da aynı kaynağı kullanır.

export type BattleMetric = "xp" | "workouts" | "minutes" | "volume_kg" | "steps";
export type BattleStatus = "pending" | "active" | "finished" | "declined";

export const BATTLE_METRIC_LABEL: Record<BattleMetric, string> = {
  xp: "XP", workouts: "Antrenman", minutes: "Dakika",
  volume_kg: "Hacim (kg)", steps: "Adım",
};

/** Savaş açılabilecek takımın özet kartı. */
export interface Opponent {
  id: string; name: string; slug: string;
  logo_url: string | null; color: string | null; badge: string | null;
}

export interface BattleSide extends Opponent {
  score: number;
}

export interface BattleView {
  id: string;
  metric: BattleMetric;
  status: BattleStatus;
  starts_at: string;
  ends_at: string;
  us: BattleSide;
  them: BattleSide;
  /** Kazanan takım kimliği; berabere veya devam ediyorsa null. */
  winner_id: string | null;
  /** Bu takım kazandı mı? (bitmemişse null) */
  we_won: boolean | null;
  /** Savaşı bu takım mı açtı? (bekleyen daveti kim yanıtlayacak) */
  is_challenger: boolean;
}

export type TeamRole = "owner" | "admin" | "moderator" | "member";
export type JoinPolicy = "open" | "request" | "invite";
export type PostKind =
  | "post" | "workout" | "badge" | "streak" | "level_up" | "member_joined" | "quest" | "xp"
  | "live_workout" | "nutrition" | "steps";
export type ReactionKind = "like" | "fire" | "clap";
export type MessageKind = "text" | "image" | "gif" | "file" | "voice" | "workout" | "meal";
export type QuestMetric =
  | "workouts" | "steps" | "xp" | "minutes" | "volume_kg" | "water_ml" | "active_days";
export type EventKind = "challenge" | "meetup" | "live" | "monthly";
export type BadgeTierT = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Kurucu", admin: "Yönetici", moderator: "Moderatör", member: "Üye",
};
export const ROLE_RANK: Record<TeamRole, number> = { owner: 4, admin: 3, moderator: 2, member: 1 };

export const QUEST_METRIC_LABEL: Record<QuestMetric, string> = {
  workouts: "Antrenman", steps: "Adım", xp: "XP", minutes: "Dakika",
  volume_kg: "Hacim (kg)", water_ml: "Su (ml)", active_days: "Aktif Gün",
};

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  challenge: "Meydan Okuma", meetup: "Buluşma", live: "Canlı", monthly: "Ayın Etkinliği",
};

export const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "like", emoji: "❤️", label: "Beğen" },
  { kind: "fire", emoji: "🔥", label: "Motivasyon" },
  { kind: "clap", emoji: "👏", label: "Tebrik" },
];

export interface TeamSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  color: string | null;
  badge: string | null;
  city: string | null;
  country: string | null;
  level: number;
  visibility: string;
  join_policy: JoinPolicy;
  member_limit: number;
  created_at: string;
  owner_id: string | null;
  member_count: number;
  total_xp: number;
  weekly_xp: number;
  rank: number;
  is_member: boolean;
  my_role: TeamRole | null;
}

export interface TeamStats {
  member_count: number;
  total_xp: number;
  weekly_xp: number;
  workouts: number;
  minutes: number;
  calories: number;
  steps: number;
  active_days_avg: number;
  level: number;
}

export interface TeamMemberView {
  user_id: string;
  name: string;
  avatar_url: string | null;
  role: TeamRole;
  level: number;
  total_xp: number;
  weekly_xp: number;
  streak: number;
  joined_at: string;
  is_me: boolean;
  /** Çevrimiçi durumu + son görülme. */
  presence: PresenceInfo;
  /** Bana göre arkadaşlık/takip durumu. */
  social: SocialState;
  /** Kazandığı başarım rozeti sayısı. */
  badges: number;
  /** Takımın haftalık XP'sine katkı yüzdesi (0-100). */
  contribution: number;
  /** Premium rozeti gösterilsin mi? */
  is_premium: boolean;
}

export interface PostAuthor {
  user_id: string | null;
  name: string;
  avatar_url: string | null;
  /** `premium_badge` özelliği — adın yanında taç gösterilir. */
  is_premium?: boolean;
}

export type PostVisibility = "team" | "friends" | "public";

export interface TeamPost {
  id: string;
  kind: PostKind;
  body: string | null;
  meta: Record<string, unknown>;
  is_system: boolean;
  pinned: boolean;
  created_at: string;
  author: PostAuthor;
  reactions: Record<ReactionKind, number>;
  my_reactions: ReactionKind[];
  comment_count: number;
  comments: TeamComment[];

  // --- Kişisel akış (0044) ---
  /** Gönderi kapsamı. Takım gönderilerinde daima "team". */
  visibility?: PostVisibility;
  /** Takıma ait gönderilerde takım adı — kişisel akışta bağlam göstermek için. */
  team_name?: string | null;
  team_slug?: string | null;
}

export const VISIBILITY_LABEL: Record<PostVisibility, string> = {
  team: "Takımım", friends: "Arkadaşlarım", public: "Herkese açık",
};

export interface TeamComment {
  id: string;
  body: string;
  created_at: string;
  author: PostAuthor;
}

export interface TeamMessage {
  id: string;
  body: string | null;
  kind: MessageKind;
  attachment: Record<string, unknown>;
  reply_to: string | null;
  reply_preview: { name: string; body: string } | null;
  pinned: boolean;
  created_at: string;
  author: PostAuthor;
  is_me: boolean;
}

export interface TeamQuest {
  id: string;
  title: string;
  description: string | null;
  metric: QuestMetric;
  target: number;
  progress: number;
  reward_xp: number;
  reward_badge: string | null;
  starts_on: string;
  ends_on: string | null;
  status: string;
  completed_at: string | null;
}

export interface TeamBadgeView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  tier: BadgeTierT;
  earned: boolean;
  awarded_at: string | null;
}

export interface TeamEvent {
  id: string;
  title: string;
  description: string | null;
  kind: EventKind;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  participants: number;
  im_going: boolean;
}

export interface JoinRequestView {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  message: string | null;
  created_at: string;
}

/** Takım hub'ının tüm verisi. */
export interface TeamHub {
  team: TeamSummary;
  stats: TeamStats;
  members: TeamMemberView[];
  owner: PostAuthor | null;
  admins: PostAuthor[];
  mvp: TeamMemberView | null;
  posts: TeamPost[];
  messages: TeamMessage[];
  quests: TeamQuest[];
  badges: TeamBadgeView[];
  events: TeamEvent[];
  joinRequests: JoinRequestView[];
  myRole: TeamRole | null;
  inviteCode: string | null;

  // --- Sosyal katman (0039) ---
  /** Anlık aktiflik göstergeleri. */
  pulse: TeamPulse;
  /** Son 30 günlük istatistik serisi (grafikler). */
  series: TeamSeriesPoint[];
  /** Aktif "birlikte antrenman" oturumu. */
  live: LiveSessionView | null;
  /** Arkadaş listem. */
  friends: FriendView[];
  /** Bekleyen arkadaşlık istekleri (gelen + giden). */
  friendRequests: FriendRequestView[];
  /** Oturumdaki kullanıcının kimliği (istemci tarafı eşleştirmeler için). */
  meId: string;

  // --- Takım savaşları (0045) ---
  /** Aktif, bekleyen ve geçmiş savaşlar. */
  battles: BattleView[];
  /** Meydan okunabilecek takımlar (yalnızca yöneticilere gösterilir). */
  battleOpponents: Opponent[];
}

/** Takım seviyesi eşiği — seviye n için gereken toplam XP. */
export function teamXpForLevel(level: number): number {
  return Math.pow(Math.max(1, level - 1), 2) * 500;
}

/** Bir sonraki seviyeye ilerleme (0-1). */
export function teamLevelProgress(totalXp: number, level: number): number {
  const cur = teamXpForLevel(level);
  const next = teamXpForLevel(level + 1);
  if (next <= cur) return 1;
  return Math.max(0, Math.min(1, (totalXp - cur) / (next - cur)));
}

export const TIER_RING: Record<BadgeTierT, string> = {
  bronze: "ring-[#CD7F32]/60 text-[#E0955C]",
  silver: "ring-[#C9D2DC]/60 text-[#C9D2DC]",
  gold: "ring-[#FFD34D]/60 text-[#FFD34D]",
  platinum: "ring-[#8FE3FF]/60 text-[#8FE3FF]",
  diamond: "ring-[#C084FC]/60 text-[#C084FC]",
};
