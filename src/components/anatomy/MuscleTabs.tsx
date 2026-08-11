"use client";

import { useMemo, useState } from "react";
import type { Muscle, Exercise } from "@/lib/database.types";
import { Segmented } from "@/components/ui/Segmented";
import { MuscleExercises } from "@/components/anatomy/MuscleExercises";
import { MuscleProgramButton } from "@/components/anatomy/MuscleProgramButton";
import { ExerciseCard } from "@/components/exercise/ExerciseCard";
import { Card } from "@/components/ui/Card";
import {
  Activity,
  MapPin,
  Zap,
  HeartPulse,
  Bone,
  Home,
  Lightbulb,
  AlertTriangle,
  Dumbbell,
  Waves,
  StretchHorizontal,
} from "lucide-react";

type TabKey = "info" | "exercises" | "mobility" | "stretch" | "rehab" | "mistakes";

const TABS: { key: TabKey; label: string }[] = [
  { key: "info", label: "Genel Bilgi" },
  { key: "exercises", label: "Egzersizler" },
  { key: "mobility", label: "Mobilizasyon" },
  { key: "stretch", label: "Stretching" },
  { key: "rehab", label: "Rehabilitasyon" },
  { key: "mistakes", label: "Sık Hatalar" },
];

export function MuscleTabs({
  muscle,
  exercises,
}: {
  muscle: Muscle;
  exercises: Exercise[];
}) {
  const [tab, setTab] = useState<TabKey>("info");

  const groups = useMemo(() => {
    const training = exercises.filter(
      (e) => !["mobility", "stretch", "rehab"].includes(e.category)
    );
    return {
      training,
      mobility: exercises.filter((e) => e.category === "mobility"),
      stretch: exercises.filter((e) => e.category === "stretch"),
      rehab: exercises.filter((e) => e.category === "rehab"),
    };
  }, [exercises]);

  // Sık hatalar: bu kasın egzersizlerinden benzersiz hataları topla.
  const mistakes = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((e) => (e.common_mistakes ?? []).forEach((m) => set.add(m)));
    return Array.from(set).slice(0, 8);
  }, [exercises]);

  return (
    <div className="space-y-4">
      <div className="no-scrollbar overflow-x-auto pb-1">
        <Segmented
          options={TABS.map((t) => ({ value: t.key, label: t.label }))}
          value={tab}
          onChange={(v) => setTab(v as TabKey)}
          className="w-max"
        />
      </div>

      {tab === "info" && <InfoTab muscle={muscle} />}

      {tab === "exercises" && (
        <MuscleExercises exercises={groups.training} />
      )}

      {tab === "mobility" && (
        <CategoryGrid
          items={groups.mobility}
          icon={<Waves size={16} className="text-sky-400" />}
          empty="Bu kas için mobilizasyon hareketi henüz eklenmedi."
        />
      )}
      {tab === "stretch" && (
        <CategoryGrid
          items={groups.stretch}
          icon={<StretchHorizontal size={16} className="text-brand" />}
          empty="Bu kas için esneme hareketi henüz eklenmedi."
        />
      )}
      {tab === "rehab" && (
        <CategoryGrid
          items={groups.rehab}
          icon={<HeartPulse size={16} className="text-coral" />}
          empty="Bu kas için rehabilitasyon hareketi henüz eklenmedi."
        />
      )}

      {tab === "mistakes" && (
        <Card>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">
            <AlertTriangle size={16} className="text-coral" /> Sık Yapılan Hatalar
          </h3>
          {mistakes.length === 0 ? (
            <p className="text-sm text-fg-muted">Kayıtlı hata bilgisi yok.</p>
          ) : (
            <ul className="space-y-2 text-sm text-fg-muted">
              {mistakes.map((m) => (
                <li key={m} className="flex gap-2">
                  <span className="text-coral">✕</span> {m}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

function InfoTab({ muscle }: { muscle: Muscle }) {
  return (
    <div className="space-y-4">
      {muscle.overview && (
        <Card>
          <p className="text-sm text-fg-muted">{muscle.overview}</p>
        </Card>
      )}

      {(muscle.functions ?? []).length > 0 && (
        <Section icon={<Activity size={16} className="text-brand" />} title="Fonksiyonları">
          <ul className="space-y-1.5 text-sm text-fg-muted">
            {(muscle.functions ?? []).map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-brand">•</span> {f}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Info icon={<MapPin size={15} />} title="Origo (Başlangıç)" value={muscle.origin} />
        <Info icon={<MapPin size={15} />} title="İnsertio (Yapışma)" value={muscle.insertion} />
        <Info icon={<Zap size={15} />} title="İnnervasyon" value={muscle.innervation} />
        <Info icon={<Bone size={15} />} title="Çalıştırdığı Eklemler" value={(muscle.joints ?? []).join(", ") || null} />
      </div>

      {muscle.daily_life && (
        <Section icon={<Home size={16} className="text-sky-400" />} title="Günlük Hayattaki Görevi">
          <p className="text-sm text-fg-muted">{muscle.daily_life}</p>
        </Section>
      )}

      {(muscle.growth_tips ?? []).length > 0 && (
        <Section icon={<Lightbulb size={16} className="text-brand" />} title="Gelişim İpuçları">
          <ul className="space-y-1.5 text-sm text-fg-muted">
            {(muscle.growth_tips ?? []).map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-brand">•</span> {t}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(muscle.common_injuries ?? []).length > 0 && (
        <Section icon={<AlertTriangle size={16} className="text-coral" />} title="Sık Sakatlıklar">
          <p className="text-sm text-fg-muted">{(muscle.common_injuries ?? []).join(", ")}</p>
        </Section>
      )}

      {muscle.rehab_notes && (
        <Card className="border-sky-400/30 bg-sky-400/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-400">
            <HeartPulse size={16} /> Rehabilitasyon Notu
          </div>
          <p className="mt-2 text-sm text-fg-muted">{muscle.rehab_notes}</p>
        </Card>
      )}

      {/* Kasa özel AI program */}
      <Card className="border-brand/30 bg-gradient-to-br from-brand/10 to-transparent">
        <div className="mb-3 flex items-center gap-2">
          <Dumbbell size={18} className="text-brand" />
          <p className="text-sm font-semibold">Bu kasa odaklı antrenman iste</p>
        </div>
        <MuscleProgramButton muscleGroup={muscle.muscle_group} />
      </Card>
    </div>
  );
}

function CategoryGrid({
  items,
  icon,
  empty,
}: {
  items: Exercise[];
  icon: React.ReactNode;
  empty: string;
}) {
  if (items.length === 0) {
    return <div className="card py-8 text-center text-sm text-fg-muted">{empty}</div>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((e) => (
        <ExerciseCard key={e.id} exercise={e} />
      ))}
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
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">
        {icon} {title}
      </h3>
      {children}
    </Card>
  );
}

function Info({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | null;
}) {
  return (
    <Card className="gap-1">
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-fg-muted">
        {icon} {title}
      </span>
      <p className="text-sm">{value || "—"}</p>
    </Card>
  );
}
