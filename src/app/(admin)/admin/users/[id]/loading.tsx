import { Skeleton } from "@/features/admin/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-64 rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-40 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}
