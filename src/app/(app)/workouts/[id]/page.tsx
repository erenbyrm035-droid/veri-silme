import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkoutSession } from "@/components/WorkoutSession";
import { WorkoutEngine } from "@/components/workout/WorkoutEngine";
import { getWorkoutSessionData } from "@/lib/workout/session-data";
import { getWorkoutSummary } from "@/lib/workout/summary";
import { analyzeWorkout } from "@/lib/workout/ai-analysis";
import { WorkoutSummary } from "@/components/workout/WorkoutSummary";
import { getFriendParty } from "@/lib/social/queries";
import { createAdminClient } from "@/lib/supabase/server";
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

  // Motor verisi: YALNIZCA bu antrenmandaki egzersizler + medyaları + geçmiş
  // performansları. Eskiden burada `exercises` tablosunun TAMAMI (682 satır)
  // istemciye gidiyordu.
  const [data, { data: profile }] = await Promise.all([
    getWorkoutSessionData(id, user!.id),
    supabase
      .from("profiles")
      .select("is_premium, membership_type, premium_until")
      .eq("id", user!.id)
      .maybeSingle(),
  ]);

  const isPremium = hasFeature(profile ?? undefined, "voice_coach");

  // TAMAMLANMIŞ antrenman → motor yerine ÖZET gösterilir.
  // Bulgular deterministik hesaplanır; AI analizi başarısız olursa (anahtar
  // yok, kota, ağ) özet yine eksiksiz çalışır — sadece anlatı eksik olur.
  if (workout.status === "completed") {
    const summary = await getWorkoutSummary(id, user!.id);
    if (summary) {
      const analysis = await analyzeWorkout(summary).catch(() => null);
      // Arkadaşların açık partisi varsa özet ekranında katılma seçeneği çıkar.
      // Yoksa kart hiç gösterilmez — boş kutu ekranı kirletir.
      const party = await getFriendParty(createAdminClient(), user!.id).catch(() => null);
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
              {formatShortDate(workout.workout_date)} · tamamlandı
            </p>
          </header>
          <WorkoutSummary data={summary} analysis={analysis} party={party} />
        </div>
      );
    }
  }

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
        <p className="text-sm text-fg-muted">{formatShortDate(workout.workout_date)}</p>
      </header>

      {data.exercises.length > 0 ? (
        <WorkoutEngine
          workout={workout as Workout}
          exercises={data.exercises}
          initialSets={data.sets}
          overview={data.overview}
          xpRules={data.xpRules}
          priorVolume={data.priorVolume}
          isPremium={isPremium}
        />
      ) : (
        // Egzersizi olmayan (serbest) antrenman: mevcut ekran korunuyor —
        // kullanıcı buradan egzersiz seçip set ekleyebiliyor. Motor planlı
        // setler üzerine kurulu olduğu için boş antrenmanda gösterilecek
        // bir şeyi yok.
        <FreeformSession workoutId={id} workout={workout as Workout} isPremium={isPremium} />
      )}
    </div>
  );
}

/** Serbest antrenman — egzersiz listesi yalnızca BU durumda yüklenir. */
async function FreeformSession({
  workoutId,
  workout,
  isPremium,
}: {
  workoutId: string;
  workout: Workout;
  isPremium: boolean;
}) {
  const supabase = await createClient();
  const [{ data: exercises }, { data: sets }] = await Promise.all([
    supabase
      .from("exercises")
      .select("*")
      .order("muscle_group"),
    supabase
      .from("workout_sets")
      .select("*")
      .eq("workout_id", workoutId)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <WorkoutSession
      workout={workout}
      exercises={(exercises ?? []) as Exercise[]}
      initialSets={(sets ?? []) as WorkoutSet[]}
      isPremium={isPremium}
    />
  );
}
