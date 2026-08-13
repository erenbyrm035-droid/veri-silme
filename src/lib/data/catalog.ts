import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import type { Exercise, Muscle } from "@/lib/database.types";

// ============================================================================
// Katalog önbelleği — DEĞİŞMEYEN içerik.
//
// SORUN: Egzersiz kütüphanesi (500+ satır), kas listesi ve hazır program
// kataloğu her sayfa isteğinde Supabase'den yeniden çekiliyordu. 63 dosyada
// `force-dynamic` vardı, tek bir `revalidate`/`unstable_cache` yoktu. Bu içerik
// günde belki bir kez admin panelinden değişiyor; her istekte sorgulamak hem
// gecikme hem de boşuna DB yükü.
//
// NEDEN `createAdminClient`: `unstable_cache` çerez okuyan bir fonksiyonu
// SARAMAZ (Next hata verir) — oturumlu istemci çerez okur. Bu veriler zaten
// herkese açık katalog (kullanıcıya göre değişmiyor), dolayısıyla oturumsuz
// istemciyle çekmek doğru ve güvenli.
//
// GEÇERSİZ KILMA: Admin içerik düzenlediğinde `revalidateTag(CATALOG_TAGS.x)`
// çağrılır (bkz. `features/admin/.../actions.ts`). Ayrıca 1 saatlik zaman
// aşımı güvenlik ağı olarak durur — bir tag unutulursa içerik en fazla 1 saat
// bayat kalır, sonsuza kadar değil.
// ============================================================================

export const CATALOG_TAGS = {
  exercises: "catalog:exercises",
  muscles: "catalog:muscles",
  programs: "catalog:programs",
} as const;

/** Katalog için makul tavan: içerik değişince tag ile zaten temizlenir. */
const ONE_HOUR = 3600;

/**
 * HATA YUTMA YASAK — bu fonksiyonlar ÖNBELLEĞE ALINIYOR.
 *
 * Eskiden hepsi `return (data ?? []) as T[]` yapıyordu: sorgu hata verirse
 * `data` null gelir, fonksiyon sessizce BOŞ DİZİ döndürür ve `unstable_cache`
 * o boş diziyi 1 SAAT saklardı. Yani anlık bir hata (migration sırasında tablo
 * kilidi, ağ kesintisi, yetki sorunu) sayfayı bir saat boyunca "0 kayıt"
 * gösterir hale getiriyordu — üstelik hiçbir yerde iz bırakmadan.
 *
 * Şimdi hata THROW ediliyor. `unstable_cache` throw eden bir çağrının
 * sonucunu önbelleğe ALMAZ; sayfa o an hata gösterir (`error.tsx` devrede) ve
 * bir sonraki istekte kendiliğinden düzelir. Geçici hata kalıcı boşluğa
 * dönüşemez.
 */
function ensure<T>(data: T[] | null, error: { message: string } | null, ne: string): T[] {
  if (error) throw new Error(`Katalog yüklenemedi (${ne}): ${error.message}`);
  return data ?? [];
}

/** Tüm egzersizler — kütüphane listesi. */
export const getCachedExercises = unstable_cache(
  async (): Promise<Exercise[]> => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("exercises")
      .select("*")
      .order("muscle_group")
      .order("name");
    return ensure<Exercise>(data as Exercise[] | null, error, "egzersizler");
  },
  ["catalog-exercises"],
  { tags: [CATALOG_TAGS.exercises], revalidate: ONE_HOUR }
);

/** Kas listesi — anatomi haritası. */
export const getCachedMuscles = unstable_cache(
  async (): Promise<Muscle[]> => {
    const admin = createAdminClient();
    const { data, error } = await admin.from("muscles").select("*").order("sort_order");
    return ensure<Muscle>(data as Muscle[] | null, error, "kaslar");
  },
  ["catalog-muscles"],
  { tags: [CATALOG_TAGS.muscles], revalidate: ONE_HOUR }
);

export interface ProgramCategoryRow {
  id: string; slug: string; name: string; sort_order: number;
}

/** Hazır program kategorileri — filtre çubuğu. */
export const getCachedProgramCategories = unstable_cache(
  async (): Promise<ProgramCategoryRow[]> => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("program_categories")
      .select("id, slug, name, sort_order")
      .order("sort_order");
    return ensure<ProgramCategoryRow>(data as ProgramCategoryRow[] | null, error, "program kategorileri");
  },
  ["catalog-program-categories"],
  { tags: [CATALOG_TAGS.programs], revalidate: ONE_HOUR }
);
