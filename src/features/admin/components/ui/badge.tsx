import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "bg-brand/15 text-brand",
        secondary: "bg-ink-soft text-fg-muted",
        success: "bg-emerald-500/15 text-emerald-400",
        warning: "bg-amber-500/15 text-amber-400",
        danger: "bg-coral/15 text-coral",
        outline: "border border-ink-border text-fg-muted",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
