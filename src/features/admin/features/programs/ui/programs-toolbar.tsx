"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/features/admin/components/ui/input";
import { Select } from "@/features/admin/components/ui/select";
import {
  LEVEL_LABELS, LEVEL_VALUES, GENDER_LABELS, GENDER_VALUES,
  ENV_LABELS, ENV_VALUES, SORT_OPTIONS,
} from "../constants";

export interface ProgToolbarState {
  q: string; category: string; level: string; gender: string; environment: string; status: string; sort: string;
}

export function ProgramsToolbar({ state, categories }: { state: ProgToolbarState; categories: { slug: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = React.useState(state.q);

  const push = React.useCallback((next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => (v ? sp.set(k, v) : sp.delete(k)));
    sp.delete("page");
    router.push(`${pathname}?${sp.toString()}`);
  }, [params, pathname, router]);

  React.useEffect(() => {
    const id = setTimeout(() => { if (term !== state.q) push({ q: term }); }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Program adı, hedef, kategori ara…" className="pl-9" />
        </div>
        <div className="w-full sm:w-48">
          <Select value={state.sort} onChange={(e) => push({ sort: e.target.value })} aria-label="Sıralama">
            {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
        <Select value={state.category} onChange={(e) => push({ category: e.target.value })} aria-label="Kategori">
          <option value="">Kategori (tümü)</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </Select>
        <Select value={state.level} onChange={(e) => push({ level: e.target.value })} aria-label="Seviye">
          <option value="">Seviye (tümü)</option>
          {LEVEL_VALUES.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
        </Select>
        <Select value={state.gender} onChange={(e) => push({ gender: e.target.value })} aria-label="Cinsiyet">
          <option value="">Cinsiyet (tümü)</option>
          {GENDER_VALUES.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
        </Select>
        <Select value={state.environment} onChange={(e) => push({ environment: e.target.value })} aria-label="Ortam">
          <option value="">Ortam (tümü)</option>
          {ENV_VALUES.map((e) => <option key={e} value={e}>{ENV_LABELS[e]}</option>)}
        </Select>
        <Select value={state.status} onChange={(e) => push({ status: e.target.value })} aria-label="Durum">
          <option value="">Durum (tümü)</option>
          <option value="published">Yayında</option>
          <option value="draft">Taslak</option>
        </Select>
      </div>
    </div>
  );
}
