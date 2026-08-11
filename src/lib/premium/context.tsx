"use client";

import * as React from "react";
import type { FeatureKey, PlanId } from "./plans";

/** İstemci tarafına taşınan (serileştirilebilir) yetki özeti. */
export interface PremiumSnapshot {
  plan: PlanId;
  isPremium: boolean;
  features: FeatureKey[];
  premiumUntil: string | null;
}

const FREE_SNAPSHOT: PremiumSnapshot = { plan: "free", isPremium: false, features: [], premiumUntil: null };

const PremiumContext = React.createContext<PremiumSnapshot>(FREE_SNAPSHOT);

export function PremiumProvider({ value, children }: { value: PremiumSnapshot; children: React.ReactNode }) {
  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

/** İstemci bileşenlerinde premium durumunu okur. */
export function usePremium(): PremiumSnapshot {
  return React.useContext(PremiumContext);
}

/** Belirli bir premium özelliğe erişim var mı? */
export function useFeature(feature: FeatureKey): boolean {
  return React.useContext(PremiumContext).features.includes(feature);
}
