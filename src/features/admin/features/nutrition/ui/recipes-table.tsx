"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChefHat, MoreHorizontal, Pencil, Eye, EyeOff, Trash2 } from "lucide-react";
import { Button } from "@/features/admin/components/ui/button";
import { EmptyState } from "@/features/admin/components/states/empty-state";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/features/admin/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/features/admin/features/users/ui/confirm-dialog";
import { ImageThumb, ContentStatusBadge } from "./shared";
import { setRecipeStatus, deleteRecipe } from "../actions";
import type { Recipe } from "@/lib/database.types";

export function RecipesTable({ rows }: { rows: Recipe[] }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [del, setDel] = React.useState<Recipe | null>(null);

  function run(fn: () => Promise<{ ok: boolean }>, after?: () => void) {
    startTransition(async () => { await fn(); after?.(); router.refresh(); });
  }
  if (rows.length === 0) return <EmptyState icon={ChefHat} title="Tarif bulunamadı" description="Filtrelerinize uyan tarif yok. Yeni bir tarif oluşturabilirsiniz." />;

  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-border bg-ink-card">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-ink-border text-left text-xs text-fg-muted">
            <th className="w-14 px-4 py-3 font-medium">Kapak</th>
            <th className="px-2 py-3 font-medium">Tarif</th>
            <th className="px-2 py-3 font-medium">Porsiyon</th>
            <th className="px-2 py-3 font-medium">Kalori</th>
            <th className="px-2 py-3 font-medium">P / K / Y</th>
            <th className="px-2 py-3 font-medium">Süre</th>
            <th className="px-2 py-3 font-medium">Durum</th>
            <th className="w-12 px-4 py-3 text-right font-medium">İşlem</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-ink-border/60 transition-colors last:border-0 hover:bg-fg/[0.02]">
              <td className="px-4 py-2.5"><ImageThumb url={r.cover_url} size={38} /></td>
              <td className="px-2 py-2.5">
                <Link href={`/admin/nutrition/recipes/${r.id}`} className="group block min-w-0">
                  <p className="truncate font-medium group-hover:text-brand">{r.name}</p>
                  <p className="truncate text-xs text-fg-muted">{r.category ?? "—"}</p>
                </Link>
              </td>
              <td className="px-2 py-2.5 text-fg-muted">{r.servings}</td>
              <td className="px-2 py-2.5 font-medium">{Math.round(r.calories)}</td>
              <td className="px-2 py-2.5 text-fg-muted">{Math.round(r.protein_g)} / {Math.round(r.carbs_g)} / {Math.round(r.fat_g)}</td>
              <td className="px-2 py-2.5 text-fg-muted">{(r.prep_minutes ?? 0) + (r.cook_minutes ?? 0)} dk</td>
              <td className="px-2 py-2.5"><ContentStatusBadge status={r.status} /></td>
              <td className="px-4 py-2.5 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal size={18} /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild><Link href={`/admin/nutrition/recipes/${r.id}`}><Pencil size={16} /> Düzenle</Link></DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {r.status === "published"
                      ? <DropdownMenuItem onClick={() => run(() => setRecipeStatus({ id: r.id, status: "draft" }))}><EyeOff size={16} /> Taslağa Al</DropdownMenuItem>
                      : <DropdownMenuItem onClick={() => run(() => setRecipeStatus({ id: r.id, status: "published" }))}><Eye size={16} /> Yayınla</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-coral focus:bg-coral/10" onClick={() => setDel(r)}><Trash2 size={16} /> Sil</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Tarifi sil" description={`"${del?.name}" silinecek.`} confirmLabel="Sil" destructive loading={isPending}
        onConfirm={() => del && run(() => deleteRecipe({ id: del.id }), () => setDel(null))} />
    </div>
  );
}
