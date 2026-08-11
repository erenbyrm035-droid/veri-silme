import { Skeleton } from "@/features/admin/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="flex justify-between">
        <div><Skeleton className="h-8 w-36" /><Skeleton className="mt-2 h-4 w-56" /></div>
        <Skeleton className="h-9 w-44" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
      </div>
      <div className="overflow-hidden rounded-2xl border border-ink-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-ink-border/60 p-3 last:border-0">
            <Skeleton className="h-[18px] w-[18px] rounded-[6px]" />
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-24" /></div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
