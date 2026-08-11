import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { getMuscle } from "@/features/admin/features/anatomy";
import { MuscleForm } from "@/features/admin/features/anatomy/muscle-form";
import { Button } from "@/features/admin/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EditMusclePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  const { id } = await params;
  const muscle = await getMuscle(id);
  if (!muscle) notFound();
  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/admin/anatomy"><ArrowLeft size={16} /> Anatomi</Link></Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{muscle.name_tr}</h1>
      </div>
      <MuscleForm muscle={muscle} />
    </div>
  );
}
