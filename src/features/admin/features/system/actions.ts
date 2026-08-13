"use server";

import { revalidateTag, revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/admin/features/users/guard";
import { CATALOG_TAGS } from "@/lib/data/catalog";

// ============================================================================
// Katalog önbelleğini elle temizleme.
//
// NEDEN VAR: Katalog (egzersiz/kas/program) `unstable_cache` ile 1 saat
// saklanıyor ve normalde admin bir kayıt kaydettiğinde otomatik düşüyor.
// Ama içerik doğrudan VERİTABANINDAN değiştiğinde (SQL Editor'den migration,
// toplu güncelleme) uygulama bunu bilemez ve bayat veriyi 1 saat gösterir.
//
// Bu düğme olmadan tek çare beklemek ya da sahte bir kayıt düzenlemekti.
// ============================================================================

export interface CacheResult { ok: boolean; error?: string; cleared?: string[] }

export async function clearCatalogCache(): Promise<CacheResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Yetkiniz yok." };
  }

  const cleared: string[] = [];
  for (const [ad, tag] of Object.entries(CATALOG_TAGS)) {
    revalidateTag(tag);
    cleared.push(ad);
  }
  // Katalog gösteren kullanıcı sayfaları da yenilensin.
  revalidatePath("/exercises");
  revalidatePath("/anatomy");
  revalidatePath("/programs/hazir");

  return { ok: true, cleared };
}
