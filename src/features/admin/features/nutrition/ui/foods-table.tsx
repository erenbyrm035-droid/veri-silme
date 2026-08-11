"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Apple, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { Checkbox } from "@/features/admin/components/ui/checkbox";
import { Button } from "@/features/admin/components/ui/button";
import { EmptyState } from "@/features/admin/components/states/empty-state";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/features/admin/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/features/admin/features/users/ui/confirm-dialog";
import { download } from "@/features/admin/features/exercises/ui/download";
import { ImageThumb, VerifiedBadge } from "./shared";
import { FOOD_CATEGORY_NAME } from "../constants";
import { deleteFood, bulkDeleteFoods } from "../actions";
import type { AdminFoodRow } from "@/lib/database.types";

export function FoodsTable({ rows }: { rows: AdminFoodRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [isPending, startTransition] = React.useTransition();
  const [confirmBulk, setConfirmBulk] = React.useState(false);
  const [delRow, setDelRow] = React.useState<AdminFoodRow | null>(null);
  const rowIds = React.useMemo(() => rows.map((r) => r.id), [rows]);

  React.useEffect(() => {
    setSelected((prev) => { const n = new Set<string>(); prev.forEach((id) => rowIds.includes(id) && n.add(id)); return n.size === prev.size ? prev : n; });
  }, [rowIds]);

  const allChecked = rows.length > 0 && selected.size === rows.length;
  const someChecked = selected.size > 0 && !allChecked;
  const selectedRows = rows.filter((r) => selected.has(r.id));

  function toggleAll() { setSelected(allChecked ? new Set() : new Set(rowIds)); }
  function toggle(id: string) { setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function run(fn: () => Promise<{ ok: boolean }>, after?: () => void) {
    startTransition(async () => { await fn(); after?.(); setSelected(new Set()); router.refresh(); });
  }

  if (rows.length === 0) {
    return <EmptyState icon={Apple} title="Besin bulunamadı" description="Filtrelerinize uyan besin yok. Yeni bir besin ekleyebilir veya toplu içe aktarabilirsiniz." />;
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-ink-border bg-ink-card/95 p-3 shadow-lg backdrop-blur">
          <Button variant="ghost" size="icon" onClick={() => setSelected(new Set())}><X size={16} /></Button>
          <span className="text-sm font-semibold">{selected.size} seçili</span>
          <div className="mx-1 h-5 w-px bg-ink-border" />
          <Button variant="secondary" size="sm" onClick={() => download(JSON.stringify(selectedRows, null, 2), `secili-besinler-${new Date().toISOString().slice(0,10)}.json`, "application/json")}>Dışa Aktar</Button>
          <Button variant="destructive" size="sm" disabled={isPending} onClick={() => setConfirmBulk(true)}><Trash2 size={15} /> Sil</Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-ink-border bg-ink-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-ink-border text-left text-xs text-fg-muted">
              <th className="w-10 px-4 py-3"><Checkbox checked={allChecked} indeterminate={someChecked} onCheckedChange={toggleAll} aria-label="Tümü" /></th>
              <th className="w-14 px-2 py-3 font-medium">Görsel</th>
              <th className="px-2 py-3 font-medium">Besin</th>
              <th className="px-2 py-3 font-medium">Kategori</th>
              <th className="px-2 py-3 font-medium">Porsiyon</th>
              <th className="px-2 py-3 font-medium">Kalori</th>
              <th className="px-2 py-3 font-medium">P / K / Y</th>
              <th className="px-2 py-3 font-medium">Durum</th>
              <th className="w-12 px-4 py-3 text-right font-medium">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const checked = selected.has(f.id);
              return (
                <tr key={f.id} className={`border-b border-ink-border/60 transition-colors last:border-0 hover:bg-fg/[0.02] ${checked ? "bg-brand/[0.04]" : ""}`}>
                  <td className="px-4 py-2.5"><Checkbox checked={checked} onCheckedChange={() => toggle(f.id)} aria-label="Seç" /></td>
                  <td className="px-2 py-2.5"><ImageThumb url={f.image_url} size={38} /></td>
                  <td className="px-2 py-2.5">
                    <Link href={`/admin/nutrition/foods/${f.id}`} className="group block min-w-0">
                      <p className="truncate font-medium group-hover:text-brand">{f.name}</p>
                      <p className="truncate text-xs text-fg-muted">{f.brand ?? (f.external_source ? f.external_source : "—")}{f.barcode ? ` · ${f.barcode}` : ""}</p>
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-fg-muted">{f.category ? FOOD_CATEGORY_NAME.get(f.category) ?? f.category : "—"}</td>
                  <td className="px-2 py-2.5 text-fg-muted">{f.serving_grams ?? 100} g</td>
                  <td className="px-2 py-2.5 font-medium">{Math.round(f.calories)}</td>
                  <td className="px-2 py-2.5 text-fg-muted">{Math.round(f.protein_g)} / {Math.round(f.carbs_g)} / {Math.round(f.fat_g)}</td>
                  <td className="px-2 py-2.5"><VerifiedBadge verified={f.is_verified} /></td>
                  <td className="px-4 py-2.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="İşlemler"><MoreHorizontal size={18} /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><Link href={`/admin/nutrition/foods/${f.id}`}><Pencil size={16} /> Düzenle</Link></DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-coral focus:bg-coral/10" onClick={() => setDelRow(f)}><Trash2 size={16} /> Sil</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog open={confirmBulk} onOpenChange={setConfirmBulk} title={`${selected.size} besini sil`} description="Bu işlem geri alınamaz." confirmLabel="Sil" destructive loading={isPending}
        onConfirm={() => run(() => bulkDeleteFoods({ ids: [...selected] }), () => setConfirmBulk(false))} />
      <ConfirmDialog open={!!delRow} onOpenChange={(o) => !o && setDelRow(null)} title="Besini sil" description={`"${delRow?.name}" kalıcı olarak silinecek.`} confirmLabel="Sil" destructive loading={isPending}
        onConfirm={() => delRow && run(() => deleteFood({ id: delRow.id }), () => setDelRow(null))} />
    </div>
  );
}
