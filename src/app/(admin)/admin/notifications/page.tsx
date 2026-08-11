import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { createAdminClient } from "@/lib/supabase/server";
import { NotificationCompose } from "@/features/admin/features/notifications/ui/compose";
import { Card } from "@/features/admin/components/ui/card";
import { Badge } from "@/features/admin/components/ui/badge";
import { EmptyState } from "@/features/admin/components/states/empty-state";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bildirimler · Admin" };

interface RecentGroup { title: string; type: string; total: number; read: number; created_at: string; }

export default async function AdminNotificationsPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");

  const supabase = createAdminClient();
  const { data } = await supabase.from("notifications").select("title, type, read, created_at").order("created_at", { ascending: false }).limit(2000);
  const rows = (data ?? []) as { title: string; type: string; read: boolean; created_at: string }[];

  // Başlık + dakika bazında grupla (broadcast'leri tek satır göster).
  const map = new Map<string, RecentGroup>();
  rows.forEach((r) => {
    const key = `${r.title}|${r.created_at.slice(0, 16)}`;
    const g = map.get(key) ?? { title: r.title, type: r.type, total: 0, read: 0, created_at: r.created_at };
    g.total++; if (r.read) g.read++;
    map.set(key, g);
  });
  const groups = [...map.values()].slice(0, 30);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bildirimler</h1>
        <p className="mt-1 text-sm text-fg-muted">Kullanıcılara toplu bildirim gönder ve geçmişi izle.</p>
      </div>

      <NotificationCompose />

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Son Gönderimler</h3>
        {groups.length === 0 ? (
          <EmptyState icon={Bell} title="Henüz bildirim yok" description="İlk broadcast'ini yukarıdan gönder." className="py-8" />
        ) : (
          <div className="space-y-2">
            {groups.map((g, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-ink-border px-3 py-2.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium"><Badge variant="secondary">{g.type}</Badge> {g.title}</p>
                  <p className="text-xs text-fg-muted">{new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(g.created_at))}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-fg-muted">
                  <p><span className="font-semibold text-fg">{g.total}</span> alıcı</p>
                  <p>{g.total > 0 ? Math.round((g.read / g.total) * 100) : 0}% okundu</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
