import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordLoginEvent } from "@/lib/auth/login-events";

/**
 * E-posta doğrulama / OAuth sonrası dönüş noktası.
 * Kodu oturuma çevirir ve uygun sayfaya yönlendirir.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Onboarding tamamlanmadıysa oraya yönlendir.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await recordLoginEvent(user.app_metadata?.provider ?? "oauth");
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .single();
        const target = profile?.onboarding_completed ? next : "/onboarding";
        return NextResponse.redirect(`${origin}${target}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
