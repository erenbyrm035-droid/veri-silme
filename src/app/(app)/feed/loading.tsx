import { Skeleton } from "@/components/ui/Skeleton";

/** /feed iskeleti — parti kartı + composer + 3 gönderi. */
export default function FeedLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-ink-card/70 p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-7 w-20 rounded-xl" />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-ink-card/70 p-3">
        <Skeleton className="h-10 w-full" />
        <div className="mt-2 flex items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-lg" />
          <Skeleton className="h-6 w-28 rounded-lg" />
          <Skeleton className="ml-auto h-7 w-20 rounded-xl" />
        </div>
      </div>

      <Skeleton className="h-9 w-64 rounded-xl" />

      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-ink-card/70 p-3.5">
          <div className="flex items-start gap-2.5">
            <Skeleton className="h-[38px] w-[38px] rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <div className="flex gap-1.5 pt-1">
                <Skeleton className="h-6 w-12 rounded-full" />
                <Skeleton className="h-6 w-12 rounded-full" />
                <Skeleton className="h-6 w-12 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
