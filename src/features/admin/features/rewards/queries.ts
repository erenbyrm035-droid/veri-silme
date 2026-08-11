import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { RewardCatalogItem } from "@/lib/database.types";

export interface AdminClaimRow {
  id: string;
  status: string;
  claimed_at: string;
  spent_coins: number;
  admin_note: string | null;
  coupon_issued: string | null;
  decided_at: string | null;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  reward_id: string;
  reward_name: string;
  reward_icon: string | null;
  fulfillment_type: string;
}

export interface RewardStats {
  total_rewards: number;
  active_rewards: number;
  total_claims: number;
  pending_claims: number;
  delivered_claims: number;
  rejected_claims: number;
  spent_coins: number;
}

export interface TopReward { name: string; claims: number }
export interface TopUser { name: string; claims: number; coins: number }

export interface RewardsAdminData {
  rewards: RewardCatalogItem[];
  claims: AdminClaimRow[];
  stats: RewardStats;
  topRewards: TopReward[];
  topUsers: TopUser[];
  daily: { d: string; claims: number }[];
}

const num = (v: unknown, f = 0) => (Number.isFinite(Number(v)) ? Number(v) : f);

/** Admin Ödül Merkezi — katalog + talepler + istatistikler tek geçişte. */
export async function getRewardsAdmin(): Promise<RewardsAdminData> {
  const supabase = createAdminClient();

  const [{ data: rewards }, { data: claims }, { data: statsRaw }] = await Promise.all([
    supabase.from("reward_catalog").select("*")
      .order("featured", { ascending: false }).order("sort_order"),
    supabase.from("reward_claims")
      .select("id, status, claimed_at, spent_coins, admin_note, coupon_issued, decided_at, user_id, reward_id")
      .order("claimed_at", { ascending: false })
      .limit(500),
    supabase.rpc("reward_stats"),
  ]);

  const claimRows = (claims as Record<string, unknown>[]) ?? [];
  const rewardRows = (rewards as RewardCatalogItem[]) ?? [];

  // Kullanıcı adlarını tek sorguda çöz
  const userIds = [...new Set(claimRows.map((c) => c.user_id as string))];
  const { data: profs } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds)
    : { data: [] as unknown };
  const profMap = new Map(
    ((profs as { id: string; full_name: string | null; avatar_url: string | null }[]) ?? [])
      .map((p) => [p.id, p])
  );
  const rewardMap = new Map(rewardRows.map((r) => [r.id, r]));

  const rows: AdminClaimRow[] = claimRows.map((c) => {
    const r = rewardMap.get(c.reward_id as string);
    const p = profMap.get(c.user_id as string);
    return {
      id: c.id as string,
      status: (c.status as string) ?? "pending",
      claimed_at: c.claimed_at as string,
      spent_coins: num(c.spent_coins),
      admin_note: (c.admin_note as string) ?? null,
      coupon_issued: (c.coupon_issued as string) ?? null,
      decided_at: (c.decided_at as string) ?? null,
      user_id: c.user_id as string,
      user_name: p?.full_name ?? "Sporcu",
      user_avatar: p?.avatar_url ?? null,
      reward_id: c.reward_id as string,
      reward_name: r?.name ?? "Ödül",
      reward_icon: r?.icon ?? null,
      fulfillment_type: r?.fulfillment_type ?? "digital",
    };
  });

  const s = (Array.isArray(statsRaw) ? statsRaw[0] : statsRaw) as Record<string, unknown> | null;
  const stats: RewardStats = {
    total_rewards: num(s?.total_rewards),
    active_rewards: num(s?.active_rewards),
    total_claims: num(s?.total_claims),
    pending_claims: num(s?.pending_claims),
    delivered_claims: num(s?.delivered_claims),
    rejected_claims: num(s?.rejected_claims),
    spent_coins: num(s?.spent_coins),
  };

  // En popüler ödüller
  const byReward = new Map<string, number>();
  for (const r of rows) byReward.set(r.reward_name, (byReward.get(r.reward_name) ?? 0) + 1);
  const topRewards: TopReward[] = [...byReward.entries()]
    .map(([name, claims]) => ({ name, claims }))
    .sort((a, b) => b.claims - a.claims)
    .slice(0, 5);

  // En çok talep eden kullanıcılar
  const byUser = new Map<string, { claims: number; coins: number }>();
  for (const r of rows) {
    const cur = byUser.get(r.user_name) ?? { claims: 0, coins: 0 };
    cur.claims += 1;
    cur.coins += r.spent_coins;
    byUser.set(r.user_name, cur);
  }
  const topUsers: TopUser[] = [...byUser.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.claims - a.claims)
    .slice(0, 5);

  // Son 14 günün talep dağılımı
  const dayMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    dayMap.set(d, 0);
  }
  for (const r of rows) {
    const d = r.claimed_at?.slice(0, 10);
    if (d && dayMap.has(d)) dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
  }
  const daily = [...dayMap.entries()].map(([d, claims]) => ({ d, claims }));

  return { rewards: rewardRows, claims: rows, stats, topRewards, topUsers, daily };
}
