"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** Kontrollü onay kutusu (tema tokenlarıyla, indeterminate destekli). */
export function Checkbox({
  checked,
  indeterminate,
  onCheckedChange,
  disabled,
  className,
  ...rest
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[6px] border transition-colors",
        checked || indeterminate
          ? "border-brand bg-brand text-black"
          : "border-ink-border bg-ink-soft text-transparent hover:border-fg-muted",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      {...rest}
    >
      {indeterminate ? <Minus size={13} strokeWidth={3} /> : checked ? <Check size={13} strokeWidth={3} /> : null}
    </button>
  );
}
