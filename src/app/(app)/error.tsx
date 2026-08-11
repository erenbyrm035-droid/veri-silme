"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-coral/15 text-coral">
        <AlertTriangle size={26} />
      </span>
      <div>
        <h1 className="text-lg font-bold">Bir şeyler ters gitti</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Beklenmeyen bir hata oluştu. Tekrar denemek ister misin?
        </p>
      </div>
      <button onClick={reset} className="btn-primary">
        <RotateCcw size={16} /> Tekrar dene
      </button>
    </div>
  );
}
