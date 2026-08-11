"use client";

import * as React from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/features/admin/components/ui/input";
import { cn } from "@/lib/utils";

/** Etiket benzeri çoklu-değer girişi (string[] alanlar için). */
export function ArrayField({
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [draft, setDraft] = React.useState("");

  function add(v: string) {
    const item = v.trim();
    if (!item || value.includes(item)) return;
    onChange([...value, item]);
    setDraft("");
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  const filtered = (suggestions ?? []).filter(
    (s) => s.toLowerCase().includes(draft.toLowerCase()) && !value.includes(s)
  ).slice(0, 6);

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-lg bg-ink-soft px-2 py-1 text-xs font-medium"
            >
              {item}
              <button type="button" onClick={() => remove(i)} className="text-fg-muted hover:text-coral">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(draft); }
          }}
          placeholder={placeholder ?? "Ekle ve Enter'a bas"}
        />
        <button
          type="button"
          onClick={() => add(draft)}
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-border bg-ink-soft text-fg-muted",
            "hover:text-fg"
          )}
        >
          <Plus size={16} />
        </button>
      </div>
      {draft && filtered.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-lg border border-ink-border px-2 py-0.5 text-xs text-fg-muted hover:text-fg"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
