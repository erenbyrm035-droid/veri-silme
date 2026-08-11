"use client";

import { useState } from "react";
import { Dumbbell } from "lucide-react";
import { resolveExerciseMedia, thumbUrl, bustThumb } from "@/lib/media/exercise-media-set";
import { AnimationPlayerLoader } from "@/components/animation/AnimationPlayerLoader";
import type { Animation, MediaType, ExerciseMediaSet } from "@/lib/database.types";
import { SmartImage } from "@/components/ui/SmartImage";

/**
 * Egzersiz medyası — kendi medya sistemimiz (GIF öncelikli, otomatik oynar, loop).
 * media_type'a göre kaynak seçilir:
 *   - 'gif'       → GIF (auto-play + loop, butonsuz)  ← ilk sürümde tek aktif
 *   - 'animation' → 3D animasyon (altyapı hazır; hiçbir egzersizde aktif değil)
 *   - 'video'     → video (altyapı için ayrılmış; şimdilik gösterilmez)
 * YouTube tamamen kaldırıldı.
 */
export function ExerciseMedia({
  exercise,
  exerciseId,
  animation,
  animationKey,
  mediaSet,
  gender,
}: {
  exercise: {
    name: string;
    slug: string | null;
    gif_url: string | null;
    muscle_group: string;
    media_type: MediaType;
    image_url?: string | null;
    video_url?: string | null;
  };
  exerciseId?: string;
  animation?: Animation | null;
  animationKey?: string;
  mediaSet?: Partial<ExerciseMediaSet> | null;
  gender?: "male" | "female" | null;
}) {
  // Altyapı hazır ama kullanıcıya yalnızca GIF gösterilir.
  if (exercise.media_type === "animation" && animation !== undefined) {
    return (
      <AnimationPlayerLoader
        animation={animation ?? null}
        animationKey={animationKey ?? "generic_idle"}
        exerciseName={exercise.name}
      />
    );
  }

  return <ExerciseMediaFrame exercise={exercise} exerciseId={exerciseId} mediaSet={mediaSet} gender={gender} />;
}

/** Öncelik zinciri: GIF → Video → Thumbnail → Otomatik üretilen görsel. */
function ExerciseMediaFrame({
  exercise,
  exerciseId,
  mediaSet,
  gender,
}: {
  exercise: { name: string; slug: string | null; gif_url: string | null; muscle_group: string; image_url?: string | null; video_url?: string | null };
  exerciseId?: string;
  mediaSet?: Partial<ExerciseMediaSet> | null;
  gender?: "male" | "female" | null;
}) {
  const resolved = resolveExerciseMedia(mediaSet, { gif_url: exercise.gif_url, image_url: exercise.image_url, video_url: exercise.video_url }, gender);
  const [failed, setFailed] = useState(false);

  // Hiç medya yoksa: otomatik üretilen görseli göster (her egzersizin bir görseli olur).
  if (resolved.kind === "none" || failed) {
    if (exerciseId) {
      return (
        <div className="overflow-hidden rounded-2xl border border-ink-border bg-ink-card">
          <SmartImage
            src={thumbUrl(exerciseId)}
            alt={`${exercise.name} görseli`}
            width={448}
            height={252}
            sizes="(max-width: 768px) 100vw, 448px"
            className="mx-auto w-full max-w-md object-contain"
          />
        </div>
      );
    }
    return (
      <div className="grid aspect-video w-full place-items-center overflow-hidden rounded-2xl border border-ink-border bg-gradient-to-br from-ink-soft to-ink-card">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid h-14 w-14 animate-pulse place-items-center rounded-2xl bg-brand/15 text-brand">
            <Dumbbell size={26} />
          </span>
          <p className="text-sm font-medium">{exercise.name}</p>
          <p className="text-xs text-fg-muted">Hareket görseli yakında</p>
        </div>
      </div>
    );
  }

  if (resolved.kind === "video") {
    return (
      <div className="overflow-hidden rounded-2xl border border-ink-border bg-ink-card">
        <video
          src={resolved.url!}
          poster={resolved.poster ?? undefined}
          className="mx-auto w-full max-w-md object-contain"
          controls autoPlay loop muted playsInline preload="metadata"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-border bg-ink-card">
      <SmartImage
        src={bustThumb(resolved.url)}
        alt={`${exercise.name} hareketi`}
        width={448}
        height={252}
        sizes="(max-width: 768px) 100vw, 448px"
        className="mx-auto w-full max-w-md object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
