import { Skeleton } from "@/features/admin/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-10 w-96 rounded-xl" />
      <Skeleton className="h-[420px] w-full rounded-2xl" />
    </div>
  );
}
