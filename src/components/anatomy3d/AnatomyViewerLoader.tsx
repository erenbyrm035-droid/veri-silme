"use client";

import { useMemo } from "react";
import { AnatomyStage } from "./AnatomyStage";
import { buildMuscleStates, type RegionKey, type MuscleState } from "@/lib/anatomy3d/regions";

/** Egzersizden gelen kas adlarıyla anatomi sahnesini sürer. */
export function ExerciseAnatomy3D({
  primary,
  secondary,
}: {
  primary: string[];
  secondary: string[];
}) {
  const states = useMemo(() => buildMuscleStates(primary, secondary), [primary, secondary]);
  return <AnatomyStage states={states} />;
}

/** Doğrudan durum verilebilen genel giriş (AI Koç / Postür / Program için). */
export function Anatomy3D({ states }: { states: Record<RegionKey, MuscleState> }) {
  return <AnatomyStage states={states} />;
}
