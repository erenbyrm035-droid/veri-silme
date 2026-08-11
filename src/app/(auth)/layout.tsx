import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="px-safe relative flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))]">
      <div className="absolute right-5 top-[calc(1.25rem+env(safe-area-inset-top))]">
        <ThemeToggle />
      </div>
      <Link href="/" className="mb-8 flex items-center gap-2.5 text-lg font-bold">
        <span className="grid h-9 w-9 -rotate-6 place-items-center rounded-xl rounded-br-[3px] bg-brand font-black text-black">
          <span className="rotate-6">V</span>
        </span>
        Viva <span className="font-semibold text-fg-muted">AI Coach</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
