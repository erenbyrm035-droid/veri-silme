"use client";

import * as React from "react";
import { Dumbbell } from "lucide-react";
import { displayName } from "@/lib/exercises/display";
import { EQUIPMENT_LABELS } from "@/lib/constants";
import type { EngineExercise } from "@/lib/workout/session-data";

// ============================================================================
// Antrenman ekranındaki hareket görseli.
//
// ÖNCELİK: video → GIF → thumbnail → üretilen egzersiz görseli.
// Sıra `session-data.ts` içinde çözülüyor (preferVideo); burada yalnızca
// çözülmüş medyayı gösteriyoruz.
//
// Video 9:16 dikey standardında, sessiz, döngülü ve OYNATMA KONTROLSÜZ:
// antrenman sırasında kullanıcı videoyu yönetmekle uğraşmamalı, sadece
// hareketi görmeli. `playsInline` iOS'ta tam ekrana geçmeyi engeller.
//
// Video henüz yüklenmemişse zincir sessizce GIF/görsele düşer — boş kutu
// gösterilmez.
// ============================================================================

export function ExerciseMediaPanel({ exercise }: { exercise: EngineExercise }) {
  const { media } = exercise;
  const ad = displayName(exercise);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-ink-border bg-ink-soft">
        {media.kind === "video" && media.url ? (
          <video
            key={media.url}
            src={media.url}
            poster={media.poster ?? undefined}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-label={`${ad} hareket videosu`}
            className="aspect-[9/16] max-h-[46vh] w-full bg-black object-contain sm:aspect-video sm:max-h-none"
          />
        ) : media.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.url}
            alt={`${ad} hareketi`}
            loading="lazy"
            className="aspect-[9/16] max-h-[46vh] w-full object-contain sm:aspect-video sm:max-h-none"
          />
        ) : (
          <div className="grid aspect-video w-full place-items-center text-fg-muted">
            <div className="text-center">
              <Dumbbell size={30} className="mx-auto opacity-40" />
              <p className="mt-2 text-xs">Bu hareket için henüz görsel yok</p>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold leading-tight">{ad}</h2>
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
          {exercise.equipment && (
            <span className="rounded-md bg-fg/10 px-2 py-0.5 text-fg-muted">
              {EQUIPMENT_LABELS[exercise.equipment] ?? exercise.equipment}
            </span>
          )}
          {(exercise.primary_muscles?.length ? exercise.primary_muscles : [exercise.muscle_group]).map((m) => (
            <span key={m} className="rounded-md bg-brand/10 px-2 py-0.5 font-medium text-brand">{m}</span>
          ))}
          {exercise.secondary_muscles.slice(0, 3).map((m) => (
            <span key={m} className="rounded-md bg-fg/5 px-2 py-0.5 text-fg-muted">{m}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
