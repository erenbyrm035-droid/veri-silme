"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Textarea } from "@/features/admin/components/ui/textarea";
import { Select } from "@/features/admin/components/ui/select";
import { Label } from "@/features/admin/components/ui/label";
import { broadcastNotification } from "../actions";

export function NotificationCompose() {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ title: "", body: "", href: "", type: "info", segment: "all" });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function submit() {
    setError(null); setMsg(null);
    startTransition(async () => {
      const res = await broadcastNotification(form as never);
      if (!res.ok) return setError(res.error ?? "Gönderilemedi.");
      setMsg(`${res.sent ?? 0} kullanıcıya bildirim gönderildi.`);
      setForm({ title: "", body: "", href: "", type: "info", segment: form.segment });
      router.refresh();
    });
  }

  return (
    <Card className="space-y-3 p-5">
      <h3 className="text-sm font-semibold">Bildirim Gönder (Broadcast)</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label>Başlık *</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Yeni özellik: AI Coach!" /></div>
        <div className="sm:col-span-2"><Label>Mesaj</Label><Textarea value={form.body} onChange={(e) => set("body", e.target.value)} /></div>
        <div><Label>Bağlantı (opsiyonel)</Label><Input value={form.href} onChange={(e) => set("href", e.target.value)} placeholder="/coach" /></div>
        <div><Label>Tür</Label><Select value={form.type} onChange={(e) => set("type", e.target.value)}>
          <option value="info">Bilgi</option><option value="workout">Antrenman</option><option value="nutrition">Beslenme</option><option value="achievement">Başarı</option><option value="coach">Koç</option>
        </Select></div>
        <div><Label>Hedef Segment</Label><Select value={form.segment} onChange={(e) => set("segment", e.target.value)}>
          <option value="all">Tüm Kullanıcılar</option><option value="premium">Premium</option><option value="free">Ücretsiz</option><option value="admins">Adminler</option>
        </Select></div>
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
      <div className="flex justify-end">
        <Button size="sm" disabled={isPending || !form.title.trim()} onClick={submit}>
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Gönder
        </Button>
      </div>
    </Card>
  );
}
