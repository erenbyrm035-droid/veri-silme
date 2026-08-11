import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { getFilterOptions, listTags } from "@/features/admin/features/exercises/queries";
import { ExerciseForm } from "@/features/admin/features/exercises/ui/exercise-form";
import { Button } from "@/features/admin/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Yeni Egzersiz · Admin" };

export default async function NewExercisePage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");

  const [options, tags] = await Promise.all([getFilterOptions(), listTags()]);

  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/exercises"><ArrowLeft size={16} /> Egzersizler</Link>
        </Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Yeni Egzersiz</h1>
        <p className="mt-1 text-sm text-fg-muted">Temel bilgileri gir. Kaydettikten sonra medya, kas ve ilişkileri ekleyebilirsin.</p>
      </div>
      <ExerciseForm
        muscleSuggestions={options.muscleGroups}
        tagSuggestions={tags.map((t) => t.name)}
      />
    </div>
  );
}
