"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Label } from "@/features/admin/components/ui/label";
import { Select } from "@/features/admin/components/ui/select";
import { Input } from "@/features/admin/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/features/admin/components/ui/dialog";
import { PremiumBadge } from "./badges";
import { formatDateTime } from "./format";
import { MEMBERSHIP_LABELS } from "../constants";
import { setPremium, removePremium } from "../actions";
import type { AdminUserRow, MembershipType } from "@/lib/database.types";

/** datetime-local <-> ISO dönüşümleri. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function UserPremiumCard({
  user,
  canManage,
}: {
  user: AdminUserRow;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [membership, setMembership] = React.useState<MembershipType>(
    user.membership_type === "free" ? "premium" : user.membership_type
  );
  const [until, setUntil] = React.useState<string>(toLocalInput(user.premium_until));

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setPremium({
        userId: user.id,
        membership,
        until: until ? new Date(until).toISOString() : null,
      });
      if (!res.ok) return setError(res.error ?? "İşlem başarısız.");
      setOpen(false);
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await removePremium({ userId: user.id });
      if (!res.ok) return setError(res.error ?? "İşlem başarısız.");
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Crown size={16} className="text-brand" /> Premium
        </h3>
        <PremiumBadge isPremium={user.is_premium} />
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-fg-muted">Üyelik türü</dt>
          <dd className="font-medium">{MEMBERSHIP_LABELS[user.membership_type]}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-fg-muted">Bitiş</dt>
          <dd className="font-medium">
            {user.premium_until ? formatDateTime(user.premium_until) : "Süresiz"}
          </dd>
        </div>
      </dl>

      {error && <p className="mt-3 text-sm text-coral">{error}</p>}

      {canManage ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setOpen(true)}>
            {user.is_premium ? "Süreyi Değiştir" : "Premium Yap"}
          </Button>
          {user.is_premium && (
            <Button size="sm" variant="destructive" disabled={isPending} onClick={remove}>
              Premium Kaldır
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-4 text-xs text-fg-muted">Premium işlemleri için yetkiniz yok.</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Premium Ayarla</DialogTitle>
            <DialogDescription>Üyelik türü ve bitiş tarihini belirle.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Üyelik türü</Label>
              <Select value={membership} onChange={(e) => setMembership(e.target.value as MembershipType)}>
                {(["premium", "trial", "lifetime"] as MembershipType[]).map((m) => (
                  <option key={m} value={m}>
                    {MEMBERSHIP_LABELS[m]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Bitiş tarihi (boş = süresiz)</Label>
              <Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-coral">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Vazgeç
            </Button>
            <Button onClick={save} disabled={isPending}>
              {isPending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
