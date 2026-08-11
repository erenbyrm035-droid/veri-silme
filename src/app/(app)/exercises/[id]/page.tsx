import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getExerciseById,
  getAlternatives,
  getExerciseWeightHistory,
} from "@/lib/data/exercises";
import { getAnimationForExercise } from "@/lib/data/animations";
import { resolveAnimationKey } from "@/lib/animation/mapping";
import { ExerciseMedia } from "@/components/exercise/ExerciseMedia";
import { ExerciseAnatomy3D } from "@/components/anatomy3d/AnatomyViewerLoader";
import { Card } from "@/components/ui/Card";
import { FavoriteButton } from "@/components/exercise/FavoriteButton";
import {
  DIFFICULTY_LABELS,
  CATEGORY_LABELS,
  EQUIPMENT_LABELS,
  ALT_RELATION_LABELS,
} from "@/lib/constants";
import { formatShortDate } from "@/lib/utils";
import type { AltRelation } from "@/lib/database.types";
import {
  ArrowLeft,
  Dumbbell,
  Target,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  Clock,
  Repeat,
  History,
  Activity,
  ListChecks,
  Wind,
  Move,
  Boxes,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exercise = await getExerciseById(id);
  if (!exercise) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [mediaSetRes, profileRes] = await Promise.all([
    supabase.from("exercise_media_set").select("*").eq("exercise_id", id).maybeSingle(),
    user ? supabase.from("profiles").select("gender").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const mediaSet = mediaSetRes.data ?? null;
  const gender = (profileRes.data?.gender as "male" | "female" | null) ?? null;

  const [alternatives, history, favRes] = await Promise.all([
    getAlternatives(id),
    user ? getExerciseWeightHistory(user.id, id) : Promise.resolve([]),
    user
      ? supabase.from("favorites").select("id").eq("user_id", user.id).eq("exercise_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // 3D animasyon altyapısı hazır ama gizli: animasyon yalnızca media_type
  // 'animation' olduğunda çözülür (şu an tüm egzersizler 'gif').
  const animationKey = resolveAnimationKey(exercise.name, exercise.english_name);
  const animation =
    exercise.media_type === "animation"
      ? await getAnimationForExercise({
          id: exercise.id,
          name: exercise.name,
          english_name: exercise.english_name,
        }).catch(() => null)
      : null;
  const isFav = !!favRes?.data;
  const primary =
    exercise.primary_muscles?.length ? exercise.primary_muscles : [exercise.muscle_group];

  const best = history.reduce(
    (max, s) => (s.weight_kg && s.weight_kg > max ? s.weight_kg : max),
    0
  );

  return (
    <div className="space-y-6">
      <Link
        href="/exercises"
        className="inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft size={16} /> Egzersizler
      </Link>

      {/* Başlık */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{exercise.name}</h1>
          <p className="text-sm text-fg-muted">
            {exercise.english_name ? `${exercise.english_name} · ` : ""}
            {exercise.muscle_group}
          </p>
          {exercise.exercise_goal?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {exercise.exercise_goal.map((g) => (
                <span
                  key={g}
                  className="rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge>{DIFFICULTY_LABELS[exercise.difficulty]}</Badge>
            <Badge>{CATEGORY_LABELS[exercise.category]}</Badge>
            {exercise.equipment && (
              <Badge>
                {EQUIPMENT_LABELS[exercise.equipment] ?? exercise.equipment}
              </Badge>
            )}
          </div>
          {user && (
            <FavoriteButton exerciseId={exercise.id} userId={user.id} initial={isFav} />
          )}
        </div>
      </header>

      {/* Hareket medyası (kendi sistemimiz — GIF; video/3D altyapıda hazır, gizli) */}
      <ExerciseMedia
        exercise={{
          name: exercise.name,
          slug: exercise.slug,
          gif_url: exercise.gif_url,
          muscle_group: exercise.muscle_group,
          media_type: exercise.media_type,
          image_url: exercise.image_url,
          video_url: exercise.video_url,
        }}
        exerciseId={exercise.id}
        animation={animation}
        animationKey={animationKey}
        mediaSet={mediaSet}
        gender={gender}
      />

      {/* 3D Anatomi — çalışan kaslar renk kodlu (yeşil ana, sarı yardımcı) */}
      <Section icon={<Boxes size={16} className="text-brand" />} title="3D Anatomi">
        <ExerciseAnatomy3D primary={primary} secondary={exercise.secondary_muscles} />
        <p className="mt-3 text-xs text-fg-muted">
          Modeli döndür, yakınlaştır veya hazır açı butonlarını kullan. Yeşil ana çalışan kas, sarı yardımcı kastır.
        </p>
      </Section>

      {/* Öneri hap bilgileri */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat icon={<Repeat size={15} />} label="Set × Tekrar" value={`${exercise.rec_sets ?? "—"} × ${exercise.rec_reps ?? "—"}`} />
        <MiniStat icon={<Clock size={15} />} label="Dinlenme" value={exercise.rec_rest_sec ? `${exercise.rec_rest_sec} sn` : "—"} />
        <MiniStat
          icon={<Dumbbell size={15} />}
          label="Hareket Tipi"
          value={exercise.movement_type ?? exercise.tempo ?? "—"}
        />
        <MiniStat icon={<History size={15} />} label="Rekorun" value={best ? `${best} kg` : "—"} accent />
      </div>

      {/* Kas aktivasyonu */}
      <Section icon={<Activity size={16} className="text-brand" />} title="Kas Aktivasyonu">
        <div className="space-y-2.5">
          {primary.map((m) => (
            <ActivationBar key={m} label={m} pct={100} tone="primary" />
          ))}
          {exercise.secondary_muscles.map((m) => (
            <ActivationBar key={m} label={m} pct={55} tone="secondary" />
          ))}
        </div>
        <p className="mt-3 text-xs text-fg-muted">
          Birincil kaslar hareketin ana yükünü taşır; ikincil kaslar destekler.
        </p>
      </Section>

      {/* Açıklama */}
      {exercise.description && (
        <Section icon={<Target size={16} />} title="Açıklama">
          <p className="text-sm text-fg-muted">{exercise.description}</p>
        </Section>
      )}

      {/* Nasıl yapılır */}
      {exercise.correct_form && (
        <Section icon={<Target size={16} />} title="Nasıl Yapılır">
          <p className="text-sm text-fg-muted">{exercise.correct_form}</p>
        </Section>
      )}

      {/* Adım adım talimatlar */}
      {exercise.instructions?.length > 0 && (
        <Section icon={<ListChecks size={16} className="text-brand" />} title="Adım Adım">
          <ol className="space-y-2.5">
            {exercise.instructions.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                  {i + 1}
                </span>
                <span className="text-fg-muted">{step}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Nefes & hareket açıklığı */}
      {(exercise.breathing || exercise.range_of_motion) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {exercise.breathing && (
            <Card>
              <h2 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-sky-400">
                <Wind size={16} /> Nefes
              </h2>
              <p className="text-sm text-fg-muted">{exercise.breathing}</p>
            </Card>
          )}
          {exercise.range_of_motion && (
            <Card>
              <h2 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-emerald-400">
                <Move size={16} /> Hareket Açıklığı
              </h2>
              <p className="text-sm text-fg-muted">{exercise.range_of_motion}</p>
            </Card>
          )}
        </div>
      )}

      {/* İpuçları */}
      {exercise.tips.length > 0 && (
        <Section icon={<Lightbulb size={16} className="text-brand" />} title="İpuçları">
          <ul className="space-y-1.5 text-sm text-fg-muted">
            {exercise.tips.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-brand">•</span> {t}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Yaygın Hatalar */}
      {exercise.common_mistakes.length > 0 && (
        <Section icon={<AlertTriangle size={16} className="text-coral" />} title="Yaygın Hatalar">
          <ul className="space-y-1.5 text-sm text-fg-muted">
            {exercise.common_mistakes.map((m) => (
              <li key={m} className="flex gap-2">
                <span className="text-coral">•</span> {m}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* AI notu */}
      {exercise.ai_notes && (
        <Card className="border-brand/30 bg-brand/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand">
            <Sparkles size={16} /> Viva Koç Notu
          </div>
          <p className="mt-2 text-sm text-fg-muted">{exercise.ai_notes}</p>
        </Card>
      )}

      {/* Regresyon / Progresyon */}
      {(exercise.regressions?.length > 0 || exercise.progressions?.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {exercise.regressions?.length > 0 && (
            <Card>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-400">
                <TrendingDown size={16} /> Kolaylaştır
              </h2>
              <ul className="space-y-1.5 text-sm text-fg-muted">
                {exercise.regressions.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="text-emerald-400">•</span> {r}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {exercise.progressions?.length > 0 && (
            <Card>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-coral">
                <TrendingUp size={16} /> Zorlaştır
              </h2>
              <ul className="space-y-1.5 text-sm text-fg-muted">
                {exercise.progressions.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-coral">•</span> {p}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* Alternatifler */}
      {alternatives.length > 0 && (
        <Section icon={<Dumbbell size={16} />} title="Alternatif Hareketler">
          <div className="grid gap-2 sm:grid-cols-2">
            {alternatives.map((a) => (
              <Link
                key={`${a.id}-${a.relation}`}
                href={`/exercises/${a.id}`}
                className="flex items-center justify-between rounded-xl bg-ink-soft px-3 py-2.5 transition-colors hover:bg-fg/5"
              >
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-fg-muted">{a.muscle_group}</p>
                </div>
                <span className="rounded-full bg-fg/10 px-2 py-0.5 text-xs text-fg-muted">
                  {ALT_RELATION_LABELS[a.relation as AltRelation] ?? a.relation}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* Ağırlık geçmişi */}
      {history.length > 0 && (
        <Section icon={<History size={16} />} title="Ağırlık Geçmişin">
          <div className="space-y-2">
            {history.slice(0, 10).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl bg-ink-soft px-3 py-2.5 text-sm"
              >
                <span className="text-fg-muted">{formatShortDate(s.workout_date)}</span>
                <span className="font-medium">
                  {s.reps ?? "—"} tekrar{s.weight_kg ? ` × ${s.weight_kg} kg` : ""}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Aksiyon */}
      <div className="grid gap-2 sm:grid-cols-2">
        {user && (
          <FavoriteButton
            exerciseId={exercise.id}
            userId={user.id}
            initial={isFav}
            variant="button"
          />
        )}
        <Link href="/workouts/new" className="btn-primary w-full">
          <Dumbbell size={18} /> Antrenmana Başla
        </Link>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-ink-border bg-ink-soft px-2.5 py-1 font-medium text-fg-muted">
      {children}
    </span>
  );
}

function ActivationBar({
  label,
  pct,
  tone,
}: {
  label: string;
  pct: number;
  tone: "primary" | "secondary";
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-fg-muted">{tone === "primary" ? "Birincil" : "İkincil"}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-soft">
        <div
          className={tone === "primary" ? "h-full bg-brand" : "h-full bg-coral"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="card gap-1 p-3.5">
      <span className="flex items-center gap-1.5 text-xs text-fg-muted">
        {icon} {label}
      </span>
      <span className={`text-base font-bold ${accent ? "text-brand" : ""}`}>{value}</span>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">
        {icon} {title}
      </h2>
      {children}
    </Card>
  );
}
