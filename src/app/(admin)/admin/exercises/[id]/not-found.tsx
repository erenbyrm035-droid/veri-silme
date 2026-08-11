import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { EmptyState } from "@/features/admin/components/states/empty-state";
import { Button } from "@/features/admin/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={Dumbbell}
      title="Egzersiz bulunamadı"
      description="Aradığınız egzersiz silinmiş veya hiç var olmamış olabilir."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/exercises">Egzersiz listesine dön</Link>
        </Button>
      }
    />
  );
}
