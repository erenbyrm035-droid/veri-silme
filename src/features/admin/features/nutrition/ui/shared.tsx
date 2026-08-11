"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/features/admin/components/ui/badge";
import { Input } from "@/features/admin/components/ui/input";
import { Select } from "@/features/admin/components/ui/select";
import { cn } from "@/lib/utils";
import { SORT_OPTIONS } from "../constants";
import type { ContentStatus } from "@/lib/database.types";

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  return status === "published" ? <Badge variant="success">Yayında</Badge> : <Badge variant="outline">Taslak</Badge>;
}
export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? <Badge variant="success">Doğrulanmış</Badge> : <Badge variant="secondary">Taslak</Badge>;
}

/** Görsel/ikon önizleme (tembel yükleme). */
export function ImageThumb({ url, size = 40, className }: { url: string | null; size?: number; className?: string }) {
  const [error, setError] = React.useState(false);
  if (!url || error) {
    return <div className={cn("grid shrink-0 place-items-center rounded-lg bg-ink-soft text-fg-muted", className)} style={{ width: size, height: size }}><UtensilsCrossed size={size * 0.42} /></div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" onError={() => setError(true)} width={size} height={size} className={cn("shrink-0 rounded-lg border border-ink-border object-cover", className)} style={{ width: size, height: size }} />;
}

/** Genel arama + filtre + sıralama araç çubuğu (URL tabanlı). */
export function ListToolbar({
  q, sort, placeholder, filters,
}: {
  q: string;
  sort: string;
  placeholder: string;
  filters?: { key: string; value: string; label: string; options: { value: string; label: string }[] }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = React.useState(q);

  const push = React.useCallback((next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => (v ? sp.set(k, v) : sp.delete(k)));
    sp.delete("page");
    router.push(`${pathname}?${sp.toString()}`);
  }, [params, pathname, router]);

  React.useEffect(() => {
    const id = setTimeout(() => { if (term !== q) push({ q: term }); }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={placeholder} className="pl-9" />
        </div>
        <div className="w-full sm:w-48">
          <Select value={sort} onChange={(e) => push({ sort: e.target.value })} aria-label="Sıralama">
            {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>
      </div>
      {filters && filters.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {filters.map((f) => (
            <Select key={f.key} value={f.value} onChange={(e) => push({ [f.key]: e.target.value })} aria-label={f.label}>
              <option value="">{f.label}</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          ))}
        </div>
      )}
    </div>
  );
}
