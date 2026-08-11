import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkoutSession } from "@/components/WorkoutSession";
import { formatShortDate } from "@/lib/utils";
import { hasFeature } from "@/lib/premium/entitlements";
import { ArrowLeft } from "lucide-react";
import type { Exercise, WorkoutSet, Workout } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: workout } = await supabase
    .from("workouts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!workout) notFound();

  const [{ data: exercises }, { data: sets }, { data: profile }] = await Promise.all([
    supabase.from("exercises").select("*").order("muscle_group"),
    supabase
      .from("workout_sets")
      .select("*")
      .eq("workout_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("is_premium, membership_type, premium_until")
      .eq("id", user!.id)
      .maybeSingle(),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/workouts"
        className="inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft size={16} /> Antrenmanlar
      </Link>

      <header>
        <h1 className="text-2xl font-bold">{workout.title}</h1>
        <p className="text-sm text-fg-muted">
          {formatShortDate(workout.workout_date)}
        </p>
      </header>

      <WorkoutSession
        workout={workout as Workout}
        exercises={(exercises ?? []) as Exercise[]}
        initialSets={(sets ?? []) as WorkoutSet[]}
        isPremium={hasFeature(profile ?? undefined, "voice_coach")}
      />
    </div>
  );
}
