"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MoreHorizontal,
  Eye,
  Crown,
  CircleSlash,
  Ban,
  ShieldCheck,
  KeyRound,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/features/admin/components/ui/dropdown-menu";
import { Button } from "@/features/admin/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";
import { canActOnTarget } from "../permissions";
import type { AdminRole, AdminUserRow } from "@/lib/database.types";
import {
  setPremium,
  removePremium,
  banUser,
  unbanUser,
  deleteUser,
  sendPasswordReset,
  type ActionResult,
} from "../actions";

type Pending = null | "ban" | "delete";

export function UserRowActions({
  user,
  actorRole,
  actorId,
}: {
  user: AdminUserRow;
  actorRole: AdminRole | null;
  actorId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [dialog, setDialog] = React.useState<Pending>(null);
  const [error, setError] = React.useState<string | null>(null);

  const target = { id: user.id, admin_role: user.admin_role };
  const mayPremium = canActOnTarget(actorRole, actorId, target, "premium");
  const mayBan = canActOnTarget(actorRole, actorId, target, "ban");
  const mayDelete = canActOnTarget(actorRole, actorId, target, "delete");

  function run(fn: () => Promise<ActionResult>, closeDialog = false) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "İşlem başarısız.");
        return;
      }
      if (closeDialog) setDialog(null);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="İşlemler">
            <MoreHorizontal size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href={`/admin/users/${user.id}`}>
              <Eye size={16} /> Detay
            </Link>
          </DropdownMenuItem>

          {mayPremium && (
            <>
              <DropdownMenuSeparator />
              {user.is_premium ? (
                <DropdownMenuItem onClick={() => run(() => removePremium({ userId: user.id }))}>
                  <CircleSlash size={16} /> Premium Kaldır
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => run(() => setPremium({ userId: user.id, membership: "premium" }))}
                >
                  <Crown size={16} /> Premium Yap
                </DropdownMenuItem>
              )}
            </>
          )}

          {mayBan && (
            <>
              <DropdownMenuSeparator />
              {user.is_banned ? (
                <DropdownMenuItem onClick={() => run(() => unbanUser({ userId: user.id }))}>
                  <ShieldCheck size={16} /> Ban Kaldır
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="text-coral focus:bg-coral/10"
                  onClick={() => setDialog("ban")}
                >
                  <Ban size={16} /> Banla
                </DropdownMenuItem>
              )}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => run(() => sendPasswordReset({ userId: user.id }))}>
            <KeyRound size={16} /> Şifre Sıfırlama Maili
          </DropdownMenuItem>

          {mayDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-coral focus:bg-coral/10"
                onClick={() => setDialog("delete")}
              >
                <Trash2 size={16} /> Sil
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={dialog === "ban"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Kullanıcıyı banla"
        description={`${user.full_name ?? user.email ?? "Kullanıcı"} banlanacak. Giriş yapamaz.`}
        confirmLabel="Banla"
        destructive
        loading={isPending}
        error={error}
        onConfirm={() => run(() => banUser({ userId: user.id }), true)}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Kullanıcıyı sil"
        description="Bu işlem geri alınamaz. Hesap ve tüm verileri kalıcı olarak silinir."
        confirmLabel="Kalıcı olarak sil"
        destructive
        loading={isPending}
        error={error}
        onConfirm={() => run(() => deleteUser({ userId: user.id }), true)}
      />
    </>
  );
}
