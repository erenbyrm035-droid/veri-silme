import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sade, erişilebilir yerel select (tema tokenlarıyla). */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "h-10 w-full appearance-none rounded-xl border border-ink-border bg-ink-soft pl-3.5 pr-9 text-sm text-fg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      size={16}
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted"
    />
  </div>
));
Select.displayName = "Select";
