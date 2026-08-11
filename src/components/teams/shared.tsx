"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SmartImage } from "@/components/ui/SmartImage";

/** Glassmorphism kart — takım modülünün temel yüzeyi. */
export function Glass({
  className, children, ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-2xl border border-white/10 bg-ink-card/70 backdrop-blur-xl",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset]",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Kayan göstergeli segmented control (Apple/Linear tarzı). */
export function Segments<T extends string>({
  value, onChange, options, size = "md", className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  size?: "sm" | "md";
  className?: string;
}) {
  const id = React.useId();
  return (
    <div
      role="tablist"
      className={cn(
        "no-scrollbar inline-flex items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-ink-soft/60 p-1 backdrop-blur",
        className
      )}
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
              "relative shrink-0 whitespace-nowrap rounded-lg font-semibold transition-colors duration-200",
              size === "sm" ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-[13px]",
              active ? "text-black" : "text-fg-muted hover:text-fg"
            )}
          >
            {active && (
              <motion.span
                layoutId={`tseg-${id}`}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-lg bg-brand shadow-[0_2px_10px_-2px_rgb(var(--brand)/0.55)]"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {o.icon}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Avatar({
  src, name, size = 36, className, ring,
}: { src?: string | null; name?: string | null; size?: number; className?: string; ring?: string }) {
  const style = { width: size, height: size };
  if (src) {
    return (
      <SmartImage
        src={src}
        alt={name ? `${name} avatarı` : "Avatar"}
        width={size}
        height={size}
        style={style}
        className={cn("shrink-0 rounded-full border border-white/10 object-cover", ring, className)}
      />
    );
  }
  return (
    <span
      style={style}
      className={cn("grid shrink-0 place-items-center rounded-full bg-ink-soft font-bold text-fg-muted", ring, className)}
    >
      {(name ?? "V").charAt(0).toUpperCase()}
    </span>
  );
}

export function StatTile({ label, value, hint, icon }: {
  label: string; value: string; hint?: string; icon?: React.ReactNode;
}) {
  return (
    <Glass className="p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-fg-muted">
        {icon}{label}
      </p>
      <p className="mt-1 text-lg font-black tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-fg-muted">{hint}</p>}
    </Glass>
  );
}

/** Sayı biçimlendirme: 12.4B / 1,2Mn gibi kısaltmalar. */
export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(".", ",")}Mn`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(".", ",")}B`;
  return n.toLocaleString("tr-TR");
}

/** "3 dk önce" biçiminde göreli zaman. */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}
