"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/features/admin/components/ui/input";
import { Select } from "@/features/admin/components/ui/select";
import {
  USER_FILTERS,
  USER_SORTS,
  type UserFilter,
  type UserSort,
} from "../constants";

export function UsersToolbar({
  q,
  filter,
  sort,
}: {
  q: string;
  filter: UserFilter;
  sort: UserSort;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = React.useState(q);

  const push = React.useCallback(
    (next: Record<string, string>) => {
      const sp = new URLSearchParams(params.toString());
      Object.entries(next).forEach(([k, v]) => {
        if (v) sp.set(k, v);
        else sp.delete(k);
      });
      sp.delete("page"); // filtre/sıra/arama değişince ilk sayfaya dön
      router.push(`${pathname}?${sp.toString()}`);
    },
    [params, pathname, router]
  );

  // Arama için debounce (300ms).
  React.useEffect(() => {
    const id = setTimeout(() => {
      if (term !== q) push({ q: term });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="İsim veya e-posta ara…"
          className="pl-9"
        />
      </div>
      <div className="flex gap-3">
        <div className="w-40">
          <Select
            value={filter}
            onChange={(e) => push({ filter: e.target.value })}
            aria-label="Filtre"
          >
            {USER_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <Select
            value={sort}
            onChange={(e) => push({ sort: e.target.value })}
            aria-label="Sıralama"
          >
            {USER_SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
