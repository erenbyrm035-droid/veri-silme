import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Storage yükleme yardımcısı — TEŞHİS EDİLEBİLİR HATA.
//
// SORUN: Supabase Storage bir yüklemeyi reddettiğinde tek bir mesaj döner:
//
//     "new row violates row-level security policy"
//
// Bu mesaj DÖRT tamamen farklı durumun hepsinde aynıdır:
//   1. Oturum yok / süresi dolmuş (auth.uid() null)
//   2. Başka kullanıcının klasörüne yazılmaya çalışılıyor
//   3. Admin yetkisi gerekiyor ama kullanıcı admin değil
//   4. upsert ile var olan dosyanın üzerine yazılıyor ama UPDATE policy yok
//
// Kullanıcı da geliştirici de bu mesajdan hangisi olduğunu ANLAYAMAZ. Saatler
// yanlış yerde aranarak geçer. Bu modül, yüklemeden ÖNCE ucuz kontrolleri
// yapıp durumu ayırt ediyor ve hatayı ne yapılması gerektiğini söyleyen bir
// cümleye çeviriyor.
//
// Mevcut mimariyi DEĞİŞTİRMEZ: aynı `supabase.storage.from(...).upload()`
// çağrısını yapar, sadece etrafını sarar.
// ============================================================================

export interface UploadOptions {
  bucket: string;
  path: string;
  file: Blob | File | ArrayBuffer;
  upsert?: boolean;
  contentType?: string;
  cacheControl?: string;
  /**
   * Yolun ilk klasörü kullanıcı kimliği olmalıysa true.
   * (body-photos, posture-photos, meal-photos, avatars bu desende.)
   */
  ownerFolder?: boolean;
}

export interface UploadResult {
  ok: boolean;
  path?: string;
  error?: string;
  /** Hata sınıfı — günlüğe yazmak ve test etmek için. */
  reason?: "no_session" | "wrong_folder" | "rls" | "not_found" | "too_large" | "other";
}

/**
 * Ham Storage hatasını anlaşılır bir cümleye çevirir.
 *
 * Saf fonksiyon — ağ yok, test edilebilir.
 */
export function explainStorageError(
  message: string,
  ctx: { bucket: string; path: string; upsert?: boolean; hasSession: boolean }
): { error: string; reason: NonNullable<UploadResult["reason"]> } {
  const m = message.toLowerCase();

  if (m.includes("bucket not found") || m.includes("does not exist")) {
    return {
      reason: "not_found",
      error:
        `"${ctx.bucket}" adlı depolama alanı bulunamadı. ` +
        `Veritabanı migration'ları eksik olabilir (supabase/migrations/0048).`,
    };
  }

  if (m.includes("payload too large") || m.includes("exceeded the maximum")) {
    return { reason: "too_large", error: "Dosya boyutu sunucu sınırını aşıyor." };
  }

  if (m.includes("row-level security") || m.includes("violates") || m.includes("unauthorized")) {
    if (!ctx.hasSession) {
      return {
        reason: "no_session",
        error: "Oturumun sona ermiş görünüyor. Sayfayı yenileyip tekrar dene.",
      };
    }
    if (ctx.upsert) {
      return {
        reason: "rls",
        error:
          "Bu dosyanın üzerine yazma izni yok. Aynı isimde bir dosya zaten var " +
          `ve "${ctx.bucket}" için güncelleme kuralı tanımlı değil ` +
          `(supabase/migrations/0048_storage_rls_fix.sql çalıştırılmalı).`,
      };
    }
    return {
      reason: "rls",
      error:
        `Bu konuma yükleme izni yok: ${ctx.bucket}/${ctx.path}. ` +
        `Dosya yolu kendi kullanıcı klasörünle başlamalı ya da bu işlem yönetici yetkisi gerektiriyor.`,
    };
  }

  return { reason: "other", error: message };
}

/**
 * Oturumu doğrular, yükler, hatayı açıklar.
 *
 * NEDEN ÖNCE OTURUM KONTROLÜ: RLS reddi ile süresi dolmuş oturum aynı hatayı
 * üretiyor. Yüklemeden önce tek bir `getUser()` çağrısı bu ikisini kesin
 * olarak ayırıyor — ve bu çağrı zaten yereldeki çerezden okunuyor, pahalı değil.
 */
export async function uploadToStorage(
  supabase: SupabaseClient,
  opts: UploadOptions
): Promise<UploadResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;

  if (!uid) {
    return {
      ok: false,
      reason: "no_session",
      error: "Yükleme için giriş yapmış olman gerekiyor. Sayfayı yenileyip tekrar dene.",
    };
  }

  // Klasör sahipliği kuralı olan bucket'larda yolu önden doğrula.
  // Bu kontrol sunucudaki RLS'in YERİNE GEÇMEZ — onu tekrar eder ki hata,
  // ağa çıkmadan ve anlaşılır biçimde yakalansın.
  if (opts.ownerFolder) {
    const firstFolder = opts.path.split("/")[0];
    if (firstFolder !== uid) {
      return {
        ok: false,
        reason: "wrong_folder",
        error:
          "Dosya yolu kendi kullanıcı klasörünle başlamıyor; yükleme reddedilirdi. " +
          "(Bu bir uygulama hatası, lütfen bildir.)",
      };
    }
  }

  const { error } = await supabase.storage.from(opts.bucket).upload(opts.path, opts.file, {
    upsert: opts.upsert ?? false,
    contentType: opts.contentType,
    cacheControl: opts.cacheControl ?? "3600",
  });

  if (error) {
    const explained = explainStorageError(error.message, {
      bucket: opts.bucket,
      path: opts.path,
      upsert: opts.upsert,
      hasSession: true,
    });
    return { ok: false, ...explained };
  }

  return { ok: true, path: opts.path };
}
