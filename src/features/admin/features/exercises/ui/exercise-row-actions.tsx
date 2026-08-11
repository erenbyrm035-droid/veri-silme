"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal, Pencil, Eye, EyeOff, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/features/admin/components/ui/dropdown-menu";
import { Button } from "@/features/admin/components/ui/button";
import { ConfirmDialog } from "@/features/admin/features/users/ui/confirm-dialog";
import { setStatus, deleteExercise } from "../actions";
import type { AdminExerciseRow } from "@/lib/database.types";

export function ExerciseRowActions({ exercise }: { exercise: AdminExerciseRow }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, close = false) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "İşlem başarısız.");
      if (close) setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="İşlemler">
            <MoreHorizontal size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/exercises/${exercise.id}`}>
              <Pencil size={16} /> Düzenle
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {exercise.status === "published" ? (
            <DropdownMenuItem onClick={() => run(() => setStatus({ id: exercise.id, status: "draft" }))}>
              <EyeOff size={16} /> Taslağa Al
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => run(() => setStatus({ id: exercise.id, status: "published" }))}>
              <Eye size={16} /> Yayınla
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-coral focus:bg-coral/10" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} /> Sil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Egzersizi sil"
        description={`"${exercise.name}" kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
        confirmLabel="Sil"
        destructive
        loading={isPending}
        error={error}
        onConfirm={() => run(() => deleteExercise({ id: exercise.id }), true)}
      />
    </>
  );
}
