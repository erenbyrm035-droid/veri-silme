import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { RewardType, SeasonReward, SeasonState } from "./season-types";

export type {
  RewardType, SeasonReward, SeasonTrack, SeasonInfo, SeasonState,
} from "./season-types";
export { REWARD_ICON, REWARD_TYPE_LABEL } from "./season-types";

// ============================================================================
// Battle Pass — sezon durumu.
//
// Tüm ağır iş `season_state()` RPC'sinde (migration 0045): sezon penceresi,
// sezon XP'si, kademe hesabı ve talep durumları tek SQL geçişinde çözülür.
// Burada yalnızca tip güvenli dönüşüm yapılır.
// ============================================================================

const EMPTY: SeasonState = {
  active: false, season: null, season_xp: 0, is_premium: false,
  tier: 0, max_tier: 0, next_req_xp: null, tracks: [],
};

/** Boş `{}` ödülü "ödül yok" demektir — null'a çevrilir. */
function toReward(raw: unknown): SeasonReward | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!r.type) return null;
  return {
    type: (r.type as RewardType) ?? "badge",
    value: Number(r.value) || 0,
    label: (r.label as string) ?? "Ödül",
    icon: (r.icon as string) ?? undefined,
  };
}

export async function getSeasonState(userId: string): Promise<SeasonState> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("season_state", { p_user: userId });
  if (error) {
    console.error("[season] season_state hatası:", error.message);
    return EMPTY;
  }
  const s = (data ?? {}) as Record<string, unknown>;
  if (!s.active) return EMPTY;

  const season = (s.season ?? {}) as Record<string, unknown>;
  const tracks = ((s.tracks as Record<string, unknown>[]) ?? []).map((t) => ({
    id: t.id as string,
    tier: Number(t.tier) || 0,
    req_xp: Number(t.req_xp) || 0,
    unlocked: !!t.unlocked,
    free_reward: toReward(t.free_reward),
    premium_reward: toReward(t.premium_reward),
    free_claimed: !!t.free_claimed,
    premium_claimed: !!t.premium_claimed,
    free_claimable: !!t.free_claimable,
    premium_claimable: !!t.premium_claimable,
  }));

  return {
    active: true,
    season: {
      id: season.id as string,
      number: Number(season.number) || 1,
      name: (season.name as string) ?? "Sezon",
      theme: (season.theme as string) ?? null,
      starts_on: season.starts_on as string,
      ends_on: season.ends_on as string,
      days_left: Number(season.days_left) || 0,
    },
    season_xp: Number(s.season_xp) || 0,
    is_premium: !!s.is_premium,
    tier: Number(s.tier) || 0,
    max_tier: Number(s.max_tier) || 0,
    next_req_xp: s.next_req_xp == null ? null : Number(s.next_req_xp),
    tracks: tracks.sort((a, b) => a.tier - b.tier),
  };
}
