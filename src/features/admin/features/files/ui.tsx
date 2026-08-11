"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { File, Trash2, FolderOpen, Download } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Select } from "@/features/admin/components/ui/select";
import { EmptyState } from "@/features/admin/components/states/empty-state";
import { ConfirmDialog } from "@/features/admin/features/users/ui/confirm-dialog";
import { deleteObject } from "./actions";

export interface StorageObj { name: string; size: number; publicUrl: string | null; updated_at: string | null; }

export function FilesBrowser({ buckets, bucket, objects }: { buckets: string[]; bucket: string; objects: StorageObj[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const [del, setDel] = React.useState<string | null>(null);

  function selectBucket(b: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("bucket", b);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-56">
          <Select value={bucket} onChange={(e) => selectBucket(e.target.value)} aria-label="Bucket">
            {buckets.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        </div>
        <span className="text-sm text-fg-muted">{objects.length} dosya</span>
      </div>

      {objects.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Dosya yok" description="Bu bucket boş görünüyor." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-ink-border text-left text-xs text-fg-muted">
              <th className="px-4 py-3 font-medium">Dosya</th><th className="px-2 py-3 font-medium">Boyut</th>
              <th className="px-2 py-3 font-medium">Güncelleme</th><th className="w-24 px-4 py-3 text-right font-medium">İşlem</th>
            </tr></thead>
            <tbody>
              {objects.map((o) => (
                <tr key={o.name} className="border-b border-ink-border/60 last:border-0 hover:bg-fg/[0.02]">
                  <td className="px-4 py-2.5"><span className="flex items-center gap-2 min-w-0"><File size={14} className="shrink-0 text-fg-muted" /><span className="truncate">{o.name}</span></span></td>
                  <td className="px-2 py-2.5 text-fg-muted">{o.size ? `${(o.size / 1024).toFixed(0)} KB` : "—"}</td>
                  <td className="px-2 py-2.5 text-fg-muted">{o.updated_at ? new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(new Date(o.updated_at)) : "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      {o.publicUrl && <a href={o.publicUrl} target="_blank" rel="noreferrer" className="rounded p-1 text-fg-muted hover:text-brand" aria-label="Aç"><Download size={15} /></a>}
                      <button onClick={() => setDel(o.name)} className="rounded p-1 text-fg-muted hover:text-coral" aria-label="Sil"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Dosyayı sil" description={`"${del}" bucket'tan kalıcı olarak silinecek.`} confirmLabel="Sil" destructive loading={isPending}
        onConfirm={() => del && startTransition(async () => { await deleteObject(bucket, del); setDel(null); router.refresh(); })} />
    </div>
  );
}
