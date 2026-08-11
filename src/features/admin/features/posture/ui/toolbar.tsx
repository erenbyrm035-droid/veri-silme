"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/features/admin/components/ui/input";
import { Select } from "@/features/admin/components/ui/select";

export function PostureToolbar({ q, risk }: { q: string; risk: string }) {
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
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Kullanıcı adı veya e-posta ara…" className="pl-9" />
      </div>
      <div className="w-full sm:w-48">
        <Select value={risk} onChange={(e) => push({ risk: e.target.value })} aria-label="Risk">
          <option value="">Risk (tümü)</option>
          <option value="low">Düşük</option>
          <option value="moderate">Dikkat</option>
          <option value="high">Yüksek Risk</option>
        </Select>
      </div>
    </div>
  );
}
