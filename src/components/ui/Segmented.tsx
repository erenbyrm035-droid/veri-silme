"use client";

import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Segmentli kontrol (tab benzeri seçici). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex rounded-xl border border-ink-border bg-ink-soft p-1",
        className
      )}
      role="tablist"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
              active
                ? "bg-brand text-black"
                : "text-fg-muted hover:text-fg"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
