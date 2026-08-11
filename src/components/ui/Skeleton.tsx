import { cn } from "@/lib/utils";

/** Yükleme iskeleti (shimmer). */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-fg/10",
        className
      )}
      {...props}
    />
  );
}
