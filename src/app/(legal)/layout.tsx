import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const links = [
  { href: "/fiyatlar", label: "Fiyatlar" },
  { href: "/privacy", label: "Gizlilik" },
  { href: "/terms", label: "Kullanım Şartları" },
  { href: "/mesafeli-satis", label: "Mesafeli Satış" },
  { href: "/iptal-iade", label: "İptal & İade" },
  { href: "/support", label: "Destek" },
  { href: "/contact", label: "İletişim" },
  { href: "/about", label: "Hakkında" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh]">
      <header className="pt-safe px-safe sticky top-0 z-30 border-b border-ink-border bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="grid h-8 w-8 -rotate-6 place-items-center rounded-lg rounded-br-[2px] bg-brand font-black text-black">
              <span className="rotate-6">V</span>
            </span>
            Viva
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main id="icerik" tabIndex={-1} className="px-safe mx-auto max-w-3xl px-5 py-10">{children}</main>
      <footer className="pb-safe px-safe border-t border-ink-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-6 text-sm text-fg-muted">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-fg">{l.label}</Link>
          ))}
          <span className="ml-auto text-xs">© {new Date().getFullYear()} Viva AI Coach</span>
        </div>
      </footer>
    </div>
  );
}
