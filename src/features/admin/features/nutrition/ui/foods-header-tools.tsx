"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Download, Upload } from "lucide-react";
import { Button } from "@/features/admin/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/features/admin/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/features/admin/components/ui/dialog";
import { exportFoods, importFoods } from "../actions";
import { parseCsv, normalizeImportRow } from "@/features/admin/features/exercises/io";
import { download } from "@/features/admin/features/exercises/ui/download";

export function FoodsHeaderTools() {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const [importOpen, setImportOpen] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  function doExport(format: "csv" | "json") {
    startTransition(async () => { const res = await exportFoods(format); if (res.ok && res.data) download(res.data.content, res.data.filename, res.data.mime); });
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setMsg(null);
    let rows: Record<string, unknown>[] = [];
    try { rows = file.name.endsWith(".json") ? (JSON.parse(await file.text()) as Record<string, unknown>[]) : parseCsv(await file.text()); }
    catch { setError("Dosya ayrıştırılamadı."); return; }
    rows = (Array.isArray(rows) ? rows : []).map(normalizeImportRow);
    if (rows.length === 0) { setError("Satır bulunamadı."); return; }
    startTransition(async () => {
      const res = await importFoods({ rows });
      if (!res.ok) return setError(res.error ?? "İçe aktarma başarısız.");
      setMsg(`${res.data?.inserted ?? 0} eklendi, ${res.data?.updated ?? 0} güncellendi, ${res.data?.failed ?? 0} atlandı.`);
      router.refresh();
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Download size={15} /> İçe/Dışa Aktar</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Dışa aktar</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => doExport("csv")}><Download size={15} /> CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doExport("json")}><Download size={15} /> JSON</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setImportOpen(true)}><Upload size={15} /> CSV / JSON içe aktar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button asChild size="sm"><Link href="/admin/nutrition/foods/new"><Plus size={15} /> Yeni Besin</Link></Button>
      {msg && <span className="w-full text-xs text-emerald-400 sm:w-auto">{msg}</span>}

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Besin İçe Aktar</DialogTitle>
            <DialogDescription>
              CSV/JSON seç. Zorunlu: <code>name</code>. <code>external_source</code> + <code>external_id</code> varsa (ör. TÜRKOMP) mevcut kayıt güncellenir.
            </DialogDescription>
          </DialogHeader>
          <input ref={fileRef} type="file" accept=".csv,.json" onChange={onFile}
            className="block w-full text-sm text-fg-muted file:mr-3 file:rounded-lg file:border-0 file:bg-ink-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-fg" />
          {error && <p className="mt-2 text-sm text-coral">{error}</p>}
          {msg && <p className="mt-2 text-sm text-emerald-400">{msg}</p>}
          <DialogFooter><Button variant="ghost" onClick={() => setImportOpen(false)}>Kapat</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
