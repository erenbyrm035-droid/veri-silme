"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Merge, ExternalLink } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Checkbox } from "@/features/admin/components/ui/checkbox";
import { Badge } from "@/features/admin/components/ui/badge";
import { EmptyState } from "@/features/admin/components/states/empty-state";
import { ConfirmDialog } from "@/features/admin/features/users/ui/confirm-dialog";
import { StatusBadge } from "./badges";
import { mergeDuplicates } from "../actions";
import type { DuplicateGroup } from "@/lib/database.types";

function GroupCard({ group }: { group: DuplicateGroup }) {
  const router = useRouter();
  const [keepId, setKeepId] = React.useState(group.exercises[0].id);
  const [remove, setRemove] = React.useState<Set<string>>(new Set());
  const [confirm, setConfirm] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function toggleRemove(id: string) {
    if (id === keepId) return;
    setRemove((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function doMerge() {
    setError(null);
    startTransition(async () => {
      const res = await mergeDuplicates({ keepId, removeIds: [...remove] });
      if (!res.ok) return setError(res.error ?? "Birleştirilemedi.");
      setConfirm(false);
      router.refresh();
    });
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">
          {group.exercises.length} olası tekrar <Badge variant="warning">{group.key}</Badge>
        </p>
        <Button
          size="sm"
          variant="destructive"
          disabled={remove.size === 0 || isPending}
          onClick={() => setConfirm(true)}
        >
          <Merge size={14} /> Birleştir ({remove.size})
        </Button>
      </div>
      <div className="space-y-1.5">
        {group.exercises.map((ex) => (
          <div key={ex.id} className="flex items-center gap-3 rounded-lg border border-ink-border px-3 py-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name={`keep-${group.key}`}
                checked={keepId === ex.id}
                onChange={() => { setKeepId(ex.id); setRemove((p) => { const n = new Set(p); n.delete(ex.id); return n; }); }}
                className="accent-brand"
              />
              Tut
            </label>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{ex.name}</p>
              <p className="truncate text-xs text-fg-muted">{ex.slug ?? "—"}</p>
            </div>
            <StatusBadge status={ex.status} />
            <Link href={`/admin/exercises/${ex.id}`} className="text-fg-muted hover:text-brand" target="_blank">
              <ExternalLink size={14} />
            </Link>
            <Checkbox
              checked={remove.has(ex.id)}
              disabled={ex.id === keepId}
              onCheckedChange={() => toggleRemove(ex.id)}
              aria-label="Silinecek"
            />
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-coral">{error}</p>}
      <p className="mt-2 text-xs text-fg-muted">
        &quot;Tut&quot; işaretli kayıt korunur; onay kutusu işaretli kayıtlar silinir.
      </p>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Tekrarları birleştir"
        description={`${remove.size} kayıt silinecek, seçili kayıt korunacak. Bu işlem geri alınamaz.`}
        confirmLabel="Birleştir ve sil"
        destructive
        loading={isPending}
        error={error}
        onConfirm={doMerge}
      />
    </Card>
  );
}

export function DuplicateDetector({ groups }: { groups: DuplicateGroup[] }) {
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={Copy}
        title="Tekrar bulunamadı"
        description="Sistem olası tekrar eden egzersiz tespit etmedi."
      />
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((g) => (
        <GroupCard key={g.key} group={g} />
      ))}
    </div>
  );
}
