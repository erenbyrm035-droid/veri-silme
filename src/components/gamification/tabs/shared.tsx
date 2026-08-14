"use client";

import { type LucideIcon } from "lucide-react";

export function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ink-border bg-ink-card p-10 text-center">
      <Icon size={28} className="text-fg-muted" />
      <p className="max-w-xs text-sm text-fg-muted">{text}</p>
    </div>
  );
}
