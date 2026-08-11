import Link from "next/link";
import { notFound } from "next/navigation";
import { getMuscleBySlug, getExercisesForMuscle } from "@/lib/data/muscles";
import { MuscleTabs } from "@/components/anatomy/MuscleTabs";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MuscleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const muscle = await getMuscleBySlug(slug);
  if (!muscle) notFound();

  const exercises = await getExercisesForMuscle(muscle);

  return (
    <div className="space-y-5">
      <Link
        href="/anatomy"
        className="inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft size={16} /> Anatomi Kâşifi
      </Link>

      <header>
        <span className="text-xs font-semibold uppercase tracking-wide text-coral">
          {muscle.muscle_group} · {muscle.region === "front" ? "Ön" : "Arka"}
        </span>
        <h1 className="mt-1 text-2xl font-bold">{muscle.name_tr}</h1>
        {muscle.latin_name && (
          <p className="text-sm italic text-fg-muted">{muscle.latin_name}</p>
        )}
      </header>

      <MuscleTabs muscle={muscle} exercises={exercises} />
    </div>
  );
}
