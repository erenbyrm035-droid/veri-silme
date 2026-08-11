// Basit sliding-window rate limit.
// Varsayılan: in-memory (instance başına). Yatay ölçekte (çok Vercel lambda)
// tam doğruluk için Upstash Redis'e geçilmeli — arayüz aynı kalır.
// UPSTASH_REDIS_REST_URL varsa ileride oraya yönlendirilecek şekilde tasarlandı.

interface Bucket { hits: number[]; }
const store = new Map<string, Bucket>();

export interface RateLimitOptions { limit: number; windowMs: number; }
export interface RateLimitResult { ok: boolean; remaining: number; retryAfterSec: number; limit: number; }

/** Anahtar başına pencere içindeki isteği sayar. */
export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowStart = now - opts.windowMs;
  let bucket = store.get(key);
  if (!bucket) { bucket = { hits: [] }; store.set(key, bucket); }
  // Pencere dışındakileri temizle
  bucket.hits = bucket.hits.filter((t) => t > windowStart);

  if (bucket.hits.length >= opts.limit) {
    const oldest = bucket.hits[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + opts.windowMs - now) / 1000));
    return { ok: false, remaining: 0, retryAfterSec, limit: opts.limit };
  }
  bucket.hits.push(now);
  return { ok: true, remaining: opts.limit - bucket.hits.length, retryAfterSec: 0, limit: opts.limit };
}

/**
 * Dağıtık rate limit — Upstash Redis (REST) yapılandırılmışsa onu, aksi halde
 * in-memory sürümü kullanır. Çok-instance (Vercel) ortamında doğru sayım sağlar.
 * Sabit pencere (fixed-window) sayacı; hata halinde in-memory'ye düşer (fail-safe).
 */
export async function checkRateLimitAsync(key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return checkRateLimit(key, opts);

  try {
    const now = Date.now();
    const bucket = Math.floor(now / opts.windowMs);
    const rkey = `rl:${key}:${bucket}`;
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify([["INCR", rkey], ["PEXPIRE", rkey, String(opts.windowMs), "NX"]]),
      cache: "no-store",
    });
    if (!res.ok) return checkRateLimit(key, opts);
    const data = (await res.json()) as { result: number }[];
    const count = Number(data?.[0]?.result ?? 0);
    const resetMs = (bucket + 1) * opts.windowMs - now;
    if (count > opts.limit) return { ok: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil(resetMs / 1000)), limit: opts.limit };
    return { ok: true, remaining: Math.max(0, opts.limit - count), retryAfterSec: 0, limit: opts.limit };
  } catch {
    return checkRateLimit(key, opts); // ağ hatası → yerel sayaca düş
  }
}

/** İstemci kimliği: userId varsa onu, yoksa IP'yi kullanır. */
export function clientKey(req: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const h = req.headers;
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "anon";
  return `ip:${ip}`;
}

/** 429 yanıtı üretir. */
export function tooManyRequests(retryAfterSec: number): Response {
  return new Response(
    JSON.stringify({ error: "Çok fazla istek. Lütfen biraz sonra tekrar deneyin." }),
    { status: 429, headers: { "content-type": "application/json", "retry-after": String(retryAfterSec) } }
  );
}

// Sızıntıyı önlemek için periyodik temizlik (uzun ömürlü instance'lar için).
if (typeof setInterval !== "undefined") {
  const iv = setInterval(() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [k, b] of store) {
      b.hits = b.hits.filter((t) => t > cutoff);
      if (b.hits.length === 0) store.delete(k);
    }
  }, 10 * 60 * 1000);
  // Node'da process'in kapanmasını engellememesi için unref (varsa).
  (iv as unknown as { unref?: () => void }).unref?.();
}
