"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/features/admin/components/ui/card";
import { cn } from "@/lib/utils";
import { AGENT_EMOJI } from "@/lib/ai/agents/types";
import { formatUsd, tryFormatTry } from "@/lib/ai/pricing";
import type { AiCenterData } from "../queries";
import { num } from "./shared";

export function MetricsTab({ data }: { data: AiCenterData }) {
  const t = data.totals;
  const tryStr = tryFormatTry(t.cost);

  // Günlük toplam (ajanlar birleştirilmiş) — basit çubuk grafik.
  const byDay = new Map<string, number>();
  for (const d of data.daily) byDay.set(d.day, (byDay.get(d.day) ?? 0) + d.total_tokens);
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const maxDay = Math.max(1, ...days.map(([, v]) => v));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={`Çalışma (${data.days} gün)`} value={num(t.runs)} />
        <Stat label="Toplam token" value={num(t.tokens)} />
        <Stat
          label="Tahmini maliyet"
          value={formatUsd(t.cost)}
          hint={tryStr ? `≈ ${tryStr}` : "USD_TRY_RATE ayarlanmamış"}
        />
        <Stat
          label="Başarı / ort. süre"
          value={`%${t.successPct}`}
          hint={`${num(t.avgLatency)} ms`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Günlük token kullanımı</CardTitle>
        </CardHeader>
        <CardContent>
          {days.length === 0 ? (
            <p className="text-sm text-fg-muted">Henüz çalışma kaydı yok.</p>
          ) : (
            <div className="flex h-32 items-end gap-1">
              {days.map(([day, v]) => (
                <div key={day} className="group flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-brand/70 transition-colors group-hover:bg-brand"
                    style={{ height: `${Math.max(2, (v / maxDay) * 100)}%` }}
                    title={`${day}: ${num(v)} token`}
                  />
                  <span className="text-[9px] text-fg-muted">{day.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajan bazında</CardTitle>
          <p className="text-xs text-fg-muted">
            Maliyet tahminidir (lib/ai/pricing.ts). Gerçek fatura sağlayıcı panelindedir;
            buradaki rakam ajanlar arası karşılaştırma içindir.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {data.metrics.length === 0 ? (
            <p className="text-sm text-fg-muted">Henüz veri yok. Koçla birkaç mesaj at, buraya düşecek.</p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-ink-border text-left text-xs text-fg-muted">
                  <th className="pb-2">Ajan</th>
                  <th className="pb-2 text-right">Çalışma</th>
                  <th className="pb-2 text-right">Başarı</th>
                  <th className="pb-2 text-right">Ort. süre</th>
                  <th className="pb-2 text-right">p95</th>
                  <th className="pb-2 text-right">Token</th>
                  <th className="pb-2 text-right">Maliyet</th>
                </tr>
              </thead>
              <tbody>
                {data.metrics.map((m) => (
                  <tr key={m.agent_key} className="border-b border-ink-border/50">
                    <td className="py-2">
                      {AGENT_EMOJI[m.agent_key as keyof typeof AGENT_EMOJI] ?? "🤖"} {m.agent_key}
                    </td>
                    <td className="py-2 text-right tabular-nums">{num(m.runs)}</td>
                    <td className={cn(
                      "py-2 text-right tabular-nums font-medium",
                      (m.success_pct ?? 100) < 90 ? "text-red-500" : "text-emerald-500"
                    )}>
                      %{m.success_pct ?? 100}
                    </td>
                    <td className="py-2 text-right tabular-nums">{num(m.avg_latency_ms)} ms</td>
                    <td className="py-2 text-right tabular-nums text-fg-muted">{num(m.p95_latency_ms)} ms</td>
                    <td className="py-2 text-right tabular-nums">{num(m.total_tokens)}</td>
                    <td className="py-2 text-right tabular-nums">{formatUsd(m.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-fg-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-fg-muted">{hint}</p>}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// A/B TESTLERİ
// ---------------------------------------------------------------------------
