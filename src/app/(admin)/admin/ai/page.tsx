import { redirect } from "next/navigation";
import { Cpu, Coins, MessageSquare, Server } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { listPromptVersions, getUsageStats, listLogs } from "@/features/admin/features/ai/queries";
import { PromptManager } from "@/features/admin/features/ai/ui/prompt-manager";
import { Card } from "@/features/admin/components/ui/card";
import { Badge } from "@/features/admin/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/features/admin/components/ui/tabs";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI Yönetimi · Admin" };

const LEVEL_VARIANT = { info: "secondary", warn: "warning", error: "danger" } as const;

export default async function AdminAiPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");

  const [versions, usage, logs] = await Promise.all([listPromptVersions(), getUsageStats(), listLogs(undefined, 80)]);
  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();
  const maxDaily = Math.max(1, ...usage.daily.map((d) => d.tokens));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Yönetimi</h1>
        <p className="mt-1 text-sm text-fg-muted">Sistem promptu, model, token kullanımı ve loglar.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Toplam Token", value: usage.totalTokens, icon: Coins },
          { label: "Sohbet", value: usage.conversations, icon: MessageSquare },
          { label: "Mesaj", value: usage.messages, icon: MessageSquare },
          { label: "Aktif Sağlayıcı", value: provider, icon: Server, text: true },
        ].map((c) => (
          <Card key={c.label} className="p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-soft text-brand"><c.icon size={18} /></span>
            <p className="mt-3 text-2xl font-bold tracking-tight">{c.text ? String(c.value) : formatNumber(c.value as number)}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{c.label}</p>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="prompt">
        <TabsList>
          <TabsTrigger value="prompt">Prompt Yönetimi</TabsTrigger>
          <TabsTrigger value="usage">Token Kullanımı</TabsTrigger>
          <TabsTrigger value="logs">Loglar</TabsTrigger>
        </TabsList>

        <TabsContent value="prompt">
          <PromptManager versions={versions} />
        </TabsContent>

        <TabsContent value="usage">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Cpu size={16} className="text-brand" /> Model Kullanımı</h3>
              <div className="mt-3 space-y-2">
                {usage.byModel.length === 0 ? <p className="text-sm text-fg-muted">Veri yok.</p> : usage.byModel.map((m) => (
                  <div key={m.model} className="flex justify-between text-sm"><span>{m.model}</span><span className="text-fg-muted">{formatNumber(m.tokens)} token · {m.calls} çağrı</span></div>
                ))}
              </div>
              <p className="mt-4 text-xs text-fg-muted">Prompt: {formatNumber(usage.totalPrompt)} · Tamamlama: {formatNumber(usage.totalCompletion)} token</p>
              <p className="mt-1 text-xs text-fg-muted">Model, sunucu ortam değişkeni <code>AI_PROVIDER</code> ile seçilir (openai | anthropic).</p>
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold">Günlük Token (son 14 gün)</h3>
              <div className="mt-4 flex h-40 items-end gap-1">
                {usage.daily.length === 0 ? <p className="text-sm text-fg-muted">Veri yok.</p> : usage.daily.map((d) => (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.tokens}`}>
                    <div className="w-full rounded-t bg-brand/70" style={{ height: `${(d.tokens / maxDaily) * 100}%` }} />
                    <span className="text-[9px] text-fg-muted">{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[600px] text-sm">
              <thead><tr className="border-b border-ink-border text-left text-xs text-fg-muted">
                <th className="px-4 py-3 font-medium">Seviye</th><th className="px-2 py-3 font-medium">Olay</th>
                <th className="px-2 py-3 font-medium">Detay</th><th className="px-4 py-3 font-medium">Tarih</th>
              </tr></thead>
              <tbody>
                {logs.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-fg-muted">Log yok.</td></tr>}
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-ink-border/60 last:border-0">
                    <td className="px-4 py-2.5"><Badge variant={LEVEL_VARIANT[l.level]}>{l.level}</Badge></td>
                    <td className="px-2 py-2.5">{l.event}</td>
                    <td className="px-2 py-2.5 text-xs text-fg-muted"><span className="line-clamp-1">{JSON.stringify(l.detail)}</span></td>
                    <td className="px-4 py-2.5 text-fg-muted">{new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(l.created_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
