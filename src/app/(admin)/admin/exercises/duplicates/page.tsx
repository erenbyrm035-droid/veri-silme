import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { findDuplicates } from "@/features/admin/features/exercises/queries";
import { DuplicateDetector } from "@/features/admin/features/exercises/ui/duplicate-detector";
import { Button } from "@/features/admin/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tekrar Eden Egzersizler · Admin" };

export default async function DuplicatesPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");

  const groups = await findDuplicates();

  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/exercises"><ArrowLeft size={16} /> Egzersizler</Link>
        </Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Tekrar Tespiti</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Benzer isimli egzersizler otomatik gruplanır ({groups.length} grup). İncele ve birleştir.
        </p>
      </div>
      <DuplicateDetector groups={groups} />
    </div>
  );
}
