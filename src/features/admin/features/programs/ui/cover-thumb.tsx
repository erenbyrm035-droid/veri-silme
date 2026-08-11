"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

/** Program kapak görseli (tembel yükleme, placeholder fallback). */
export function CoverThumb({ url, size = 44, className }: { url: string | null; size?: number; className?: string }) {
  const [error, setError] = React.useState(false);
  if (!url || error) {
    return (
      <div className={cn("grid shrink-0 place-items-center rounded-lg bg-ink-soft text-fg-muted", className)} style={{ width: size, height: size }}>
        <CalendarDays size={size * 0.42} />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img src={url} alt="" loading="lazy" onError={() => setError(true)} width={size} height={size}
      className={cn("shrink-0 rounded-lg border border-ink-border object-cover", className)} style={{ width: size, height: size }} />
  );
}
