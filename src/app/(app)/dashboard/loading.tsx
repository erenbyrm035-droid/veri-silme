import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Dashboard'a özel iskelet. Ortak `(app)/loading.tsx` jenerikti ve gerçek
 * yerleşimle örtüşmediğinden yükleme sırasında sayfa "zıplıyordu".
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>

      {/* Bugünkü plan kartı */}
      <div className="rounded-2xl border border-white/10 bg-ink-card/70 p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <Skeleton className="h-[76px] w-[76px] rounded-full" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-xl" />
          ))}
        </div>
      </div>

      {/* Göstergeler */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[86px] rounded-2xl" />
        ))}
      </div>

      {/* AI önerisi */}
      <Skeleton className="h-20 w-full rounded-2xl" />

      {/* Beslenme */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="col-span-2 h-24 rounded-2xl sm:col-span-1" />
        </div>
      </div>

      {/* Bugün sana özel */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
