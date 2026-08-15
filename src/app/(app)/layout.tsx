import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SideNav } from "@/components/SideNav";
import { BottomNav } from "@/components/BottomNav";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { PremiumProvider } from "@/lib/premium/context";
import { getEntitlements } from "@/lib/premium/entitlements";
import { WelcomeTour } from "@/components/WelcomeTour";
import { SmartImage } from "@/components/ui/SmartImage";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // E-posta doğrulaması: e-posta/şifre ile kayıt olup doğrulamamışsa panele girme.
  const provider = user.app_metadata?.provider;
  if (provider === "email" && !user.email_confirmed_at) {
    redirect("/verify-email");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, is_admin, avatar_url, full_name, is_premium, membership_type, premium_until")
    .eq("id", user.id)
    .single();

  // Profil onboarding'i tamamlamadıysa yönlendir.
  if (!profile?.onboarding_completed) redirect("/onboarding");

  const ent = getEntitlements(profile ?? undefined);
  const premiumSnapshot = {
    plan: ent.plan,
    isPremium: ent.isPremium,
    features: [...ent.features],
    premiumUntil: ent.premiumUntil,
  };

  return (
    <PremiumProvider value={premiumSnapshot}>
    <WelcomeTour userId={user.id} fullName={profile?.full_name ?? null} />
    <div className="flex min-h-[100dvh]">
      <SideNav isAdmin={!!profile?.is_admin} userId={user.id} />
      <main id="icerik" tabIndex={-1} className="px-safe w-full min-w-0 flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0">
        {/* Mobil üst bar — notch/Dynamic Island payı ile */}
        <div className="pt-bar-safe sticky top-0 z-30 flex items-center justify-between border-b border-ink-border bg-ink/80 px-5 pb-3 backdrop-blur md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold">
            <span className="grid h-8 w-8 -rotate-6 place-items-center rounded-lg rounded-br-[2px] bg-brand font-black text-black">
              <span className="rotate-6">V</span>
            </span>
            Viva
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell userId={user.id} />
            <ThemeToggle />
            <Link href="/profile" aria-label="Profil">
              {profile?.avatar_url ? (
                <SmartImage
                  src={profile.avatar_url}
                  alt={profile.full_name ?? "Profil"}
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full border border-ink-border object-cover"
                />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full bg-ink-soft text-xs font-bold text-fg-muted">
                  {(profile?.full_name ?? "V").charAt(0).toUpperCase()}
                </span>
              )}
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-5 py-6 md:py-8">{children}</div>
      </main>
      <BottomNav />
    </div>
    </PremiumProvider>
  );
}
