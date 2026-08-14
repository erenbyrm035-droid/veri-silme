"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Label } from "@/features/admin/components/ui/label";
import { Badge } from "@/features/admin/components/ui/badge";
import { cn } from "@/lib/utils";
import { AGENT_EMOJI, ALL_MEMORY_LAYERS, MEMORY_LAYER_LABELS, type MemoryLayer } from "@/lib/ai/agents/types";
import type { AiCenterData, AgentRowView } from "../queries";
import { saveAgentConfig, toggleAgent } from "../actions";

export function AgentsTab({ data }: { data: AiCenterData }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-sm text-fg-muted">
        Her ajan bağımsız çalışır. Kapatılan ajan yönlendirmeye hiç girmez.
        “Varsayılan” rozetli ajanların veritabanında kaydı yok — koddaki
        güvenli ayarlarla çalışıyorlar, ilk kaydetmede satır oluşur.
      </p>

      {data.agents.map((a) => (
        <AgentCard
          key={a.key}
          agent={a}
          tools={data.availableTools}
          open={openKey === a.key}
          onToggleOpen={() => setOpenKey(openKey === a.key ? null : a.key)}
        />
      ))}
    </div>
  );
}

function AgentCard({
  agent, tools, open, onToggleOpen,
}: {
  agent: AgentRowView;
  tools: string[];
  open: boolean;
  onToggleOpen: () => void;
}) {
  const [form, setForm] = useState({
    name: agent.name,
    description: agent.description ?? "",
    model: agent.model ?? "",
    temperature: agent.temperature,
    max_tokens: agent.max_tokens,
    memory_limit: agent.memory_limit,
    sort_order: agent.sort_order,
    memory_layers: agent.memory_layers,
    allowed_tools: agent.allowed_tools,
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await saveAgentConfig(agent.key, {
        ...form,
        enabled: agent.enabled,
        description: form.description || undefined,
        model: form.model || undefined,
      });
      setMsg({ ok: res.ok, text: res.ok ? "Kaydedildi." : res.error ?? "Hata" });
    });
  }

  function flip() {
    start(async () => {
      const res = await toggleAgent(agent.key, !agent.enabled);
      if (!res.ok) setMsg({ ok: false, text: res.error ?? "Hata" });
    });
  }

  const toggle = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  return (
    <Card className={cn(!agent.enabled && "opacity-60")}>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <button onClick={onToggleOpen} className="flex flex-1 items-center gap-3 text-left">
          <span className="text-2xl">{AGENT_EMOJI[agent.key] ?? "🤖"}</span>
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              {agent.name}
              {!agent.persisted && <Badge variant="secondary">Varsayılan</Badge>}
              {agent.activePromptVersion && (
                <Badge variant="outline">prompt v{agent.activePromptVersion}</Badge>
              )}
              {agent.activeVariants.includes("b") && <Badge>A/B</Badge>}
            </CardTitle>
            <p className="truncate text-xs text-fg-muted">{agent.description}</p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-fg-muted">
            {agent.temperature} · {agent.max_tokens} tk
          </span>
          <Button
            size="sm"
            variant={agent.enabled ? "default" : "outline"}
            onClick={flip}
            disabled={pending}
          >
            {agent.enabled ? "Açık" : "Kapalı"}
          </Button>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4 border-t border-ink-border pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Ad</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Model (boş = varsayılan sağlayıcı)</Label>
              <Input
                value={form.model}
                placeholder="gpt-4o-mini"
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Açıklama</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Temperature (0–2)</Label>
              <Input
                type="number" step="0.05" min={0} max={2}
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Max token (50–4000)</Label>
              <Input
                type="number" min={50} max={4000}
                value={form.max_tokens}
                onChange={(e) => setForm({ ...form, max_tokens: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Hafıza limiti (karakter)</Label>
              <Input
                type="number" min={200} max={40000} step={100}
                value={form.memory_limit}
                onChange={(e) => setForm({ ...form, memory_limit: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Sıra</Label>
              <Input
                type="number" min={0} max={999}
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Hafıza katmanları</Label>
            <p className="mb-2 text-xs text-fg-muted">
              Ajan yalnızca seçili katmanları görür. Az katman = daha ucuz ve daha odaklı cevap.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_MEMORY_LAYERS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setForm({ ...form, memory_layers: toggle(form.memory_layers, l as MemoryLayer) })}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                    form.memory_layers.includes(l as MemoryLayer)
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-ink-border text-fg-muted hover:text-fg"
                  )}
                >
                  {MEMORY_LAYER_LABELS[l]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Araç izinleri</Label>
            <p className="mb-2 text-xs text-fg-muted">
              Ajan yalnızca seçili araçları çağırabilir. Bu bir güvenlik sınırıdır —
              beslenme uzmanının program yoğunluğunu değiştirememesi buradan gelir.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tools.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, allowed_tools: toggle(form.allowed_tools, t) })}
                  className={cn(
                    "rounded-lg border px-2 py-1 font-mono text-[11px] transition-colors",
                    form.allowed_tools.includes(t)
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-ink-border text-fg-muted hover:text-fg"
                  )}
                >
                  {t}
                </button>
              ))}
              {tools.length === 0 && <span className="text-xs text-fg-muted">Araç yok.</span>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={pending}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
            {msg && (
              <span className={cn("text-xs font-medium", msg.ok ? "text-emerald-500" : "text-red-500")}>
                {msg.text}
              </span>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// PROMPTLAR
// ---------------------------------------------------------------------------
