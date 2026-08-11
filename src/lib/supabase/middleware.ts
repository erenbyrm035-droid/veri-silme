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
 * Ortam değişkenleri yoksa (örn. ilk kurulum) sessizce geçiş yapar.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

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

  // Giriş yapmış kullanıcı login/register görürse dashboard'a yönlenir.
  if (user && (pathname === "/login" || pathname === "/register")) {
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
