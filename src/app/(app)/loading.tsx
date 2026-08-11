import { Skeleton } from "@/components/ui/Skeleton";

export default function AppLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-40" />
      </div>
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}
