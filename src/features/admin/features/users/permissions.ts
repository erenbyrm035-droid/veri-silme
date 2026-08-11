import type { AdminRole } from "@/lib/database.types";

/**
 * Rol tabanlı yetkilendirme (RBAC).
 * Kurallar (sprint spesifikasyonu):
 *  - Editor kullanıcı silemez.
 *  - Editor premium veremez/kaldıramaz.
 *  - Yalnızca Super Admin rol değiştirebilir.
 *  - Ban / aktiflik yalnızca admin + super_admin.
 *  - Not ekleme + şifre sıfırlama tüm admin rollerinde.
 */
export type AdminAction =
  | "view"
  | "note"
  | "password_reset"
  | "premium"
  | "ban"
  | "active"
  | "role"
  | "delete";

const RULES: Record<AdminAction, AdminRole[]> = {
  view: ["super_admin", "admin", "editor"],
  note: ["super_admin", "admin", "editor"],
  password_reset: ["super_admin", "admin", "editor"],
  premium: ["super_admin", "admin"],
  ban: ["super_admin", "admin"],
  active: ["super_admin", "admin"],
  role: ["super_admin"],
  delete: ["super_admin", "admin"],
};

export function can(role: AdminRole | null, action: AdminAction): boolean {
  if (!role) return false;
  return RULES[action].includes(role);
}

/**
 * Hedef kullanıcı üzerinde işlem yapılabilir mi?
 * - Kimse kendini silemez/banlayamaz.
 * - Bir super_admin'i yalnızca super_admin değiştirebilir.
 */
export function canActOnTarget(
  actorRole: AdminRole | null,
  actorId: string,
  target: { id: string; admin_role: AdminRole | null },
  action: AdminAction
): boolean {
  if (!can(actorRole, action)) return false;
  const selfDestructive = action === "delete" || action === "ban" || action === "active";
  if (selfDestructive && actorId === target.id) return false;
  // Super admin hedefi yalnızca super_admin tarafından yönetilir.
  if (target.admin_role === "super_admin" && actorRole !== "super_admin") return false;
  return true;
}
