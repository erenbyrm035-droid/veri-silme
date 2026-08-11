import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="px-safe flex min-h-[100dvh] flex-col items-center justify-center gap-5 px-5 text-center">
      <p className="text-6xl font-black tracking-tighter text-brand">404</p>
      <div>
        <h1 className="text-xl font-bold">Sayfa bulunamadı</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Aradığın sayfa taşınmış veya hiç var olmamış olabilir.
        </p>
      </div>
      <Link href="/dashboard" className="btn-primary">
        <Home size={16} /> Ana sayfaya dön
      </Link>
    </div>
  );
}
