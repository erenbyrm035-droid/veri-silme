import { cn } from "@/lib/utils";

/** Glassmorphism kart — yarı saydam, blur'lu yüzey. */
export function GlassCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass rounded-2xl p-5 shadow-sm", className)} {...props}>
      {children}
    </div>
  );
}
