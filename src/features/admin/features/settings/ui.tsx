"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save, Cpu, ToggleRight, Globe } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Select } from "@/features/admin/components/ui/select";
import { Label } from "@/features/admin/components/ui/label";
import { saveSetting } from "./actions";

type Dict = Record<string, unknown>;

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-ink-border px-3 py-2.5 text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-brand" : "bg-ink-soft ring-1 ring-inset ring-ink-border"}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

export function SettingsForm({ ai, features, site, nutritionAi }: { ai: Dict; features: Dict; site: Dict; nutritionAi: Dict }) {
  const router = useRouter();
  const [a, setA] = React.useState(ai);
  const [f, setF] = React.useState(features);
  const [s, setS] = React.useState(site);
  const [n, setN] = React.useState(nutritionAi);
  const [isPending, startTransition] = React.useTransition();
  const [saved, setSaved] = React.useState<string | null>(null);

  function save(key: "ai" | "features" | "site" | "nutrition_ai", value: Dict) {
    startTransition(async () => {
      const res = await saveSetting(key, value);
      if (res.ok) { setSaved(key); router.refresh(); setTimeout(() => setSaved(null), 2000); }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Cpu size={16} className="text-brand" /> AI Ayarları</h3>
        <div><Label>Sağlayıcı</Label><Select value={String(a.provider ?? "openai")} onChange={(e) => setA({ ...a, provider: e.target.value })}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option></Select></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Max Token</Label><Input type="number" value={Number(a.max_tokens ?? 900)} onChange={(e) => setA({ ...a, max_tokens: Number(e.target.value) })} /></div>
          <div><Label>Temperature</Label><Input type="number" step="0.1" value={Number(a.temperature ?? 0.7)} onChange={(e) => setA({ ...a, temperature: Number(e.target.value) })} /></div>
        </div>
        <p className="text-xs text-fg-muted">Not: Etkin sağlayıcı sunucuda <code>AI_PROVIDER</code> env'i ile de belirlenir.</p>
        <div className="flex items-center justify-end gap-2">{saved === "ai" && <span className="text-xs text-emerald-400">Kaydedildi</span>}<Button size="sm" disabled={isPending} onClick={() => save("ai", a)}><Save size={15} /> Kaydet</Button></div>
      </Card>

      <Card className="space-y-3 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><ToggleRight size={16} className="text-brand" /> Özellik Bayrakları</h3>
        {(["ai_coach", "posture", "nutrition", "programs"] as const).map((k) => (
          <Toggle key={k} label={{ ai_coach: "AI Coach", posture: "Postür Analizi", nutrition: "Beslenme", programs: "Programlar" }[k]} checked={Boolean(f[k])} onChange={(v) => setF({ ...f, [k]: v })} />
        ))}
        <div className="flex items-center justify-end gap-2">{saved === "features" && <span className="text-xs text-emerald-400">Kaydedildi</span>}<Button size="sm" disabled={isPending} onClick={() => save("features", f)}><Save size={15} /> Kaydet</Button></div>
      </Card>

      <Card className="space-y-3 p-5 lg:col-span-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Globe size={16} className="text-brand" /> Site Ayarları</h3>
        <Toggle label="Bakım Modu" checked={Boolean(s.maintenance)} onChange={(v) => setS({ ...s, maintenance: v })} />
        <Toggle label="Kayıt Açık" checked={Boolean(s.registration_open)} onChange={(v) => setS({ ...s, registration_open: v })} />
        <div><Label>Destek E-postası</Label><Input value={String(s.support_email ?? "")} onChange={(e) => setS({ ...s, support_email: e.target.value })} /></div>
        <div className="flex items-center justify-end gap-2">{saved === "site" && <span className="text-xs text-emerald-400">Kaydedildi</span>}<Button size="sm" disabled={isPending} onClick={() => save("site", s)}><Save size={15} /> Kaydet</Button></div>
      </Card>

      <Card className="space-y-3 p-5 lg:col-span-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Cpu size={16} className="text-brand" /> AI Diyetisyen Promptu</h3>
        <div>
          <Label>Sistem Promptu</Label>
          <textarea
            value={String(n.system_prompt ?? "")}
            onChange={(e) => setN({ ...n, system_prompt: e.target.value })}
            rows={6}
            className="mt-1 w-full rounded-xl border border-ink-border bg-ink-soft px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Max Token</Label><Input type="number" value={Number(n.max_tokens ?? 900)} onChange={(e) => setN({ ...n, max_tokens: Number(e.target.value) })} /></div>
          <div><Label>Temperature</Label><Input type="number" step="0.1" value={Number(n.temperature ?? 0.6)} onChange={(e) => setN({ ...n, temperature: Number(e.target.value) })} /></div>
        </div>
        <p className="text-xs text-fg-muted">Güvenlik kuralları (teşhis/ilaç/garanti yok, restoran modu, takviye uyarısı) prompt içinde tutulmalıdır.</p>
        <div className="flex items-center justify-end gap-2">{saved === "nutrition_ai" && <span className="text-xs text-emerald-400">Kaydedildi</span>}<Button size="sm" disabled={isPending} onClick={() => save("nutrition_ai", n)}><Save size={15} /> Kaydet</Button></div>
      </Card>
    </div>
  );
}
