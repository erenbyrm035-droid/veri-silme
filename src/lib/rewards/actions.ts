"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability/report-server";

export interface ClaimResult {
  ok: boolean;
  error?: string;
  reasons?: string[];
  status?: string;
  coupon?: string | null;
  spentCoins?: number;
}

/**
 * Ödül talep eder.
 *
 * Tüm iş kuralı (uygunluk, coin düşümü, stok azaltma, kayıt, bildirim)
 * `claim_reward()` RPC'si içinde TEK transaction'da çalışır — yarış koşulu ve
 * yarım kalmış işlem riski yok. Bu katman yalnızca çağırıp sonucu çevirir.
 */
export async function claimRewardById(rewardId: string): Promise<ClaimResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };

  try {
    const { data, error } = await supabase.rpc("claim_reward", { p_reward: rewardId });
    if (error) return { ok: false, error: error.message };

    const r = (data ?? {}) as Record<string, unknown>;
    if (!r.ok) {
      return {
        ok: false,
        error: (r.error as string) ?? "Talep alınamadı.",
        reasons: (r.reasons as string[]) ?? undefined,
      };
    }

    revalidatePath("/rewards");
    revalidatePath("/gamification");
    revalidatePath("/profile");

    return {
      ok: true,
      status: (r.status as string) ?? "pending",
      coupon: (r.coupon as string) ?? null,
      spentCoins: Number(r.spent_coins ?? 0),
    };
  } catch (err) {
    await reportError(err, { where: "rewards/claimRewardById", userId: user.id });
    return { ok: false, error: "Talep alınamadı." };
  }
}
