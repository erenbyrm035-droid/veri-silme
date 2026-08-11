// ============================================================================
// Battle Pass — paylaşılan tipler ve sabitler.
//
// `season.ts` sunucuya özel (`server-only`); istemci bileşenleri (BattlePass.tsx)
// tipleri ve ikon eşlemesini BURADAN alır. Aynı dosyada tutulsalardı istemci
// paketi `createAdminClient`'ı içeri çekmeye çalışır ve derleme kırılırdı.
// ============================================================================

export type RewardType = "coins" | "xp" | "badge" | "premium_days" | "frame";

export interface SeasonReward {
  type: RewardType;
  value: number;
  label: string;
  icon?: string;
}

export interface SeasonTrack {
  id: string;
  tier: number;
  req_xp: number;
  unlocked: boolean;
  free_reward: SeasonReward | null;
  premium_reward: SeasonReward | null;
  free_claimed: boolean;
  premium_claimed: boolean;
  free_claimable: boolean;
  premium_claimable: boolean;
}

export interface SeasonInfo {
  id: string;
  number: number;
  name: string;
  theme: string | null;
  starts_on: string;
  ends_on: string;
  days_left: number;
}

export interface SeasonState {
  active: boolean;
  season: SeasonInfo | null;
  season_xp: number;
  is_premium: boolean;
  tier: number;
  max_tier: number;
  /** Bir sonraki kademe için gereken sezon XP'si (yoksa null = zirvedesin). */
  next_req_xp: number | null;
  tracks: SeasonTrack[];
}

export const REWARD_ICON: Record<RewardType, string> = {
  coins: "🪙", xp: "⚡", badge: "🏅", premium_days: "👑", frame: "🖼️",
};

export const REWARD_TYPE_LABEL: Record<RewardType, string> = {
  coins: "Coin", xp: "XP", badge: "Rozet", premium_days: "Premium gün", frame: "Çerçeve",
};
