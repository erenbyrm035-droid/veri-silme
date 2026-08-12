import Link from "next/link";
import type { Exercise } from "@/lib/database.types";
import { displayName } from "@/lib/exercises/display";
import { DIFFICULTY_LABELS, EQUIPMENT_LABELS } from "@/lib/constants";
import { thumbUrl, bustThumb } from "@/lib/media/exercise-media-set";
import { Dumbbell, Home, Heart } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";

const DIFF_STYLE: Record<string, string> = {
  beginner: "bg-brand/15 text-brand",
  intermediate: "bg-sky-400/15 text-sky-400",
  advanced: "bg-coral/15 text-coral",
};

export function ExerciseCard({
  exercise,
  favorite,
}: {
  exercise: Exercise;
  favorite?: boolean;
}) {
  const thumb = bustThumb(exercise.gif_url) || bustThumb(exercise.image_url) || thumbUrl(exercise.id);
  return (
    <Link href={`/exercises/${exercise.id}`}>
      <div className="card card-hover flex h-full flex-col gap-3">
        <div className="-mx-1 -mt-1 overflow-hidden rounded-xl border border-ink-border bg-ink-soft">
          <SmartImage
            src={thumb}
            alt={`${displayName(exercise)} görseli`}
            width={320}
            height={180}
            sizes="(max-width: 640px) 50vw, 320px"
            className="aspect-video w-full object-cover"
          />
        </div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 truncate font-semibold">
              {displayName(exercise)}
              {favorite && <Heart size={13} className="shrink-0 fill-coral text-coral" />}
            </h3>
            <p className="text-sm text-fg-muted">{exercise.muscle_group}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              DIFF_STYLE[exercise.difficulty] ?? "bg-fg/10 text-fg-muted"
            }`}
          >
            {DIFFICULTY_LABELS[exercise.difficulty]}
          </span>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-fg-muted">
          <span className="inline-flex items-center gap-1">
            <Dumbbell size={13} />
            {exercise.equipment
              ? EQUIPMENT_LABELS[exercise.equipment] ?? exercise.equipment
              : "—"}
          </span>
          {exercise.is_home && (
            <span className="inline-flex items-center gap-1">
              <Home size={13} /> Ev
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
