import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/features/admin/components/states/empty-state";
import { Button } from "@/features/admin/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={CalendarDays}
      title="Program bulunamadı"
      description="Aradığınız program silinmiş veya hiç var olmamış olabilir."
      action={<Button asChild variant="outline" size="sm"><Link href="/admin/programs">Program listesine dön</Link></Button>}
    />
  );
}
