import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { recordLoginEvent } from "@/lib/auth/login-events";

/**
 * E-posta bağlantısı doğrulama (token_hash akışı) — SSR için önerilen yöntem.
 * PKCE kod doğrulayıcısına ihtiyaç duymaz; bu yüzden e-posta bağlantısı farklı
 * bir tarayıcıda (ör. Gmail uygulaması içi tarayıcı) açılsa bile çalışır.
 *
 * E-posta şablonlarında link şu biçimde olmalı:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      // Şifre kurtarma → doğrudan yeni şifre ekranına.
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/reset-password"}`);
      }
      // E-posta doğrulama / davet → onboarding kontrolü.
      if (user) {
        await recordLoginEvent(user.app_metadata?.provider ?? "email");
        const { data: profile } = await supabase
          .from("profiles").select("onboarding_completed").eq("id", user.id).single();
        const target = profile?.onboarding_completed ? next : "/onboarding";
        return NextResponse.redirect(`${origin}${target}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Kod (PKCE) ile geldiyse callback'e devret.
  const code = searchParams.get("code");
  if (code) return NextResponse.redirect(`${origin}/auth/callback?code=${code}&next=${encodeURIComponent(next)}`);

  return NextResponse.redirect(`${origin}/reset-password?error=expired`);
}
