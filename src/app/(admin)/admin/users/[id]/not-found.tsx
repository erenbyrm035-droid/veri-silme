import Link from "next/link";
import { UserX } from "lucide-react";
import { EmptyState } from "@/features/admin/components/states/empty-state";
import { Button } from "@/features/admin/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={UserX}
      title="Kullanıcı bulunamadı"
      description="Aradığınız kullanıcı silinmiş veya hiç var olmamış olabilir."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/users">Kullanıcı listesine dön</Link>
        </Button>
      }
    />
  );
}
