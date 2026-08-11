"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/features/admin/components/ui/input";
import { Select } from "@/features/admin/components/ui/select";
import {
  CATEGORY_LABELS,
  CATEGORY_VALUES,
  DIFFICULTY_LABELS,
  DIFFICULTY_VALUES,
  SORT_OPTIONS,
  STATUS_LABELS,
} from "../constants";

export interface ToolbarState {
  q: string;
  category: string;
  subcategory: string;
  difficulty: string;
  equipment: string;
  muscleGroup: string;
  status: string;
  sort: string;
}

export function ExercisesToolbar({
  state,
  muscleGroups,
  equipments,
  subcategories,
}: {
  state: ToolbarState;
  muscleGroups: string[];
  equipments: string[];
  subcategories: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = React.useState(state.q);

  const push = React.useCallback(
    (next: Record<string, string>) => {
      const sp = new URLSearchParams(params.toString());
      Object.entries(next).forEach(([k, v]) => (v ? sp.set(k, v) : sp.delete(k)));
      sp.delete("page");
      router.push(`${pathname}?${sp.toString()}`);
    },
    [params, pathname, router]
  );

  React.useEffect(() => {
    const id = setTimeout(() => {
      if (term !== state.q) push({ q: term });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="İsim, kas grubu, ekipman ara…"
            className="pl-9"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={state.sort} onChange={(e) => push({ sort: e.target.value })} aria-label="Sıralama">
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <Select value={state.muscleGroup} onChange={(e) => push({ muscleGroup: e.target.value })} aria-label="Kas grubu">
          <option value="">Kas grubu (tümü)</option>
          {muscleGroups.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
        <Select value={state.category} onChange={(e) => push({ category: e.target.value })} aria-label="Kategori">
          <option value="">Kategori (tümü)</option>
          {CATEGORY_VALUES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </Select>
        <Select value={state.subcategory} onChange={(e) => push({ subcategory: e.target.value })} aria-label="Alt kategori">
          <option value="">Alt kategori (tümü)</option>
          {subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={state.difficulty} onChange={(e) => push({ difficulty: e.target.value })} aria-label="Zorluk">
          <option value="">Zorluk (tümü)</option>
          {DIFFICULTY_VALUES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
        </Select>
        <Select value={state.equipment} onChange={(e) => push({ equipment: e.target.value })} aria-label="Ekipman">
          <option value="">Ekipman (tümü)</option>
          {equipments.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
        </Select>
        <Select value={state.status} onChange={(e) => push({ status: e.target.value })} aria-label="Durum">
          <option value="">Durum (tümü)</option>
          <option value="published">{STATUS_LABELS.published}</option>
          <option value="draft">{STATUS_LABELS.draft}</option>
        </Select>
      </div>
    </div>
  );
}
