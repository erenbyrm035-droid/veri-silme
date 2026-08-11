import { redirect } from "next/navigation";
import { Activity, Database, Bot, HardDrive, AlertTriangle, CheckCircle2, XCircle, Server, type LucideIcon } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { getSystemHealth } from "@/features/admin/features/system/queries";
import { Card } from "@/features/admin/components/ui/card";
import { Badge } from "@/features/admin/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sistem Sağlığı · Admin" };

function Stat({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <Icon size={17} className="text-brand" />
      <span className="text-xl font-bold tracking-tight">{value}</span>
      <span className="text-xs text-fg-muted">{label}</span>
      {hint && <span className="text-[11px] text-fg-muted">{hint}</span>}
    </Card>
  );
}

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-border px-3 py-2 text-sm">
      <span>{label}</span>
      {ok ? <CheckCircle2 size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-fg-muted" />}
    </div>
  );
}

export default async function SystemPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  if (ctx.role !== "super_admin") redirect("/admin");

  const h = await getSystemHealth();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sistem Sağlığı</h1>
        <p className="mt-1 text-sm text-fg-muted">API durumu, AI kullanımı, depolama ve hata logları.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Database} label="Veritabanı" value={h.db.ok ? "Çevrimiçi" : "Hata"} hint={`${h.db.latencyMs}ms yanıt`} />
        <Stat icon={Activity} label="Kullanıcı" value={h.counts.users} />
        <Stat icon={Bot} label="AI İstek" value={h.ai.totalRequests} hint={`${h.ai.totalTokens.toLocaleString("tr-TR")} token`} />
        <Stat icon={AlertTriangle} label="Hata (24s)" value={h.counts.errors24h} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Server size={16} className="text-brand" /> Yapılandırma Durumu</h3>
          <Flag ok={h.config.aiKey} label={`AI Sağlayıcı (${h.ai.provider})`} />
          <Flag ok={h.config.billing !== "manual"} label={`Ödeme (${h.config.billing})`} />
          <Flag ok={h.config.fcm} label="Push (FCM)" />
          <Flag ok={h.config.sentry} label="Hata İzleme (Sentry)" />
          <p className="text-xs text-fg-muted">Site: {h.config.siteUrl}</p>
        </Card>

        <Card className="space-y-3 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><HardDrive size={16} className="text-brand" /> Depolama</h3>
          {h.storage.map((b) => (
            <div key={b.bucket} className="flex items-center justify-between rounded-xl border border-ink-border px-3 py-2 text-sm">
              <span className="text-fg-muted">{b.bucket}</span>
              <Badge variant={b.objects < 0 ? "danger" : "secondary"}>{b.objects < 0 ? "erişilemedi" : `${b.objects} nesne`}</Badge>
            </div>
          ))}
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-ink-border p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={16} className="text-coral" /> Son Hatalar</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-border text-left text-xs text-fg-muted">
                <th className="px-4 py-2.5 font-medium">Seviye</th>
                <th className="px-4 py-2.5 font-medium">Konum</th>
                <th className="px-4 py-2.5 font-medium">Mesaj</th>
                <th className="px-4 py-2.5 font-medium">Zaman</th>
              </tr>
            </thead>
            <tbody>
              {h.recentErrors.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-fg-muted">Kayıtlı hata yok 🎉</td></tr>}
              {h.recentErrors.map((e) => (
                <tr key={e.id} className="border-b border-ink-border/60 last:border-0">
                  <td className="px-4 py-2.5"><Badge variant={e.severity === "fatal" || e.severity === "error" ? "danger" : e.severity === "warning" ? "warning" : "secondary"}>{e.severity}</Badge></td>
                  <td className="px-4 py-2.5 text-fg-muted">{e.where_at ?? "—"}</td>
                  <td className="max-w-md truncate px-4 py-2.5">{e.message}</td>
                  <td className="px-4 py-2.5 text-fg-muted">{new Date(e.created_at).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
