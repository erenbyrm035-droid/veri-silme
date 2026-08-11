"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Service worker'ı kaydeder ve (destekleyen tarayıcılarda) "Uygulamayı Yükle"
 * istemini yönetir. iOS'ta beforeinstallprompt yoktur; oradaki kurulum
 * Paylaş → Ana Ekrana Ekle ile yapılır (manifest + apple meta hazır).
 */
export function PWARegister() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setDeferred(null));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!deferred || dismissed) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-brand/40 bg-ink-card/95 p-3 shadow-2xl backdrop-blur md:left-auto md:right-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-xl">
        📲
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Viva&apos;yı yükle</p>
        <p className="text-xs text-fg-muted">Ana ekrana ekle, uygulama gibi kullan.</p>
      </div>
      <button
        onClick={async () => {
          await deferred.prompt();
          await deferred.userChoice;
          setDeferred(null);
        }}
        className="btn-primary shrink-0 text-sm"
      >
        <Download size={15} /> Yükle
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-fg-muted"
        aria-label="Kapat"
      >
        <X size={16} />
      </button>
    </div>
  );
}
