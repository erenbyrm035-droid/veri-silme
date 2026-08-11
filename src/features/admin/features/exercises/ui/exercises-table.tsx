"use client";

import * as React from "react";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { Checkbox } from "@/features/admin/components/ui/checkbox";
import { EmptyState } from "@/features/admin/components/states/empty-state";
import { GifThumb } from "./gif-thumb";
import { StatusBadge, CategoryBadge, DifficultyBadge } from "./badges";
import { ExerciseRowActions } from "./exercise-row-actions";
import { ExercisesBulkBar } from "./exercises-bulk-bar";
import type { AdminExerciseRow } from "@/lib/database.types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const day = Math.floor(diff / 86400000);
  if (day <= 0) return "bugün";
  if (day < 30) return `${day}g önce`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}ay önce`;
  return `${Math.floor(mo / 12)}y önce`;
}

export function ExercisesTable({ rows }: { rows: AdminExerciseRow[] }) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const rowIds = React.useMemo(() => rows.map((r) => r.id), [rows]);

  React.useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => rowIds.includes(id) && next.add(id));
      return next.size === prev.size ? prev : next;
    });
  }, [rowIds]);

  const allChecked = rows.length > 0 && selected.size === rows.length;
  const someChecked = selected.size > 0 && !allChecked;
  const selectedRows = rows.filter((r) => selected.has(r.id));

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(rowIds));
  }
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Dumbbell}
        title="Egzersiz bulunamadı"
        description="Arama veya filtre kriterlerinize uyan egzersiz yok. Yeni bir egzersiz ekleyebilirsiniz."
      />
    );
  }

  return (
    <div className="space-y-3">
      <ExercisesBulkBar selectedIds={[...selected]} selectedRows={selectedRows} onClear={() => setSelected(new Set())} />

      <div className="overflow-x-auto rounded-2xl border border-ink-border bg-ink-card">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-ink-border text-left text-xs text-fg-muted">
              <th className="w-10 px-4 py-3">
                <Checkbox checked={allChecked} indeterminate={someChecked} onCheckedChange={toggleAll} aria-label="Tümünü seç" />
              </th>
              <th className="w-14 px-2 py-3 font-medium">GIF</th>
              <th className="px-2 py-3 font-medium">Egzersiz</th>
              <th className="px-2 py-3 font-medium">Kategori</th>
              <th className="px-2 py-3 font-medium">Ana Kas</th>
              <th className="px-2 py-3 font-medium">Zorluk</th>
              <th className="px-2 py-3 font-medium">Ekipman</th>
              <th className="px-2 py-3 font-medium">Durum</th>
              <th className="px-2 py-3 font-medium">Güncelleme</th>
              <th className="w-12 px-4 py-3 text-right font-medium">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ex) => {
              const checked = selected.has(ex.id);
              return (
                <tr
                  key={ex.id}
                  className={`border-b border-ink-border/60 transition-colors last:border-0 hover:bg-fg/[0.02] ${checked ? "bg-brand/[0.04]" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <Checkbox checked={checked} onCheckedChange={() => toggle(ex.id)} aria-label="Seç" />
                  </td>
                  <td className="px-2 py-2.5">
                    <GifThumb exercise={ex} size={40} />
                  </td>
                  <td className="px-2 py-2.5">
                    <Link href={`/admin/exercises/${ex.id}`} className="group block min-w-0">
                      <p className="truncate font-medium group-hover:text-brand">{ex.name}</p>
                      <p className="truncate text-xs text-fg-muted">{ex.slug ?? "—"}</p>
                    </Link>
                  </td>
                  <td className="px-2 py-2.5">
                    <CategoryBadge category={ex.category} />
                    {ex.subcategory && <p className="mt-0.5 text-xs text-fg-muted">{ex.subcategory}</p>}
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="font-medium">{ex.muscle_group}</span>
                    {ex.secondary_muscles.length > 0 && (
                      <p className="truncate text-xs text-fg-muted">+{ex.secondary_muscles.join(", ")}</p>
                    )}
                  </td>
                  <td className="px-2 py-2.5"><DifficultyBadge difficulty={ex.difficulty} /></td>
                  <td className="px-2 py-2.5 text-fg-muted">{ex.equipment ?? "—"}</td>
                  <td className="px-2 py-2.5"><StatusBadge status={ex.status} /></td>
                  <td className="px-2 py-2.5 text-fg-muted">{timeAgo(ex.updated_at)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <ExerciseRowActions exercise={ex} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
