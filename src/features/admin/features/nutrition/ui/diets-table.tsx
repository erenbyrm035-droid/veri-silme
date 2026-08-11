"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Salad, MoreHorizontal, Pencil, Eye, EyeOff, Trash2 } from "lucide-react";
import { Button } from "@/features/admin/components/ui/button";
import { EmptyState } from "@/features/admin/components/states/empty-state";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/features/admin/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/features/admin/features/users/ui/confirm-dialog";
import { ImageThumb, ContentStatusBadge } from "./shared";
import { DIET_CATEGORY_NAME } from "../constants";
import { setDietStatus, deleteDiet } from "../actions";
import type { DietPlan } from "@/lib/database.types";

export function DietsTable({ rows }: { rows: DietPlan[] }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [del, setDel] = React.useState<DietPlan | null>(null);
  function run(fn: () => Promise<{ ok: boolean }>, after?: () => void) { startTransition(async () => { await fn(); after?.(); router.refresh(); }); }
  if (rows.length === 0) return <EmptyState icon={Salad} title="Diyet planı bulunamadı" description="Filtrelerinize uyan plan yok. Yeni bir diyet planı oluşturabilirsiniz." />;

  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-border bg-ink-card">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-ink-border text-left text-xs text-fg-muted">
            <th className="w-14 px-4 py-3 font-medium">Kapak</th>
            <th className="px-2 py-3 font-medium">Plan</th>
            <th className="px-2 py-3 font-medium">Kategori</th>
            <th className="px-2 py-3 font-medium">Gün</th>
            <th className="px-2 py-3 font-medium">Kalori</th>
            <th className="px-2 py-3 font-medium">P / K / Y</th>
            <th className="px-2 py-3 font-medium">Durum</th>
            <th className="w-12 px-4 py-3 text-right font-medium">İşlem</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-b border-ink-border/60 transition-colors last:border-0 hover:bg-fg/[0.02]">
              <td className="px-4 py-2.5"><ImageThumb url={d.cover_url} size={38} /></td>
              <td className="px-2 py-2.5">
                <Link href={`/admin/nutrition/diets/${d.id}`} className="group block min-w-0">
                  <p className="truncate font-medium group-hover:text-brand">{d.name}</p>
                  <p className="truncate text-xs text-fg-muted">{d.goal ?? "—"}</p>
                </Link>
              </td>
              <td className="px-2 py-2.5 text-fg-muted">{d.category ? DIET_CATEGORY_NAME.get(d.category) ?? d.category : "—"}</td>
              <td className="px-2 py-2.5 text-fg-muted">{d.days}</td>
              <td className="px-2 py-2.5 font-medium">{d.total_calories ?? "—"}</td>
              <td className="px-2 py-2.5 text-fg-muted">{d.protein_g ?? "-"} / {d.carbs_g ?? "-"} / {d.fat_g ?? "-"}</td>
              <td className="px-2 py-2.5"><ContentStatusBadge status={d.status} /></td>
              <td className="px-4 py-2.5 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal size={18} /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild><Link href={`/admin/nutrition/diets/${d.id}`}><Pencil size={16} /> Düzenle</Link></DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {d.status === "published"
                      ? <DropdownMenuItem onClick={() => run(() => setDietStatus({ id: d.id, status: "draft" }))}><EyeOff size={16} /> Taslağa Al</DropdownMenuItem>
                      : <DropdownMenuItem onClick={() => run(() => setDietStatus({ id: d.id, status: "published" }))}><Eye size={16} /> Yayınla</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-coral focus:bg-coral/10" onClick={() => setDel(d)}><Trash2 size={16} /> Sil</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Diyet planını sil" description={`"${del?.name}" ve tüm gün/öğünleri silinecek.`} confirmLabel="Sil" destructive loading={isPending}
        onConfirm={() => del && run(() => deleteDiet({ id: del.id }), () => setDel(null))} />
    </div>
  );
}
