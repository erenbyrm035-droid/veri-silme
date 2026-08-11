import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MENU_NAV } from "@/lib/nav";
import { User, Settings, Shield, LogOut, ChevronRight, type LucideIcon } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Menü · Viva" };

/** Alt çubukta yeri olmayan, hesaba özel girişler. */
const ACCOUNT: { href: string; label: string; desc: string; icon: LucideIcon }[] = [
  { href: "/profile", label: "Profil", desc: "Bilgilerin & hedeflerin", icon: User },
  { href: "/settings", label: "Ayarlar", desc: "Hesap & gizlilik", icon: Settings },
];

function Row({ href, label, desc, icon: Icon }: { href: string; label: string; desc: string; icon: LucideIcon }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-ink-border bg-ink-card p-3.5 transition-colors hover:border-brand/40"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{label}</p>
        <p className="text-xs text-fg-muted">{desc}</p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-fg-muted" />
    </Link>
  );
}

export default async function MenuPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("is_admin").eq("id", user.id).maybeSingle();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Menü</h1>
        <p className="text-sm text-fg-muted">Tüm bölümlere buradan ulaş.</p>
      </header>

      {/* Liste `lib/nav.ts`'ten gelir — yeni sayfa eklendiğinde burası kendiliğinden güncellenir. */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {MENU_NAV.map((s) => (
          <Row key={s.href} href={s.href} label={s.label} desc={s.desc} icon={s.icon} />
        ))}
        {ACCOUNT.map((s) => (
          <Row key={s.href} {...s} />
        ))}
        {profile?.is_admin && (
          <Row href="/admin" label="Admin Panel" desc="Yönetim & içerik" icon={Shield} />
        )}
      </div>

      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-ink-border bg-ink-card p-3.5 text-sm font-semibold text-coral transition-colors hover:border-coral/40"
        >
          <LogOut size={18} /> Çıkış Yap
        </button>
      </form>
    </div>
  );
}
