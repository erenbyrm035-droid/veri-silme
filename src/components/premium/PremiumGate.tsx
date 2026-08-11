"use client";

import * as React from "react";
import Link from "next/link";
import { Lock, Crown } from "lucide-react";
import { useFeature } from "@/lib/premium/context";
import { FEATURE_LABELS, type FeatureKey } from "@/lib/premium/plans";

/**
 * Premium özellik kapısı. Kullanıcının hakkı varsa children gösterilir;
 * yoksa kilitli bir önizleme + "Premium'a Yükselt" çağrısı gösterilir.
 *
 * - `mode="overlay"` (varsayılan): children'ı bulanıklaştırıp üstüne kilit koyar.
 * - `mode="replace"`: children yerine kompakt bir kilit kartı gösterir.
 */
export function PremiumGate({
  feature,
  children,
  mode = "overlay",
  title,
  description,
}: {
  feature: FeatureKey;
  children?: React.ReactNode;
  mode?: "overlay" | "replace";
  title?: string;
  description?: string;
}) {
  const unlocked = useFeature(feature);
  if (unlocked) return <>{children}</>;

  const label = title ?? FEATURE_LABELS[feature];
  const desc = description ?? "Bu özellik Premium üyeliğe özeldir.";

  if (mode === "replace") {
    return <LockCard label={label} desc={desc} />;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="pointer-events-none select-none blur-[6px] saturate-50" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-ink/40 backdrop-blur-[2px]">
        <LockCard label={label} desc={desc} compact />
      </div>
    </div>
  );
}

function LockCard({ label, desc, compact }: { label: string; desc: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-3 rounded-2xl border border-brand/30 bg-ink-card/90 p-5 text-center ${compact ? "max-w-[260px]" : ""}`}>
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/15 text-brand">
        <Lock size={20} />
      </span>
      <div>
        <p className="font-semibold">{label}</p>
        <p className="mt-1 text-xs text-fg-muted">{desc}</p>
      </div>
      <Link
        href="/premium"
        className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90"
      >
        <Crown size={15} /> Premium'a Yükselt
      </Link>
    </div>
  );
}

/** Küçük "PRO" rozeti — kilitli özelliklerin yanında ipucu olarak. */
export function ProBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-bold text-brand ${className}`}>
      <Crown size={10} /> PRO
    </span>
  );
}
