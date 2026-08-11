import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Premium rozeti — kullanıcı adının yanında taç.
 *
 * `premium_badge` FeatureKey'inin gerçek karşılığı. Daha önce bu anahtar
 * yalnızca fiyat sayfasında bir satırdı; hiçbir yerde gösterilmiyordu.
 * Sunucu tarafında üretilir (istemciye yalnızca boolean gider) — abonelik
 * durumu istemciye sızmaz.
 */
export function PremiumCrown({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <Crown
      size={size}
      aria-label="Premium üye"
      className={cn("shrink-0 fill-[#FFD34D] text-[#FFD34D]", className)}
    />
  );
}
