import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { RewardCatalogItem, RewardClaim } from "@/lib/database.types";

// ============================================================================
// Ödül Merkezi — kullanıcı tarafı okuma
//
// Uygunluk kontrolü veritabanında (`reward_eligibility`) yapılır; arayüz
// yalnızca sonucu gösterir. Böylece kural tek yerde tanımlı kalır ve
// istemciden atlatılamaz.
// ============================================================================

export interface RewardView extends RewardCatalogItem {
  eligible: boolean;
  reasons: string[];
  claimed: boolean;
  claimStatus: string | null;
  couponIssued: string | null;
}

export interface RewardsPage {
  rewards: RewardView[];
  coins: number;
  level: number;
  totalXp: number;
  history: (RewardClaim & { reward_name: string; reward_icon: string | null })[];
}

/** Katalog + kullanıcı bakiyesi + uygunluk + talep geçmişi. */
export async function getRewardsPage(userId: string): Promise<RewardsPage> {
  const supabase = await createClient();

  const [{ data: catalog }, { data: gam }, { data: claims }] = await Promise.all([
    supabase
      .from("reward_catalog")
      .select("*")
      .eq("enabled", true)
      .order("featured", { ascending: false })
      .order("sort_order"),
    supabase
      .from("user_gamification")
      .select("coins, level, total_xp")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("reward_claims")
      .select("*, reward_catalog(name, icon)")
      .eq("user_id", userId)
      .order("claimed_at", { ascending: false })
      .limit(50),
  ]);

  const items = (catalog as RewardCatalogItem[]) ?? [];
  const claimRows = (claims as (RewardClaim & { reward_catalog: { name: string; icon: string | null } | null })[]) ?? [];

  // Uygunluk: her ödül için tek RPC. Katalog küçük olduğu için paralel çağrı yeterli.
  const eligibility = await Promise.all(
    items.map(async (r) => {
      const { data } = await supabase.rpc("reward_eligibility", { p_user: userId, p_reward: r.id });
      const row = (Array.isArray(data) ? data[0] : data) as { eligible: boolean; reasons: string[] } | null;
      return { id: r.id, eligible: !!row?.eligible, reasons: row?.reasons ?? [] };
    })
  );
  const eligById = new Map(eligibility.map((e) => [e.id, e]));
  const claimByReward = new Map(claimRows.map((c) => [c.reward_id, c]));

  const rewards: RewardView[] = items.map((r) => {
    const e = eligById.get(r.id);
    const c = claimByReward.get(r.id);
    return {
      ...r,
      eligible: e?.eligible ?? false,
      reasons: e?.reasons ?? [],
      claimed: !!c,
      claimStatus: c?.status ?? null,
      couponIssued: c?.coupon_issued ?? null,
    };
  });

  return {
    rewards,
    coins: Number(gam?.coins ?? 0),
    level: Number(gam?.level ?? 1),
    totalXp: Number(gam?.total_xp ?? 0),
    history: claimRows.map((c) => ({
      ...c,
      reward_name: c.reward_catalog?.name ?? "Ödül",
      reward_icon: c.reward_catalog?.icon ?? null,
    })),
  };
}
