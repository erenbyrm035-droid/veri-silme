"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserCog } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Label } from "@/features/admin/components/ui/label";
import { updateUserProfile, updateUserAvatar } from "../actions";
import type { AdminUserRow } from "@/lib/database.types";

export function UserProfileCard({ user }: { user: AdminUserRow }) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState(user.full_name ?? "");
  const [phone, setPhone] = React.useState(user.phone ?? "");
  const [avatarUrl, setAvatarUrl] = React.useState(user.avatar_url ?? "");
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  function save() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const p = await updateUserProfile({
        userId: user.id,
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
      });
      if (!p.ok) return setError(p.error ?? "Kaydedilemedi.");

      // Avatar değiştiyse ayrıca güncelle.
      if ((avatarUrl.trim() || null) !== (user.avatar_url ?? null)) {
        const a = await updateUserAvatar({
          userId: user.id,
          avatarUrl: avatarUrl.trim() || null,
        });
        if (!a.ok) return setError(a.error ?? "Görsel güncellenemedi.");
      }
      setNotice("Profil güncellendi.");
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <UserCog size={16} className="text-brand" /> Profili Düzenle
      </h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Ad Soyad</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ad Soyad" />
        </div>
        <div>
          <Label>Telefon</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 5xx xxx xx xx" />
        </div>
        <div className="sm:col-span-2">
          <Label>Profil Fotoğrafı (URL)</Label>
          <Input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…/avatar.png"
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-coral">{error}</p>}
      {notice && <p className="mt-3 text-sm text-emerald-400">{notice}</p>}

      <div className="mt-4 flex justify-end">
        <Button size="sm" disabled={isPending} onClick={save}>
          {isPending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </Card>
  );
}
