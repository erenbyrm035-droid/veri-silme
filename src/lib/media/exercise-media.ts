// ============================================================================
// Egzersiz medya çözümleyici (kendi medya sistemimiz — GIF öncelikli).
// media_type: gif | animation | video. İlk sürümde yalnızca 'gif' aktif.
// GIF kaynağı: exercises.gif_url varsa o; yoksa slug'dan exercise-media
// public bucket yolu türetilir (dosyayı <slug>.gif olarak yükle → otomatik gösterilir).
// Client + server tarafında güvenle kullanılır.
// ============================================================================

/** Egzersiz için gösterilecek GIF URL'sini çözer (yoksa null → placeholder). */
export function resolveExerciseGif(ex: {
  gif_url?: string | null;
  slug?: string | null;
}): string | null {
  if (ex.gif_url) return ex.gif_url;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (base && ex.slug) {
    return `${base}/storage/v1/object/public/exercise-media/${ex.slug}.gif`;
  }
  return null;
}
