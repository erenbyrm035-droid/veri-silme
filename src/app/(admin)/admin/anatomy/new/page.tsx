import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { MuscleForm } from "@/features/admin/features/anatomy/muscle-form";
import { Button } from "@/features/admin/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Yeni Kas · Admin" };

export default async function NewMusclePage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/admin/anatomy"><ArrowLeft size={16} /> Anatomi</Link></Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Yeni Kas</h1>
      </div>
      <MuscleForm />
    </div>
  );
}
