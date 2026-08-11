"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal, Pencil, Eye, EyeOff, Copy, Trash2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/features/admin/components/ui/dropdown-menu";
import { Button } from "@/features/admin/components/ui/button";
import { ConfirmDialog } from "@/features/admin/features/users/ui/confirm-dialog";
import { setStatus, deleteProgram, duplicateProgram } from "../actions";
import type { AdminProgramRow } from "@/lib/database.types";

export function ProgramRowActions({ program }: { program: AdminProgramRow }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string; data?: { id: string } }>, opts?: { close?: boolean; goto?: boolean }) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "İşlem başarısız.");
      if (opts?.close) setConfirmDelete(false);
      if (opts?.goto && res.data?.id) { router.push(`/admin/programs/${res.data.id}`); return; }
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="İşlemler"><MoreHorizontal size={18} /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/programs/${program.id}`}><Pencil size={16} /> Düzenle</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run(() => duplicateProgram({ id: program.id }), { goto: true })}>
            <Copy size={16} /> Çoğalt
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {program.status === "published" ? (
            <DropdownMenuItem onClick={() => run(() => setStatus({ id: program.id, status: "draft" }))}><EyeOff size={16} /> Taslağa Al</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => run(() => setStatus({ id: program.id, status: "published" }))}><Eye size={16} /> Yayınla</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-coral focus:bg-coral/10" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /> Sil</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete}
        title="Programı sil" description={`"${program.name}" ve tüm gün/egzersizleri silinecek. Geri alınamaz.`}
        confirmLabel="Sil" destructive loading={isPending} error={error}
        onConfirm={() => run(() => deleteProgram({ id: program.id }), { close: true })} />
    </>
  );
}
