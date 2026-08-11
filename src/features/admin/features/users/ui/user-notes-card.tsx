"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { StickyNote, Trash2, Lock } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Textarea } from "@/features/admin/components/ui/textarea";
import { formatDateTime } from "./format";
import { addNote, deleteNote } from "../actions";
import type { AdminUserNote } from "@/lib/database.types";

export function UserNotesCard({
  userId,
  notes,
}: {
  userId: string;
  notes: AdminUserNote[];
}) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function submit() {
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await addNote({ userId, note: text.trim() });
      if (!res.ok) return setError(res.error ?? "Not eklenemedi.");
      setText("");
      router.refresh();
    });
  }

  function remove(noteId: string) {
    startTransition(async () => {
      await deleteNote({ noteId, userId });
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <StickyNote size={16} className="text-brand" /> Admin Notları
        <span className="ml-auto inline-flex items-center gap-1 text-xs font-normal text-fg-muted">
          <Lock size={12} /> Yalnızca admin görür
        </span>
      </h3>

      <div className="mt-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Bu kullanıcı hakkında özel bir not ekle…"
        />
        {error && <p className="mt-2 text-sm text-coral">{error}</p>}
        <div className="mt-2 flex justify-end">
          <Button size="sm" disabled={isPending || !text.trim()} onClick={submit}>
            {isPending ? "Ekleniyor…" : "Not Ekle"}
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {notes.length === 0 ? (
          <p className="text-sm text-fg-muted">Henüz not eklenmemiş.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-ink-border bg-ink-soft/50 p-3">
              <p className="whitespace-pre-wrap text-sm">{n.note}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-fg-muted">
                <span>
                  {n.author_name ?? "Admin"} · {formatDateTime(n.created_at)}
                </span>
                <button
                  onClick={() => remove(n.id)}
                  disabled={isPending}
                  className="text-fg-muted transition-colors hover:text-coral"
                  aria-label="Notu sil"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
