import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import {
  getProgram, getProgramTree, getRelations, getVersions, getRatings, getFavorites, getProgressStats,
  getFilterCategories, listTags,
} from "@/features/admin/features/programs/queries";
import { ProgramForm } from "@/features/admin/features/programs/ui/program-form";
import { WorkoutBuilder } from "@/features/admin/features/programs/ui/workout-builder";
import { RelationManager } from "@/features/admin/features/programs/ui/relation-manager";
import { VersionHistory } from "@/features/admin/features/programs/ui/version-history";
import { ProgramStats } from "@/features/admin/features/programs/ui/program-stats";
import { ProgramPreview } from "@/features/admin/features/programs/ui/program-preview";
import { EditTabs } from "@/features/admin/features/programs/ui/edit-tabs";
import { ProgramStatusBadge } from "@/features/admin/features/programs/ui/badges";
import { Button } from "@/features/admin/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");

  const { id } = await params;
  const program = await getProgram(id);
  if (!program) notFound();

  const [tree, relations, versions, ratings, favorites, progress, categories, tags] = await Promise.all([
    getProgramTree(id),
    getRelations(id),
    getVersions(id),
    getRatings(id),
    getFavorites(id),
    getProgressStats(id),
    getFilterCategories(),
    listTags(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/programs"><ArrowLeft size={16} /> Programlar</Link>
        </Button>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{program.name}</h1>
          <ProgramStatusBadge status={program.status} />
        </div>
      </div>

      <EditTabs
        formSlot={<ProgramForm program={program} categories={categories} tagSuggestions={tags.map((t) => t.name)} />}
        builderSlot={<WorkoutBuilder programId={id} weeks={program.weeks} daysPerWeek={program.days_per_week} tree={tree} />}
        relationSlot={<RelationManager programId={id} relations={relations} />}
        statsSlot={<ProgramStats program={program} progress={progress} ratings={ratings} favorites={favorites} />}
        versionSlot={<VersionHistory programId={id} versions={versions} />}
        previewSlot={<ProgramPreview program={program} tree={tree} />}
      />
    </div>
  );
}
