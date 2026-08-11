"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Download, Upload, Copy, Images } from "lucide-react";
import { Button } from "@/features/admin/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/features/admin/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/features/admin/components/ui/dialog";
import { exportExercises, importExercises, autoMatchGifs } from "../actions";
import { parseCsv, normalizeImportRow } from "../io";
import { download } from "./download";

export function ExercisesHeaderTools() {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [importOpen, setImportOpen] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  function doExport(format: "csv" | "json") {
    startTransition(async () => {
      const res = await exportExercises(format);
      if (res.ok && res.data) download(res.data.content, res.data.filename, res.data.mime);
    });
  }

  function doAutoMatch() {
    setResult(null);
    startTransition(async () => {
      const res = await autoMatchGifs();
      if (res.ok && res.data) {
        setResult(`${res.data.assigned} egzersize GIF atandı.`);
        router.refresh();
      }
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    const text = await file.text();
    let rows: Record<string, unknown>[] = [];
    try {
      if (file.name.endsWith(".json")) {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : [];
      } else {
        rows = parseCsv(text);
      }
    } catch {
      setError("Dosya ayrıştırılamadı.");
      return;
    }
    rows = rows.map(normalizeImportRow);
    if (rows.length === 0) {
      setError("İçe aktarılacak satır bulunamadı.");
      return;
    }
    startTransition(async () => {
      const res = await importExercises({ rows });
      if (!res.ok) return setError(res.error ?? "İçe aktarma başarısız.");
      setResult(`${res.data?.inserted ?? 0} eklendi, ${res.data?.failed ?? 0} atlandı.`);
      router.refresh();
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href="/admin/exercises/duplicates">
          <Copy size={15} /> Tekrarlar
        </Link>
      </Button>
      <Button variant="outline" size="sm" disabled={isPending} onClick={doAutoMatch}>
        <Images size={15} /> GIF Eşleştir
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download size={15} /> İçe/Dışa Aktar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Dışa aktar</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => doExport("csv")}><Download size={15} /> CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doExport("json")}><Download size={15} /> JSON</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>İçe aktar</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setImportOpen(true)}><Upload size={15} /> CSV / JSON</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button asChild size="sm">
        <Link href="/admin/exercises/new">
          <Plus size={15} /> Yeni Egzersiz
        </Link>
      </Button>

      {result && <span className="w-full text-xs text-emerald-400 sm:w-auto">{result}</span>}

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Egzersiz İçe Aktar</DialogTitle>
            <DialogDescription>
              CSV veya JSON dosyası seç. Zorunlu sütun: <code>name</code>. Diziler
              (secondary_muscles, tags, instructions) <code>|</code> veya <code>,</code> ile ayrılır.
            </DialogDescription>
          </DialogHeader>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json"
            onChange={onFile}
            className="block w-full text-sm text-fg-muted file:mr-3 file:rounded-lg file:border-0 file:bg-ink-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-fg"
          />
          {error && <p className="mt-2 text-sm text-coral">{error}</p>}
          {result && <p className="mt-2 text-sm text-emerald-400">{result}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
