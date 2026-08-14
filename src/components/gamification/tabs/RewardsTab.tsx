"use client";

import Link from "next/link";
import { Gift, Coins, ChevronRight } from "lucide-react";
import type { RewardCatalogItem, RewardClaim } from "@/lib/database.types";

export function RewardsTab({ rewards }: { rewards: { catalog: RewardCatalogItem[]; coins: number; claims: RewardClaim[] } }) {
  // Ödül akışı /rewards sayfasına taşındı (Ödül Merkezi). Burada yalnızca
  // bakiye ve yönlendirme kalır; talep mantığı tek yerde (atomik RPC) yaşıyor.
  const available = rewards.catalog.length;
  const owned = rewards.claims.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-ink-border bg-ink-card p-4">
        <p className="text-sm text-fg-muted">Coin bakiyen</p>
        <span className="inline-flex items-center gap-1.5 text-lg font-bold text-amber-400">
          <Coins size={18} /> {rewards.coins.toLocaleString("tr-TR")}
        </span>
      </div>

      <Link
        href="/rewards"
        className="flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-4 transition-colors hover:border-brand/60"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
          <Gift size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Ödül Merkezi</p>
          <p className="text-xs text-fg-muted">
            {available} ödül · {owned > 0 ? `${owned} talebin var` : "henüz talebin yok"}
          </p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-brand" />
      </Link>

      <p className="text-center text-xs text-fg-muted">
        Coin; XP, başarım ve haftalık görevlerden kazanılır. (Gerçek para ödülü yoktur.)
      </p>
    </div>
  );
}
