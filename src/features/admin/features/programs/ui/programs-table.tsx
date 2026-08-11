"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Star } from "lucide-react";
import { Checkbox } from "@/features/admin/components/ui/checkbox";
import { EmptyState } from "@/features/admin/components/states/empty-state";
import { CoverThumb } from "./cover-thumb";
import { ProgramStatusBadge, LevelBadge } from "./badges";
import { ProgramRowActions } from "./program-row-actions";
import { ProgramsBulkBar } from "./programs-bulk-bar";
import { CATEGORY_FALLBACK } from "../constants";
import type { AdminProgramRow } from "@/lib/database.types";

const CATEGORY_NAME = new Map(CATEGORY_FALLBACK.map((c) => [c.slug, c.name]));

function timeAgo(iso: string): string {
  const day = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (day <= 0) return "bugün";
  if (day < 30) return `${day}g önce`;
  const mo = Math.floor(day / 30);
  return mo < 12 ? `${mo}ay önce` : `${Math.floor(mo / 12)}y önce`;
}

export function ProgramsTable({ rows, categories }: { rows: AdminProgramRow[]; categories: { slug: string; name: string }[] }) {
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

  function toggleAll() { setSelected(allChecked ? new Set() : new Set(rowIds)); }
  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  if (rows.length === 0) {
    return <EmptyState icon={CalendarDays} title="Program bulunamadı" description="Filtrelerinize uyan program yok. Yeni bir program oluşturabilir veya şablon kullanabilirsiniz." />;
  }

  return (
    <div className="space-y-3">
      <ProgramsBulkBar selectedIds={[...selected]} selectedRows={selectedRows} categories={categories} onClear={() => setSelected(new Set())} />
      <div className="overflow-x-auto rounded-2xl border border-ink-border bg-ink-card">
        <table className="w-full min-w-[1050px] text-sm">
          <thead>
            <tr className="border-b border-ink-border text-left text-xs text-fg-muted">
              <th className="w-10 px-4 py-3"><Checkbox checked={allChecked} indeterminate={someChecked} onCheckedChange={toggleAll} aria-label="Tümü" /></th>
              <th className="w-14 px-2 py-3 font-medium">Kapak</th>
              <th className="px-2 py-3 font-medium">Program</th>
              <th className="px-2 py-3 font-medium">Kategori</th>
              <th className="px-2 py-3 font-medium">Seviye</th>
              <th className="px-2 py-3 font-medium">Hafta/Gün</th>
              <th className="px-2 py-3 font-medium">Egzersiz</th>
              <th className="px-2 py-3 font-medium">Süre</th>
              <th className="px-2 py-3 font-medium">Puan</th>
              <th className="px-2 py-3 font-medium">Durum</th>
              <th className="px-2 py-3 font-medium">Güncelleme</th>
              <th className="w-12 px-4 py-3 text-right font-medium">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const checked = selected.has(p.id);
              return (
                <tr key={p.id} className={`border-b border-ink-border/60 transition-colors last:border-0 hover:bg-fg/[0.02] ${checked ? "bg-brand/[0.04]" : ""}`}>
                  <td className="px-4 py-2.5"><Checkbox checked={checked} onCheckedChange={() => toggle(p.id)} aria-label="Seç" /></td>
                  <td className="px-2 py-2.5"><CoverThumb url={p.cover_url} size={40} /></td>
                  <td className="px-2 py-2.5">
                    <Link href={`/admin/programs/${p.id}`} className="group block min-w-0">
                      <p className="truncate font-medium group-hover:text-brand">{p.name}</p>
                      <p className="truncate text-xs text-fg-muted">{p.slug}</p>
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-fg-muted">{p.category ? CATEGORY_NAME.get(p.category) ?? p.category : "—"}</td>
                  <td className="px-2 py-2.5"><LevelBadge level={p.level} /></td>
                  <td className="px-2 py-2.5 text-fg-muted">{p.weeks}h / {p.total_days}g</td>
                  <td className="px-2 py-2.5 text-fg-muted">{p.total_exercises}</td>
                  <td className="px-2 py-2.5 text-fg-muted">{p.est_minutes ? `${p.est_minutes}dk` : "—"}</td>
                  <td className="px-2 py-2.5">
                    {p.rating_count > 0 ? (
                      <span className="inline-flex items-center gap-1 text-fg"><Star size={13} className="fill-amber-400 text-amber-400" /> {p.rating_avg} <span className="text-xs text-fg-muted">({p.rating_count})</span></span>
                    ) : <span className="text-fg-muted">—</span>}
                  </td>
                  <td className="px-2 py-2.5"><ProgramStatusBadge status={p.status} /></td>
                  <td className="px-2 py-2.5 text-fg-muted">{timeAgo(p.updated_at)}</td>
                  <td className="px-4 py-2.5 text-right"><ProgramRowActions program={p} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
