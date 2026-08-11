import type { AdminRole } from "@/lib/database.types";

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Süper Admin",
  admin: "Admin",
  editor: "Editör",
};

export const ADMIN_ROLE_BADGE: Record<AdminRole, "default" | "secondary" | "warning"> = {
  super_admin: "default",
  admin: "warning",
  editor: "secondary",
};

/** Bir rolün bir öğeye erişip erişemeyeceğini döndürür. */
export function canAccess(role: AdminRole | null, allowed?: AdminRole[]): boolean {
  if (!role) return false;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(role);
}
