"use client";

import * as React from "react";
import { Dumbbell } from "lucide-react";
import { resolveExerciseGif } from "@/lib/media/exercise-media";
import { cn } from "@/lib/utils";

/** Liste/kart için tembel yüklenen GIF önizleme (native loading="lazy"). */
export function GifThumb({
  exercise,
  size = 44,
  className,
}: {
  exercise: { gif_url?: string | null; slug?: string | null };
  size?: number;
  className?: string;
}) {
  const src = resolveExerciseGif(exercise);
  const [error, setError] = React.useState(false);

  if (!src || error) {
    return (
      <div
        className={cn("grid shrink-0 place-items-center rounded-lg bg-ink-soft text-fg-muted", className)}
        style={{ width: size, height: size }}
      >
        <Dumbbell size={size * 0.42} />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setError(true)}
      width={size}
      height={size}
      className={cn("shrink-0 rounded-lg border border-ink-border object-cover", className)}
      style={{ width: size, height: size }}
    />
  );
}
