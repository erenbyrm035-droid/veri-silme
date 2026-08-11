import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import {
  getExerciseFull,
  getExerciseMuscles,
  getExerciseMedia,
  getRelations,
  getVersions,
  getFilterOptions,
  listTags,
  listMuscles,
} from "@/features/admin/features/exercises/queries";
import { ExerciseForm } from "@/features/admin/features/exercises/ui/exercise-form";
import { MuscleSelector } from "@/features/admin/features/exercises/ui/muscle-selector";
import { MediaManager } from "@/features/admin/features/exercises/ui/media-manager";
import { RelationManager } from "@/features/admin/features/exercises/ui/relation-manager";
import { VersionHistory } from "@/features/admin/features/exercises/ui/version-history";
import { EditTabs } from "@/features/admin/features/exercises/ui/edit-tabs";
import { StatusBadge } from "@/features/admin/features/exercises/ui/badges";
import { Button } from "@/features/admin/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EditExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");

  const { id } = await params;
  const exercise = await getExerciseFull(id);
  if (!exercise) notFound();

  const [muscleLinks, media, relations, versions, options, tags, muscles] = await Promise.all([
    getExerciseMuscles(id),
    getExerciseMedia(id),
    getRelations(id),
    getVersions(id),
    getFilterOptions(),
    listTags(),
    listMuscles(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/exercises"><ArrowLeft size={16} /> Egzersizler</Link>
        </Button>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{exercise.name}</h1>
          <StatusBadge status={exercise.status} />
          {exercise.slug && (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/exercises/${exercise.id}`} target="_blank">
                <ExternalLink size={14} /> Önizle
              </Link>
            </Button>
          )}
        </div>
      </div>

      <EditTabs
        formSlot={
          <ExerciseForm
            exercise={exercise}
            muscleSuggestions={options.muscleGroups}
            tagSuggestions={tags.map((t) => t.name)}
          />
        }
        muscleSlot={<MuscleSelector exerciseId={id} initial={muscleLinks} muscles={muscles} />}
        mediaSlot={<MediaManager exerciseId={id} slug={exercise.slug} media={media} />}
        relationSlot={<RelationManager exerciseId={id} relations={relations} />}
        versionSlot={<VersionHistory exerciseId={id} versions={versions} />}
      />
    </div>
  );
}
