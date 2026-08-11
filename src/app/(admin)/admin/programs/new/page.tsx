import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { getFilterCategories, listTags } from "@/features/admin/features/programs/queries";
import { ProgramForm } from "@/features/admin/features/programs/ui/program-form";
import { Button } from "@/features/admin/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Yeni Program · Admin" };

export default async function NewProgramPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");

  const [categories, tags] = await Promise.all([getFilterCategories(), listTags()]);

  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/programs"><ArrowLeft size={16} /> Programlar</Link>
        </Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Yeni Program</h1>
        <p className="mt-1 text-sm text-fg-muted">Temel bilgileri gir. Kaydettikten sonra takvimi (Builder) düzenleyebilirsin.</p>
      </div>
      <ProgramForm categories={categories} tagSuggestions={tags.map((t) => t.name)} />
    </div>
  );
}
