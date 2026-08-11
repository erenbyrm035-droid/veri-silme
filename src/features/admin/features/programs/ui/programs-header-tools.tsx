"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, LayoutTemplate, Download, Upload } from "lucide-react";
import { Button } from "@/features/admin/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/features/admin/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/features/admin/components/ui/dialog";
import { PROGRAM_TEMPLATES } from "../templates";
import { applyTemplate, exportPrograms, importPrograms } from "../actions";
import { download } from "@/features/admin/features/exercises/ui/download";

export function ProgramsHeaderTools() {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [tplOpen, setTplOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  function useTemplate(slug: string) {
    startTransition(async () => {
      const res = await applyTemplate({ templateSlug: slug });
      if (res.ok && res.data) { setTplOpen(false); router.push(`/admin/programs/${res.data.id}`); }
    });
  }
  function doExport(format: "csv" | "json") {
    startTransition(async () => {
      const res = await exportPrograms(format);
      if (res.ok && res.data) download(res.data.content, res.data.filename, res.data.mime);
    });
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setMsg(null);
    let programs: Record<string, unknown>[] = [];
    try { const parsed = JSON.parse(await file.text()); programs = Array.isArray(parsed) ? parsed : []; }
    catch { setError("Yalnızca JSON içe aktarma desteklenir."); return; }
    if (programs.length === 0) { setError("İçe aktarılacak program bulunamadı."); return; }
    startTransition(async () => {
      const res = await importPrograms({ programs });
      if (!res.ok) return setError(res.error ?? "İçe aktarma başarısız.");
      setMsg(`${res.data?.inserted ?? 0} eklendi, ${res.data?.failed ?? 0} atlandı.`);
      router.refresh();
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setTplOpen(true)}><LayoutTemplate size={15} /> Şablonlar</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Download size={15} /> İçe/Dışa Aktar</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Dışa aktar</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => doExport("json")}><Download size={15} /> JSON (ağaç)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doExport("csv")}><Download size={15} /> CSV</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setImportOpen(true)}><Upload size={15} /> JSON içe aktar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button asChild size="sm"><Link href="/admin/programs/new"><Plus size={15} /> Yeni Program</Link></Button>
      {msg && <span className="w-full text-xs text-emerald-400 sm:w-auto">{msg}</span>}

      {/* Şablon galerisi */}
      <Dialog open={tplOpen} onOpenChange={setTplOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Program Şablonları</DialogTitle>
            <DialogDescription>Bir şablon seç; taslak program otomatik oluşturulup düzenleyiciye gidersin.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-80 grid-cols-2 gap-2 overflow-auto">
            {PROGRAM_TEMPLATES.map((t) => (
              <button key={t.slug} disabled={isPending} onClick={() => useTemplate(t.slug)}
                className="rounded-xl border border-ink-border bg-ink-soft/50 p-3 text-left transition-colors hover:border-brand hover:bg-brand/5 disabled:opacity-50">
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="mt-0.5 text-xs text-fg-muted">{t.weeks} hafta · {t.days.length} gün/hafta</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* İçe aktar */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Program İçe Aktar (JSON)</DialogTitle>
            <DialogDescription>Dışa aktarılan JSON dosyasını seç. Gün/egzersiz ağacı da içe aktarılır.</DialogDescription>
          </DialogHeader>
          <input ref={fileRef} type="file" accept=".json" onChange={onFile}
            className="block w-full text-sm text-fg-muted file:mr-3 file:rounded-lg file:border-0 file:bg-ink-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-fg" />
          {error && <p className="mt-2 text-sm text-coral">{error}</p>}
          {msg && <p className="mt-2 text-sm text-emerald-400">{msg}</p>}
          <DialogFooter><Button variant="ghost" onClick={() => setImportOpen(false)}>Kapat</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
