"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Muscle } from "@/lib/database.types";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { Search, ChevronRight } from "lucide-react";

/** Aranabilir + bölgeye göre filtrelenebilir tam kas listesi. */
export function AnatomyExplorer({ muscles }: { muscles: Muscle[] }) {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<"all" | "front" | "back">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return muscles.filter((m) => {
      if (region !== "all" && m.region !== region) return false;
      if (!needle) return true;
      return (
        m.name_tr.toLocaleLowerCase("tr").includes(needle) ||
        (m.latin_name ?? "").toLowerCase().includes(needle) ||
        m.muscle_group.toLocaleLowerCase("tr").includes(needle)
      );
    });
  }, [muscles, q, region]);

  const byGroup = useMemo(() => {
    return filtered.reduce<Record<string, Muscle[]>>((acc, m) => {
      (acc[m.muscle_group] ||= []).push(m);
      return acc;
    }, {});
  }, [filtered]);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
          Tüm Kaslar <span className="text-fg-muted/70">· {muscles.length}</span>
        </h2>
        <Segmented
          options={[
            { value: "all", label: "Hepsi" },
            { value: "front", label: "Ön" },
            { value: "back", label: "Arka" },
          ]}
          value={region}
          onChange={(v) => setRegion(v as "all" | "front" | "back")}
        />
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Kas ara… (ör. deltoid, hamstring, karın)"
          className="input pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-ink-border bg-ink-card py-8 text-center text-sm text-fg-muted">
          Eşleşen kas bulunamadı.
        </p>
      ) : (
        <div className="space-y-4">
          {Object.entries(byGroup).map(([group, list]) => (
            <div key={group}>
              <p className="label flex items-center justify-between">
                <span>{group}</span>
                <span className="text-fg-muted/70">{list.length}</span>
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {list.map((m) => (
                  <Link key={m.id} href={`/anatomy/${m.slug}`}>
                    <Card className="card-hover flex items-center justify-between py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.name_tr}</p>
                        <p className="truncate text-xs text-fg-muted">{m.latin_name}</p>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-fg-muted" />
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
