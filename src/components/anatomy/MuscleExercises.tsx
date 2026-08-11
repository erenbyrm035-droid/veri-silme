"use client";

import { useMemo, useState } from "react";
import type { Exercise, ExerciseCategory } from "@/lib/database.types";
import { CATEGORY_LABELS, EQUIPMENT_LABELS } from "@/lib/constants";
import { ExerciseCard } from "@/components/exercise/ExerciseCard";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER: ExerciseCategory[] = [
  "isolation",
  "compound",
  "functional",
  "mobility",
  "stretch",
  "rehab",
];

/**
 * Bir kas sayfasındaki egzersizleri kategori sekmeleri + ekipman filtresi ile
 * gösterir (izole / bileşik / fonksiyonel / mobilizasyon / esneme / rehab).
 */
export function MuscleExercises({ exercises }: { exercises: Exercise[] }) {
  const [cat, setCat] = useState<ExerciseCategory | "all">("all");
  const [equip, setEquip] = useState<string | null>(null);

  // Sadece verilerde bulunan kategoriler için sekme göster.
  const availableCats = useMemo(
    () => CATEGORY_ORDER.filter((c) => exercises.some((e) => e.category === c)),
    [exercises]
  );
  const availableEquip = useMemo(
    () =>
      Array.from(new Set(exercises.map((e) => e.equipment).filter(Boolean))) as string[],
    [exercises]
  );

  const filtered = exercises.filter((e) => {
    if (cat !== "all" && e.category !== cat) return false;
    if (equip && e.equipment !== equip) return false;
    return true;
  });

  if (exercises.length === 0) {
    return (
      <div className="card py-8 text-center text-sm text-fg-muted">
        Bu kas için henüz egzersiz eklenmemiş.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Kategori sekmeleri */}
      <div className="flex flex-wrap gap-2">
        <Tab active={cat === "all"} onClick={() => setCat("all")}>
          Tümü
        </Tab>
        {availableCats.map((c) => (
          <Tab key={c} active={cat === c} onClick={() => setCat(c)}>
            {CATEGORY_LABELS[c]}
          </Tab>
        ))}
      </div>

      {/* Ekipman filtresi */}
      {availableEquip.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Chip active={equip === null} onClick={() => setEquip(null)}>
            Tüm ekipman
          </Chip>
          {availableEquip.map((code) => (
            <Chip key={code} active={equip === code} onClick={() => setEquip(code)}>
              {EQUIPMENT_LABELS[code] ?? code}
            </Chip>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card py-6 text-center text-sm text-fg-muted">
          Bu filtreye uygun hareket yok.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((e) => (
            <ExerciseCard key={e.id} exercise={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
        active ? "bg-brand text-black" : "bg-ink-soft text-fg-muted hover:text-fg"
      )}
    >
      {children}
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand bg-brand/10 text-brand"
          : "border-ink-border bg-ink-soft text-fg-muted hover:border-brand/40"
      )}
    >
      {children}
    </button>
  );
}
