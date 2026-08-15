"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";
import { reportError } from "@/lib/observability/report-server";

// ============================================================================
// Magic Link (şifresiz giriş) — e-posta gönderme ucu.
//
// SUNUCU ACTION'I, istemci çağrısı DEĞİL. Diğer auth işlemleri (şifreyle
// giriş, kayıt, şifre sıfırlama) istemciden `supabase.auth.*` çağırıyor;
// bu bilerek farklı: e-posta gönderen bir uç, hız sınırı olmadan iki türlü
// suistimale açık —
//   1. Tek bir adrese yüzlerce e-posta (mail bombing),
//   2. Bir betikle binlerce adrese sprey (Supabase e-posta kotası yanar,
//      alan adının gönderim itibarı düşer).
// Sınırı ancak sunucuda uygulayabiliriz.
//
// Doğrulama tarafına DOKUNULMADI: `/auth/confirm` zaten `verifyOtp`'yi
// genel olarak işliyor ve `magiclink` geçerli bir `EmailOtpType`. Yani
// bağlantıya tıklandığında mevcut akış (onboarding kontrolü, giriş olayı
// kaydı) olduğu gibi çalışıyor.
// ============================================================================

export interface MagicLinkResult {
  ok: boolean;
  error?: string;
}

/** Adres başına: aynı kutuya arka arkaya e-posta yağmasın. */
const EPOSTA_BASINA = { limit: 3, windowMs: 15 * 60_000 };
/** IP başına: tek kaynaktan çok adrese sprey atılmasın. */
const IP_BASINA = { limit: 10, windowMs: 15 * 60_000 };

function istemciIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "anon";
}

/**
 * Şifresiz giriş bağlantısı gönderir.
 *
 * Sonuç, adresin kayıtlı olup olmadığına göre DEĞİŞMEZ. Farklı mesaj
 * döndürmek, hangi e-postaların sisteme kayıtlı olduğunu dışarıdan tek tek
 * sınamaya izin verirdi (hesap sayımı / enumeration).
 */
export async function sendMagicLink(rawEmail: string): Promise<MagicLinkResult> {
  const email = String(rawEmail ?? "").trim().toLowerCase();
  // Basit biçim kontrolü — Supabase'e gitmeden önce eleyelim.
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Geçerli bir e-posta adresi gir." };
  }

  const h = await headers();
  const ip = istemciIp(h);

  const [perEmail, perIp] = await Promise.all([
    checkRateLimitAsync(`magic:email:${email}`, EPOSTA_BASINA),
    checkRateLimitAsync(`magic:ip:${ip}`, IP_BASINA),
  ]);
  if (!perEmail.ok || !perIp.ok) {
    const sn = Math.max(perEmail.retryAfterSec, perIp.retryAfterSec);
    const dk = Math.ceil(sn / 60);
    return { ok: false, error: `Çok fazla deneme. ${dk} dakika sonra tekrar dene.` };
  }

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    h.get("origin") ||
    `https://${h.get("host") ?? ""}`;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // `shouldCreateUser` varsayılan olarak true bırakıldı — BİLEREK.
        // false yapılsaydı kayıtsız adres için Supabase hata döndürürdü ve
        // bu hata "bu e-posta kayıtlı değil" bilgisini sızdırırdı. Ayrıca
        // şifresiz kayıt da çalışıyor: yeni kullanıcı bağlantıya tıklayınca
        // `/auth/confirm` onu onboarding'e yönlendiriyor.
        emailRedirectTo: `${site}/auth/callback`,
      },
    });
    if (error) {
      // Hatayı kaydet ama kullanıcıya yansıtma: mesaj içeriği adresin
      // kayıtlı olup olmadığını ele verebilir.
      await reportError(error, { where: "auth/sendMagicLink", severity: "warning" });
    }
  } catch (err) {
    await reportError(err, { where: "auth/sendMagicLink" });
  }

  // Her durumda aynı yanıt.
  return { ok: true };
}
