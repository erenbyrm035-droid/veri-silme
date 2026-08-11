import Link from "next/link";
import { ScanLine } from "lucide-react";
import { EmptyState } from "@/features/admin/components/states/empty-state";
import { Badge } from "@/features/admin/components/ui/badge";
import { RISK_TR } from "@/lib/posture/recommend";
import type { AdminPostureRow, RiskLevel } from "@/lib/database.types";

const RISK_VARIANT: Record<RiskLevel, "success" | "warning" | "danger"> = { low: "success", moderate: "warning", high: "danger" };

function fmt(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function scoreColor(s: number) { return s >= 80 ? "text-emerald-400" : s >= 55 ? "text-amber-400" : "text-coral"; }

export function PostureTable({ rows }: { rows: AdminPostureRow[] }) {
  if (rows.length === 0) return <EmptyState icon={ScanLine} title="Analiz bulunamadı" description="Filtrelerinize uyan postür analizi yok." />;
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-border bg-ink-card">
      <table className="w-full min-w-[840px] text-sm">
        <thead>
          <tr className="border-b border-ink-border text-left text-xs text-fg-muted">
            <th className="px-4 py-3 font-medium">Kullanıcı</th>
            <th className="px-2 py-3 font-medium">Score</th>
            <th className="px-2 py-3 font-medium">Risk</th>
            <th className="px-2 py-3 font-medium">Bulgular</th>
            <th className="px-2 py-3 font-medium">Ortam</th>
            <th className="px-2 py-3 font-medium">Ülke</th>
            <th className="px-4 py-3 font-medium">Tarih</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-ink-border/60 transition-colors last:border-0 hover:bg-fg/[0.02]">
              <td className="px-4 py-2.5">
                <Link href={`/admin/posture/${r.id}`} className="group block min-w-0">
                  <p className="truncate font-medium group-hover:text-brand">{r.user_name ?? "İsimsiz"}</p>
                  <p className="truncate text-xs text-fg-muted">{r.email ?? "—"}</p>
                </Link>
              </td>
              <td className={`px-2 py-2.5 font-bold ${scoreColor(r.posture_score)}`}>{r.posture_score}</td>
              <td className="px-2 py-2.5">{r.risk_level ? <Badge variant={RISK_VARIANT[r.risk_level]}>{RISK_TR[r.risk_level]}</Badge> : <Badge variant="secondary">—</Badge>}</td>
              <td className="px-2 py-2.5 text-fg-muted"><span className="line-clamp-1">{r.top_problems.join(", ") || "—"}</span></td>
              <td className="px-2 py-2.5 text-fg-muted">{r.environment === "home" ? "Ev" : r.environment === "gym" ? "Salon" : "Her ikisi"}</td>
              <td className="px-2 py-2.5 text-fg-muted">{r.country ?? "—"}</td>
              <td className="px-4 py-2.5 text-fg-muted">{fmt(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
