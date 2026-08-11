"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

/** URL tabanlı, herhangi bir liste için yeniden kullanılabilir sayfalama. */
export function DataPagination({
  page,
  pageCount,
  total,
  pageSize,
  noun = "kayıt",
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  noun?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(p: number) {
    const sp = new URLSearchParams(params.toString());
    sp.set("page", String(p));
    router.push(`${pathname}?${sp.toString()}`);
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <p className="text-xs text-fg-muted">
        <span className="font-semibold text-fg">{from}–{to}</span> / {total} {noun}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go(page - 1)}>
          <ChevronLeft size={16} /> Önceki
        </Button>
        <span className="text-xs text-fg-muted">Sayfa {page} / {pageCount}</span>
        <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => go(page + 1)}>
          Sonraki <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
