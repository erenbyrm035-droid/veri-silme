import { Skeleton } from "@/components/ui/Skeleton";

/** /discover iskeleti — öneri bloğu + arama + sekmeler + kart ızgarası. */
export default function DiscoverLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="space-y-2 rounded-2xl border border-white/10 bg-ink-card/70 p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>

      <Skeleton className="h-9 w-full rounded-xl" />
      <Skeleton className="h-9 w-full rounded-xl" />

      <div className="grid gap-2.5 sm:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-ink-card/70 p-3.5">
            <div className="flex items-start gap-3">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <Skeleton className="h-9 rounded-lg" />
              <Skeleton className="h-9 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
