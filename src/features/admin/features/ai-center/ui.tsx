"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/features/admin/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/features/admin/components/ui/tabs";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Textarea } from "@/features/admin/components/ui/textarea";
import { Label } from "@/features/admin/components/ui/label";
import { Badge } from "@/features/admin/components/ui/badge";
import { cn } from "@/lib/utils";
import { AGENT_EMOJI, ALL_MEMORY_LAYERS, MEMORY_LAYER_LABELS, type MemoryLayer } from "@/lib/ai/agents/types";
import { formatUsd, tryFormatTry } from "@/lib/ai/pricing";
import type { AiCenterData, AgentRowView, PromptVersionRow } from "./queries";
import {
  saveAgentConfig, toggleAgent, savePrompt, activatePrompt,
  startAbTest, stopAbTest, updateAbSplit,
} from "./actions";

// ============================================================================
// AI Yönetim Merkezi — arayüz.
//
// Beş sekme: Ajanlar / Promptlar / Metrikler / A-B Testleri / Çalışma Kaydı
//
// TASARIM NOTU: "Varsayılan" rozeti önemli. DB'de kaydı olmayan bir ajan
// bozuk değil, kod varsayılanıyla çalışıyor demek. Bunu göstermezsek yönetici
// ajanın çalışmadığını sanıp gereksiz müdahale eder.
// ============================================================================

const num = (v: number) => v.toLocaleString("tr-TR");

export function AiCenterAdmin({ data }: { data: AiCenterData }) {
  return (
    <Tabs defaultValue="agents" className="space-y-5">
      <TabsList>
        <TabsTrigger value="agents">Ajanlar</TabsTrigger>
        <TabsTrigger value="prompts">Promptlar</TabsTrigger>
        <TabsTrigger value="metrics">Metrikler</TabsTrigger>
        <TabsTrigger value="ab">A/B Testleri</TabsTrigger>
      </TabsList>

      <TabsContent value="agents">
        <AgentsTab data={data} />
      </TabsContent>
      <TabsContent value="prompts">
        <PromptsTab data={data} />
      </TabsContent>
      <TabsContent value="metrics">
        <MetricsTab data={data} />
      </TabsContent>
      <TabsContent value="ab">
        <AbTab data={data} />
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// AJANLAR
// ---------------------------------------------------------------------------

function AgentsTab({ data }: { data: AiCenterData }) {
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

function PromptsTab({ data }: { data: AiCenterData }) {
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

function MetricsTab({ data }: { data: AiCenterData }) {
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

function AbTab({ data }: { data: AiCenterData }) {
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
