// Konsolide egzersiz medya çözümleyici + dosya-adı normalleştirme.
// Client + server güvenli (yan etkisiz).
import type { ExerciseMediaSet } from "@/lib/database.types";

// Görsel route sürümü — CDN cache'ini kırmak için. Route mantığı değişince artır.
export const THUMB_VERSION = "3";
/** Bir egzersiz için otomatik görsel URL'i (sürümlü — cache-bust). */
export function thumbUrl(id: string): string {
  return `/api/exercise-thumb/${id}?v=${THUMB_VERSION}`;
}
/** Kayıtlı eski görsel URL'lerine sürüm ekler (cache-bust). */
export function bustThumb(url: string | null | undefined): string {
  if (!url) return "";
  return url.includes("/api/exercise-thumb/") && !url.includes("?v=") ? `${url}?v=${THUMB_VERSION}` : url;
}

/** Türkçe + tire/boşluk toleranslı normalizasyon (otomatik eşleştirme için). */
export function normalizeMediaKey(s: string): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", İ: "i" };
  return s
    .split("").map((c) => map[c] ?? c).join("")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Dosya adı anahtarını egzersiz listesiyle token-örtüşme skoruna göre eşleştirir.
 * Türkçe-İngilizce karışık adlarda ("Eğik Dumbbell Press") kısmi örtüşmeyi yakalar.
 */
export function bestExerciseMatch<T extends { key: string }>(
  baseKey: string, entries: T[]
): T | null {
  const tokens = baseKey.split("-").filter((t) => t.length >= 2);
  if (tokens.length === 0) return null;

  // Tam eşleşme önce
  const exact = entries.find((e) => e.key === baseKey);
  if (exact) return exact;

  let best: { entry: T; score: number; lenDiff: number } | null = null;
  for (const e of entries) {
    const exTokens = e.key.split("-").filter((t) => t.length >= 2);
    if (exTokens.length === 0) continue;
    const inter = tokens.filter((t) => exTokens.includes(t)).length;
    if (inter === 0) continue;
    const coverage = inter / tokens.length;         // dosya kelimelerinin ne kadarı egzersizde var
    const revCoverage = inter / exTokens.length;     // egzersiz kelimelerinin ne kadarı dosyada var
    // Tek kelimelik dosya adı için tam token eşleşmesi şart (yanlış eşleşmeyi önle)
    if (tokens.length === 1 && !(exTokens.includes(tokens[0]) && exTokens.length <= 2)) continue;
    if (tokens.length > 1 && coverage < 0.5) continue;
    const score = coverage * 0.7 + revCoverage * 0.3;
    const lenDiff = Math.abs(exTokens.length - tokens.length);
    if (!best || score > best.score || (score === best.score && lenDiff < best.lenDiff)) {
      best = { entry: e, score, lenDiff };
    }
  }
  return best?.entry ?? null;
}

export type ResolvedKind = "gif" | "video" | "thumbnail" | "none";
export interface ResolvedMedia { kind: ResolvedKind; url: string | null; poster: string | null; }

/**
 * Öncelik: GIF → Video → Thumbnail → (none = default image).
 * Cinsiyet varyantı varsa önce onu, yoksa genel medyayı kullanır.
 */
export function resolveExerciseMedia(
  set: Partial<ExerciseMediaSet> | null | undefined,
  fallback?: { gif_url?: string | null; image_url?: string | null; video_url?: string | null },
  gender?: "male" | "female" | null
): ResolvedMedia {
  const pick = (variant: string | null | undefined, generic: string | null | undefined) =>
    (variant && variant.trim()) || (generic && generic.trim()) || null;

  const gif = gender === "female"
    ? pick(set?.female_gif, set?.gif_url ?? fallback?.gif_url)
    : gender === "male"
      ? pick(set?.male_gif, set?.gif_url ?? fallback?.gif_url)
      : pick(set?.gif_url ?? fallback?.gif_url, set?.male_gif ?? set?.female_gif);

  const video = gender === "female"
    ? pick(set?.female_video, set?.video_url ?? fallback?.video_url)
    : gender === "male"
      ? pick(set?.male_video, set?.video_url ?? fallback?.video_url)
      : pick(set?.video_url ?? fallback?.video_url, set?.male_video ?? set?.female_video);

  const thumb = pick(set?.thumbnail_url, fallback?.image_url);

  if (gif) return { kind: "gif", url: gif, poster: thumb };
  if (video) return { kind: "video", url: video, poster: thumb };
  if (thumb) return { kind: "thumbnail", url: thumb, poster: null };
  return { kind: "none", url: null, poster: null };
}

/** Dosya uzantısı + cinsiyet önekinden hedef medya slotunu belirler. */
export function slotForFilename(filename: string): { slot: keyof ExerciseMediaSet | null; baseKey: string } {
  const lower = filename.toLowerCase();
  const ext = lower.split(".").pop() ?? "";
  let base = filename.replace(/\.[^.]+$/, "");
  let gender: "male" | "female" | null = null;
  const gm = base.match(/^(male|erkek|female|kadin|kadın)[-_\s]+/i);
  if (gm) {
    gender = /female|kadin|kadın/i.test(gm[1]) ? "female" : "male";
    base = base.slice(gm[0].length);
  }
  const baseKey = normalizeMediaKey(base);
  const isGif = ext === "gif";
  const isVideo = ext === "mp4" || ext === "webm" || ext === "mov";
  const isImg = ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp" || ext === "avif";

  let slot: keyof ExerciseMediaSet | null = null;
  if (isGif) slot = gender === "male" ? "male_gif" : gender === "female" ? "female_gif" : "gif_url";
  else if (isVideo) slot = gender === "male" ? "male_video" : gender === "female" ? "female_video" : "video_url";
  else if (isImg) slot = "thumbnail_url";
  return { slot, baseKey };
}
