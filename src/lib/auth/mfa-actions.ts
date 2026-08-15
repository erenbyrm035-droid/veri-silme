"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";
import { reportError } from "@/lib/observability/report-server";

// ============================================================================
// İki adımlı doğrulama (TOTP) — Supabase MFA API'si üzerinden.
//
// Yeni tablo/şema GEREKMİYOR: faktörleri Supabase kendi tarafında tutuyor.
//
// SUNUCU ACTION'I, istemci çağrısı değil — kod doğrulama ucu kaba kuvvete
// açık. Altı haneli bir kodun 10^6 olasılığı var; sınırsız denemeyle
// dakikalar içinde kırılır. Sınır ancak sunucuda uygulanabilir.
//
// KURTARMA KODU YOK — bilinçli sınır. Supabase TOTP'de yerleşik kurtarma
// kodu üretmiyor; kendi tablomuzu yazmak (hash'lenmiş saklama, tek kullanımlık
// tüketme, sıfırlama akışı) ayrı ve dikkat isteyen bir iş. Yarım bir kurtarma
// akışı hiç olmamasından tehlikelidir. Kullanıcı arayüzde açıkça uyarılıyor;
// gerekçe docs/guvenlik-notlari.md'de.
// ============================================================================

export interface MfaResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

const fail = (e: string): MfaResult<never> => ({ ok: false, error: e });

/** Kod deneme sınırı — kaba kuvvete karşı. */
const DOGRULAMA = { limit: 8, windowMs: 5 * 60_000 };
/** Kayıt başlatma sınırı — boşuna faktör üretilmesin. */
const KAYIT = { limit: 5, windowMs: 15 * 60_000 };

async function istemciAnahtari(userId: string): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "anon";
  return `${userId}:${ip}`;
}

export interface MfaDurum {
  /** Doğrulanmış en az bir faktör var mı. */
  etkin: boolean;
  /** Doğrulanmamış (yarım kalmış) faktör kimliği — varsa kayıt sürdürülebilir. */
  bekleyenFactorId: string | null;
  factorId: string | null;
}

/** Kullanıcının MFA durumunu okur. */
export async function mfaDurumu(): Promise<MfaResult<MfaDurum>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Oturum bulunamadı.");

  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return fail("Faktörler okunamadı.");

  // `data.totp` YALNIZCA doğrulanmışları içeriyor (tip: Factor<'totp','verified'>[]).
  // Yarım kalmış kayıtları görmek için `data.all` gerekiyor.
  const dogrulanmis = (data?.totp ?? [])[0];
  const bekleyen = (data?.all ?? []).find(
    (f) => f.factor_type === "totp" && f.status !== "verified"
  );

  return {
    ok: true,
    data: {
      etkin: !!dogrulanmis,
      factorId: dogrulanmis?.id ?? null,
      bekleyenFactorId: bekleyen?.id ?? null,
    },
  };
}

export interface KayitBilgisi {
  factorId: string;
  /** QR kodun SVG/data-URI hâli — kullanıcı uygulamayla tarar. */
  qr: string;
  /** QR taranamıyorsa elle girilecek anahtar. */
  gizliAnahtar: string;
}

/**
 * TOTP kaydını başlatır: QR ve gizli anahtar üretir.
 *
 * Henüz AKTİF DEĞİL — kullanıcı `mfaDogrula` ile bir kod girene kadar faktör
 * `unverified` kalır. Bu ara durum kasıtlı: kullanıcı QR'ı taramadan
 * uygulamadan çıkarsa hesabı kilitlenmesin.
 */
export async function mfaKayitBaslat(): Promise<MfaResult<KayitBilgisi>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Oturum bulunamadı.");

  const rl = await checkRateLimitAsync(`mfa:enroll:${await istemciAnahtari(user.id)}`, KAYIT);
  if (!rl.ok) return fail(`Çok fazla deneme. ${Math.ceil(rl.retryAfterSec / 60)} dakika sonra tekrar dene.`);

  try {
    // Yarım kalmış faktör varsa önce temizle — aksi halde her denemede yeni
    // bir `unverified` faktör birikir.
    const mevcut = await supabase.auth.mfa.listFactors();
    for (const f of mevcut.data?.all ?? []) {
      if (f.factor_type === "totp" && f.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Viva ${new Date().toLocaleDateString("tr-TR")}`,
    });
    if (error || !data) {
      await reportError(error ?? new Error("enroll boş"), { where: "mfa/enroll", severity: "warning" });
      return fail("İki adımlı doğrulama başlatılamadı.");
    }

    return {
      ok: true,
      data: {
        factorId: data.id,
        qr: data.totp.qr_code,
        gizliAnahtar: data.totp.secret,
      },
    };
  } catch (err) {
    await reportError(err, { where: "mfa/enroll" });
    return fail("İki adımlı doğrulama başlatılamadı.");
  }
}

/**
 * Kodu doğrular. Kayıt sırasında çağrılırsa faktörü aktifleştirir; girişte
 * çağrılırsa oturumu aal2'ye yükseltir.
 */
export async function mfaDogrula(factorId: string, kod: string): Promise<MfaResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Oturum bulunamadı.");

  const temiz = String(kod ?? "").replace(/\D/g, "");
  if (temiz.length !== 6) return fail("Kod 6 haneli olmalı.");

  // KABA KUVVET KORUMASI — biçim kontrolünden sonra, Supabase'e gitmeden önce.
  const rl = await checkRateLimitAsync(`mfa:verify:${await istemciAnahtari(user.id)}`, DOGRULAMA);
  if (!rl.ok) {
    return fail(`Çok fazla hatalı deneme. ${Math.ceil(rl.retryAfterSec / 60)} dakika sonra tekrar dene.`);
  }

  try {
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !ch) return fail("Doğrulama başlatılamadı.");

    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: ch.id,
      code: temiz,
    });
    // Hata mesajı Supabase'den geldiği gibi yansıtılmıyor: içerik faktör
    // durumunu ele verebilir. Kullanıcıya tek ve sabit mesaj.
    if (error) return fail("Kod doğrulanamadı. Uygulamandaki güncel kodu gir.");

    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "mfa/verify" });
    return fail("Kod doğrulanamadı.");
  }
}

/**
 * İki adımlı doğrulamayı kapatır.
 *
 * Supabase bu işlem için oturumun aal2 olmasını ister — yani kullanıcı ancak
 * kodunu girdikten sonra kapatabilir. Bu doğru davranış: çalınan bir aal1
 * oturumu korumayı tek tıkla kaldıramamalı.
 */
export async function mfaKapat(factorId: string): Promise<MfaResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Oturum bulunamadı.");

  try {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      return fail(
        "Kapatılamadı. Bu işlem için önce oturumunda kodunu doğrulamış olman gerekir."
      );
    }
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "mfa/unenroll" });
    return fail("Kapatılamadı.");
  }
}

export interface AalDurum {
  /** Oturum aal2'ye yükseltilmeli mi (kullanıcının doğrulanmış faktörü var). */
  gerekli: boolean;
  factorId: string | null;
}

/**
 * Girişten sonra kod ekranı gösterilmeli mi?
 *
 * Şifreyle giriş oturumu `aal1`de bırakır. Kullanıcının doğrulanmış bir
 * faktörü varsa Supabase `nextLevel`i `aal2` olarak bildirir — aradaki fark
 * "bu oturum henüz ikinci adımı geçmedi" demektir.
 */
export async function mfaGerekliMi(): Promise<MfaResult<AalDurum>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Oturum bulunamadı.");

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return { ok: true, data: { gerekli: false, factorId: null } };

  const gerekli = data.nextLevel === "aal2" && data.currentLevel !== "aal2";
  if (!gerekli) return { ok: true, data: { gerekli: false, factorId: null } };

  const { data: f } = await supabase.auth.mfa.listFactors();
  return { ok: true, data: { gerekli: true, factorId: (f?.totp ?? [])[0]?.id ?? null } };
}
