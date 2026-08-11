"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";

export function ErrorState({
  title = "Bir şeyler ters gitti",
  description = "Veri yüklenirken bir hata oluştu.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-coral/30 bg-coral/5 px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-coral/15 text-coral">
        <AlertTriangle size={26} />
      </span>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          Tekrar dene
        </Button>
      )}
    </div>
  );
}
