import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieItem = { name: string; value: string; options?: CookieOptions };

/** Herkese açık (giriş gerektirmeyen) rotalar. */
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/auth",
  "/api/billing/iyzico/callback", // iyzico sunucudan (oturumsuz) POST eder
  "/api/billing/revenuecat",      // RevenueCat webhook (oturumsuz, server-to-server)
  "/api/billing/webhook",         // Genel ödeme webhook'u (imza ile doğrulanır)
  "/api/teams/event-reminders",   // Vercel Cron (CRON_SECRET ile doğrulanır)
  "/api/maintenance",             // Bakım cron'ları (CRON_SECRET ile doğrulanır)
  // Yasal sayfalar — oturumsuz erişilebilir (iyzico/App Store incelemesi için)
  "/terms", "/privacy", "/support", "/contact", "/about",
  "/mesafeli-satis", "/iptal-iade", "/fiyatlar",
  "/veri-silme.html",
  "/offline",
  "/manifest.webmanifest",
  "/sw.js",
];

function isPublic(pathname: string) {
  return PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );
}

/**
 * Oturumu yeniler ve korumalı rotalara erişimi denetler.
 *
 * ORTAM DEĞİŞKENİ YOKSA NE OLUR — bu blok eskiden koşulsuz olarak isteği
 * geçiriyordu ("ilk kurulumda engel olmasın" diye). Sonucu şuydu: Supabase
 * değişkenleri eksik ya da yanlış adlandırılmışsa kimlik doğrulama kapısının
 * TAMAMI sessizce devre dışı kalıyor, /dashboard dahil her korumalı sayfa
 * herkese açılıyordu. Ne hata, ne log, ne bir işaret. E2E testleri bunu
 * yakaladı.
 *
 * Artık ortama göre ayrışıyor:
 *   - geliştirme: eskisi gibi geçirilir (ilk kurulum engellenmesin),
 *   - üretim: KAPALI tarafa düşer — korumalı rota giriş sayfasına atılır ve
 *     yapılandırma hatası loglanır. Yanlış yapılandırma yüzünden veri
 *     açığa çıkmaktansa uygulamanın giriş ekranında takılması yeğdir.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV !== "production") return response;

    console.error(
      "[middleware] Supabase ortam değişkenleri eksik — kimlik doğrulama " +
        "kapısı çalışamıyor. NEXT_PUBLIC_SUPABASE_URL / " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlayın."
    );
    const { pathname } = request.nextUrl;
    if (isPublic(pathname)) return response;
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieItem[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Giriş yapmamış kullanıcı korumalı rotaya erişemez.
  if (!user && !isPublic(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // İKİ ADIMLI DOĞRULAMA — oturum ikinci adımı geçti mi?
  //
  // Şifreyle giriş oturumu `aal1`de bırakır. Kullanıcının doğrulanmış bir
  // faktörü varsa Supabase `nextLevel`i `aal2` bildirir; aradaki fark "bu
  // oturum henüz kodu girmedi" demektir.
  let mfaBekliyor = false;
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    mfaBekliyor = !!aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2";
  }

  // Kod girilmeden korumalı sayfaya geçilemez. Kontrol yalnızca giriş
  // sayfasında yapılsaydı kullanıcı doğrudan /dashboard yazarak kod ekranını
  // atlardı; kapı bu yüzden burada, her istekte.
  if (user && mfaBekliyor && !isPublic(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("mfa", "1");
    return NextResponse.redirect(redirectUrl);
  }

  // Giriş yapmış kullanıcı login/register görürse dashboard'a yönlenir.
  // MFA BEKLERKEN YÖNLENDİRİLMEZ: aksi halde /dashboard → /login → /dashboard
  // sonsuz döngüsü oluşur ve kullanıcı kod ekranını hiç göremez.
  if (user && !mfaBekliyor && (pathname === "/login" || pathname === "/register")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  // Admin paneli: yalnızca admin/editor rolüne sahip kullanıcılar erişebilir.
  if (user && pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, admin_role")
      .eq("id", user.id)
      .single();
    const hasAccess =
      profile?.is_admin ||
      ["super_admin", "admin", "editor"].includes(profile?.admin_role ?? "");
    if (!hasAccess) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}
