"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Label } from "@/features/admin/components/ui/label";
import { Badge } from "@/features/admin/components/ui/badge";
import { cn } from "@/lib/utils";
import { AGENT_EMOJI } from "@/lib/ai/agents/types";
import type { AiCenterData } from "../queries";
import { startAbTest, stopAbTest, updateAbSplit } from "../actions";
import { num } from "./shared";


export function AbTab({ data }: { data: AiCenterData }) {
  const [agentKey, setAgentKey] = useState<string>(data.agents[0]?.key ?? "fitness");
  const [name, setName] = useState("");
  const [split, setSplit] = useState(50);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Yeni test başlat</CardTitle>
          <p className="text-xs text-fg-muted">
            Önce ilgili ajan için <strong>B varyantı promptu</strong> oluşturmalısın; yoksa
            herkes A görür ve test ölçüm üretmez. Kullanıcılar varyantlara kararlı biçimde
            atanır — aynı kullanıcı her mesajda aynı varyantı görür.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Ajan</Label>
              <select
                value={agentKey}
                onChange={(e) => setAgentKey(e.target.value)}
                className="h-10 w-full rounded-xl border border-ink-border bg-ink-soft px-3 text-sm"
              >
                {data.agents.map((a) => (
                  <option key={a.key} value={a.key}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Test adı</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kısa vs uzun prompt" />
            </div>
            <div>
              <Label>B varyantı payı (%)</Label>
              <Input
                type="number" min={0} max={100}
                value={split}
                onChange={(e) => setSplit(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              disabled={pending || name.trim().length < 3}
              onClick={() =>
                start(async () => {
                  const res = await startAbTest({ agent_key: agentKey, name, split_pct: split });
                  setMsg({ ok: res.ok, text: res.ok ? "Test başlatıldı." : res.error ?? "Hata" });
                  if (res.ok) setName("");
                })
              }
            >
              {pending ? "Başlatılıyor…" : "Testi başlat"}
            </Button>
            {msg && (
              <span className={cn("text-xs font-medium", msg.ok ? "text-emerald-500" : "text-red-500")}>
                {msg.text}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {data.abTests.length === 0 ? (
        <p className="text-sm text-fg-muted">Henüz test yok.</p>
      ) : (
        data.abTests.map((t) => <AbCard key={t.id} test={t} />)
      )}
    </div>
  );
}

function AbCard({ test }: { test: AiCenterData["abTests"][number] }) {
  const [split, setSplit] = useState(test.split_pct);
  const [pending, start] = useTransition();

  return (
    <Card className={cn(!test.active && "opacity-70")}>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            {test.name}
            <Badge variant={test.active ? "default" : "secondary"}>
              {test.active ? "aktif" : "bitti"}
            </Badge>
          </CardTitle>
          <p className="text-xs text-fg-muted">
            {AGENT_EMOJI[test.agent_key as keyof typeof AGENT_EMOJI]} {test.agent_key} ·
            başlangıç {new Date(test.started_at).toLocaleDateString("tr-TR")}
            {test.ended_at && ` · bitiş ${new Date(test.ended_at).toLocaleDateString("tr-TR")}`}
          </p>
        </div>
        {test.active && (
          <Button
            size="sm" variant="outline" disabled={pending}
            onClick={() => start(async () => { await stopAbTest(test.id); })}
          >
            Testi bitir
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {test.active && (
          <div className="flex items-end gap-2">
            <div className="w-32">
              <Label>B payı (%)</Label>
              <Input
                type="number" min={0} max={100}
                value={split}
                onChange={(e) => setSplit(Number(e.target.value))}
              />
            </div>
            <Button
              size="sm" variant="outline" disabled={pending || split === test.split_pct}
              onClick={() => start(async () => { await updateAbSplit(test.id, split); })}
            >
              Güncelle
            </Button>
          </div>
        )}

        {test.results.length === 0 ? (
          <p className="text-sm text-fg-muted">Henüz ölçüm yok.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-border text-left text-xs text-fg-muted">
                <th className="pb-2">Varyant</th>
                <th className="pb-2 text-right">Çalışma</th>
                <th className="pb-2 text-right">Başarı</th>
                <th className="pb-2 text-right">Ort. süre</th>
                <th className="pb-2 text-right">Ort. token</th>
              </tr>
            </thead>
            <tbody>
              {test.results.map((r) => (
                <tr key={r.variant} className="border-b border-ink-border/50">
                  <td className="py-2 font-semibold uppercase">{r.variant}</td>
                  <td className="py-2 text-right tabular-nums">{num(Number(r.runs))}</td>
                  <td className="py-2 text-right tabular-nums">%{r.success_pct ?? 100}</td>
                  <td className="py-2 text-right tabular-nums">{num(r.avg_latency_ms)} ms</td>
                  <td className="py-2 text-right tabular-nums">{num(r.avg_tokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-[11px] text-fg-muted">
          Hangi varyantın “daha iyi” olduğu bir ürün kararıdır — burada yalnızca
          ölçülebilir olan gösteriliyor. Cevap kalitesini rakam söylemez.
        </p>
      </CardContent>
    </Card>
  );
}
