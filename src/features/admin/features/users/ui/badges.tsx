import { Badge } from "@/features/admin/components/ui/badge";
import { ADMIN_ROLE_LABELS } from "@/features/admin/config/roles";
import type { AdminRole } from "@/lib/database.types";

export function RoleBadge({ role }: { role: AdminRole | null }) {
  if (!role) return <Badge variant="outline">Kullanıcı</Badge>;
  const variant =
    role === "super_admin" ? "default" : role === "admin" ? "warning" : "secondary";
  return <Badge variant={variant}>{ADMIN_ROLE_LABELS[role]}</Badge>;
}

export function PremiumBadge({ isPremium }: { isPremium: boolean }) {
  return isPremium ? (
    <Badge variant="success">Premium</Badge>
  ) : (
    <Badge variant="secondary">Ücretsiz</Badge>
  );
}

export function AccountStatusBadge({
  isBanned,
  isActive,
}: {
  isBanned: boolean;
  isActive: boolean;
}) {
  if (isBanned) return <Badge variant="danger">Banlı</Badge>;
  if (!isActive) return <Badge variant="outline">Pasif</Badge>;
  return <Badge variant="success">Aktif</Badge>;
}
