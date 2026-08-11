import { Loader2 } from "lucide-react";

export function LoadingState({ label = "Yükleniyor..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-fg-muted">
      <Loader2 size={24} className="animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
