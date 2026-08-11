import "server-only";
import { checkRateLimitAsync } from "./rate-limit";

// ============================================================================
// Server action hız sınırı.
//
// SORUN: Server action'lar dışarıdan doğrudan POST edilebilir — UI'daki
// "gönder" düğmesini disable etmek koruma DEĞİLDİR. 25 dosyadaki yazma
// action'larının hiçbirinde sınır yoktu; bir betik saniyede yüzlerce gönderi
// açabilirdi.
//
// API route'ları `checkRateLimitAsync`'i zaten kullanıyor; bu sarmalayıcı aynı
// altyapıyı action'lara taşıyor (Upstash varsa dağıtık, yoksa in-memory).
// ============================================================================

export interface ActionLimit {
  /** Pencere içindeki azami istek. */
  limit: number;
  /** Pencere uzunluğu (ms). */
  windowMs: number;
}

/** Yazma yoğunluğuna göre hazır profiller. */
export const LIMITS = {
  /** Gönderi, yorum, mesaj — insan hızının çok üstünde bir tavan. */
  post: { limit: 30, windowMs: 60_000 },
  /** Tepki/beğeni — hızlı tıklanabilir, daha geniş. */
  reaction: { limit: 120, windowMs: 60_000 },
  /** Pahalı ya da geri alınamaz işlemler (ödül talebi, savaş açma). */
  sensitive: { limit: 10, windowMs: 60_000 },
  /** Davet/bildirim üreten işlemler — spam yüzeyi. */
  invite: { limit: 15, windowMs: 5 * 60_000 },
} as const satisfies Record<string, ActionLimit>;

export interface GuardResult {
  ok: boolean;
  error?: string;
  retryAfterSec?: number;
}

/**
 * Bir server action'ı kullanıcı başına sınırlar.
 *
 * @param key    Action'ı ayırt eden sabit ad (örn. "feed:post")
 * @param userId Oturumdaki kullanıcı
 */
export async function guardAction(
  key: string,
  userId: string,
  limit: ActionLimit = LIMITS.post
): Promise<GuardResult> {
  const rl = await checkRateLimitAsync(`act:${key}:${userId}`, limit);
  if (rl.ok) return { ok: true };
  return {
    ok: false,
    retryAfterSec: rl.retryAfterSec,
    error:
      rl.retryAfterSec > 60
        ? `Çok fazla istek. ${Math.ceil(rl.retryAfterSec / 60)} dakika sonra tekrar dene.`
        : `Çok hızlı gidiyorsun. ${rl.retryAfterSec} saniye sonra tekrar dene.`,
  };
}
