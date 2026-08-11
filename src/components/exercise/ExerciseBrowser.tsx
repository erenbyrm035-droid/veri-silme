"use client";

import { useMemo, useState } from "react";
import type { Exercise } from "@/lib/database.types";
import {
  MUSCLE_GROUPS,
  EQUIPMENT_LABELS,
  DIFFICULTY_LABELS,
  CATEGORY_LABELS,
} from "@/lib/constants";
import { ExerciseCard } from "./ExerciseCard";
import { Search, SlidersHorizontal, X, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

type Env = "all" | "home" | "gym";

const EQUIPMENT_CODES = Object.keys(EQUIPMENT_LABELS);

export function ExerciseBrowser({
  exercises,
  favoriteIds = [],
}: {
  exercises: Exercise[];
  favoriteIds?: string[];
}) {
  const favSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [env, setEnv] = useState<Env>("all");
  const [onlyFav, setOnlyFav] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Veride mevcut kategoriler (kütüphane büyüdükçe otomatik genişler).
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const e of exercises) if (e.category) set.add(e.category);
    return Array.from(set);
  }, [exercises]);

  // Veride mevcut eğitim grupları (movement_type): Yoga, HIIT, Plyometric...
  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    for (const e of exercises) if (e.movement_type) set.add(e.movement_type);
    return Array.from(set).sort();
  }, [exercises]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      if (onlyFav && !favSet.has(e.id)) return false;
      if (
        q &&
        !e.name.toLowerCase().includes(q) &&
        !e.muscle_group.toLowerCase().includes(q) &&
        !(e.english_name?.toLowerCase().includes(q))
      )
        return false;
      if (muscle && e.muscle_group !== muscle) return false;
      if (equipment && e.equipment !== equipment) return false;
      if (difficulty && e.difficulty !== difficulty) return false;
      if (category && e.category !== category) return false;
      if (group && e.movement_type !== group) return false;
      if (env === "home" && !e.is_home) return false;
      if (env === "gym" && !e.is_gym) return false;
      return true;
    });
  }, [exercises, query, muscle, equipment, difficulty, category, group, env, onlyFav, favSet]);

  const activeCount =
    (muscle ? 1 : 0) + (equipment ? 1 : 0) + (difficulty ? 1 : 0) + (category ? 1 : 0) + (group ? 1 : 0) + (env !== "all" ? 1 : 0) + (onlyFav ? 1 : 0);

  function reset() {
    setMuscle(null);
    setEquipment(null);
    setDifficulty(null);
    setCategory(null);
    setGroup(null);
    setEnv("all");
    setOnlyFav(false);
  }

  return (
    <div className="space-y-4">
      {/* Arama + filtre aç/kapa */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted"
          />
          <input
            className="input pl-9"
            placeholder="Egzersiz ara (squat, göğüs, plank...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowFilters((s) => !s)}
          className={cn(
            "btn-ghost relative shrink-0",
            showFilters && "border-brand/60 text-brand"
          )}
        >
          <SlidersHorizontal size={16} /> Filtre
          {activeCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand text-xs font-bold text-black">
              {activeCount}
            </span>
          )}
        </button>
        {favoriteIds.length > 0 && (
          <button
            onClick={() => setOnlyFav((v) => !v)}
            aria-label="Favorileri göster"
            className={cn(
              "btn-ghost shrink-0",
              onlyFav && "border-coral/60 text-coral"
            )}
          >
            <Heart size={16} className={cn(onlyFav && "fill-coral")} />
          </button>
        )}
      </div>

      {/* Filtre paneli */}
      {showFilters && (
        <div className="card space-y-4">
          <FilterRow label="Kas grubu">
            {MUSCLE_GROUPS.map((m) => (
              <Chip key={m} active={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
                {m}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Ekipman">
            {EQUIPMENT_CODES.map((code) => (
              <Chip
                key={code}
                active={equipment === code}
                onClick={() => setEquipment(equipment === code ? null : code)}
              >
                {EQUIPMENT_LABELS[code]}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Zorluk">
            {(["beginner", "intermediate", "advanced"] as const).map((d) => (
              <Chip
                key={d}
                active={difficulty === d}
                onClick={() => setDifficulty(difficulty === d ? null : d)}
              >
                {DIFFICULTY_LABELS[d]}
              </Chip>
            ))}
          </FilterRow>
          {availableCategories.length > 1 && (
            <FilterRow label="Kategori">
              {availableCategories.map((c) => (
                <Chip
                  key={c}
                  active={category === c}
                  onClick={() => setCategory(category === c ? null : c)}
                >
                  {CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c}
                </Chip>
              ))}
            </FilterRow>
          )}
          {availableGroups.length > 1 && (
            <FilterRow label="Eğitim türü">
              {availableGroups.map((g) => (
                <Chip key={g} active={group === g} onClick={() => setGroup(group === g ? null : g)}>
                  {g}
                </Chip>
              ))}
            </FilterRow>
          )}
          <FilterRow label="Ortam">
            {(
              [
                ["all", "Hepsi"],
                ["home", "Ev"],
                ["gym", "Salon"],
              ] as const
            ).map(([v, label]) => (
              <Chip key={v} active={env === v} onClick={() => setEnv(v as Env)}>
                {label}
              </Chip>
            ))}
          </FilterRow>
          {activeCount > 0 && (
            <button onClick={reset} className="inline-flex items-center gap-1 text-sm text-coral">
              <X size={14} /> Filtreleri temizle
            </button>
          )}
        </div>
      )}

      {/* Sonuç sayısı */}
      <p className="text-sm text-fg-muted">
        {filtered.length} egzersiz
        {query || activeCount > 0 ? " (filtreli)" : ""}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card py-12 text-center text-sm text-fg-muted">
          Aramanıza uygun egzersiz bulunamadı.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <ExerciseCard key={e.id} exercise={e} favorite={favSet.has(e.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
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
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-brand bg-brand/10 text-brand"
          : "border-ink-border bg-ink-soft text-fg-muted hover:border-brand/40"
      )}
    >
      {children}
    </button>
  );
}
