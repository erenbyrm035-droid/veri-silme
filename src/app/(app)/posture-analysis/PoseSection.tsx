"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";

// Ağır TF.js kütüphaneleri yalnızca istemcide + bu bölüm görününce yüklenir.
const PoseDetector = dynamic(
  () => import("@/components/posture/PoseDetector").then((m) => m.PoseDetector),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full rounded-2xl" /> }
);

export function PoseSection() {
  return <PoseDetector />;
}
