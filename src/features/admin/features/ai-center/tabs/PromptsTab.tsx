"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Textarea } from "@/features/admin/components/ui/textarea";
import { Label } from "@/features/admin/components/ui/label";
import { Badge } from "@/features/admin/components/ui/badge";
import { cn } from "@/lib/utils";
import { AGENT_EMOJI } from "@/lib/ai/agents/types";
import type { AiCenterData, PromptVersionRow } from "../queries";
import { savePrompt, activatePrompt } from "../actions";

export function PromptsTab({ data }: { data: AiCenterData }) {
  const [agentKey, setAgentKey] = useState<string>(data.agents[0]?.key ?? "fitness");
  const [variant, setVariant] = useState<"a" | "b">("a");
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const versions = data.prompts.filter((p) => p.agent_key === agentKey);
  const active = versions.find((p) => p.is_active && p.variant === variant);

  function save() {
    start(async () => {
      const res = await savePrompt({ agent_key: agentKey, variant, content, note: note || undefined });
      setMsg({
        ok: res.ok,
        text: res.ok ? `Sürüm ${res.data?.version} kaydedildi ve aktifleştirildi.` : res.error ?? "Hata",
      });
      if (res.ok) { setContent(""); setNote(""); }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Yeni prompt sürümü</CardTitle>
          <p className="text-xs text-fg-muted">
            Eski sürümler silinmez, pasifleşir. Tek tıkla geri dönebilirsin —
            bir prompt “iyileştirmesi” kaliteyi düşürebilir ve bu genelde günler sonra fark edilir.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Ajan</Label>
              <select
                value={agentKey}
                onChange={(e) => setAgentKey(e.target.value)}
                className="h-10 w-full rounded-xl border border-ink-border bg-ink-soft px-3 text-sm"
              >
                {data.agents.map((a) => (
                  <option key={a.key} value={a.key}>{AGENT_EMOJI[a.key]} {a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Varyant</Label>
              <select
                value={variant}
                onChange={(e) => setVariant(e.target.value as "a" | "b")}
                className="h-10 w-full rounded-xl border border-ink-border bg-ink-soft px-3 text-sm"
              >
                <option value="a">A (kontrol)</option>
                <option value="b">B (test)</option>
              </select>
            </div>
          </div>

          {active && (
            <details className="rounded-xl border border-ink-border bg-ink-soft p-3">
              <summary className="cursor-pointer text-xs font-semibold text-fg-muted">
                Şu an aktif olan (v{active.version}) — görmek için tıkla
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-fg-muted">
                {active.content}
              </pre>
              <Button
                size="sm" variant="outline" className="mt-2"
                onClick={() => setContent(active.content)}
              >
                Düzenlemek için kopyala
              </Button>
            </details>
          )}

          <div>
            <Label>Prompt içeriği</Label>
            <Textarea
              rows={14}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Ajanın sistem promptu…"
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label>Not (neden değiştirdin)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. çok uzun cevap veriyordu" />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={pending || content.trim().length < 30}>
              {pending ? "Kaydediliyor…" : "Sürüm oluştur ve aktifleştir"}
            </Button>
            {msg && (
              <span className={cn("text-xs font-medium", msg.ok ? "text-emerald-500" : "text-red-500")}>
                {msg.text}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Sürüm geçmişi</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {versions.length === 0 && (
            <p className="text-sm text-fg-muted">
              Bu ajanın kayıtlı prompt sürümü yok — koddaki varsayılan prompt kullanılıyor.
            </p>
          )}
          {versions.map((v) => <VersionRow key={v.id} v={v} />)}
        </CardContent>
      </Card>
    </div>
  );
}

function VersionRow({ v }: { v: PromptVersionRow }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink-border p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={v.is_active ? "default" : "secondary"}>v{v.version}</Badge>
          <Badge variant="outline">varyant {v.variant.toUpperCase()}</Badge>
          {v.is_active && <span className="text-xs font-semibold text-emerald-500">aktif</span>}
          <span className="text-xs text-fg-muted">
            {new Date(v.created_at).toLocaleString("tr-TR")}
          </span>
        </div>
        {v.note && <p className="mt-1 text-xs text-fg-muted">{v.note}</p>}
        <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{v.content.slice(0, 200)}…</p>
      </div>
      {!v.is_active && (
        <Button
          size="sm" variant="outline" disabled={pending}
          onClick={() => start(async () => { await activatePrompt(v.id); })}
        >
          Bu sürüme dön
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// METRİKLER
// ---------------------------------------------------------------------------
