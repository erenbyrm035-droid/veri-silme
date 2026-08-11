import Link from "next/link";
import { WifiOff, RotateCcw } from "lucide-react";

export const metadata = { title: "Çevrimdışı" };

/** Ağ yokken service worker'ın gösterdiği yedek sayfa. */
export default function OfflinePage() {
  return (
    <div className="px-safe mx-auto flex min-h-[100dvh] max-w-sm flex-col items-center justify-center px-6 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-ink-soft text-fg-muted">
        <WifiOff size={28} />
      </span>
      <h1 className="mt-5 text-xl font-bold">İnternet bağlantısı yok</h1>
      <p className="mt-2 text-sm text-fg-muted">
        Şu an çevrimdışısın. Bağlantın gelince kaldığın yerden devam edebilirsin.
      </p>
      <Link href="/dashboard" className="btn-primary mt-6">
        <RotateCcw size={16} /> Tekrar dene
      </Link>
    </div>
  );
}
