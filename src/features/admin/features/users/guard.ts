import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AdminRole } from "@/lib/database.types";

export interface AdminContext {
  id: string;
  email: string | null;
  fullName: string | null;
  role: AdminRole;
}

/**
 * Geçerli oturumun admin bağlamını döndürür.
 * Admin değilse null döner (çağıran taraf yönlendirir / hata döndürür).
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, admin_role, full_name")
    .eq("id", user.id)
    .single();

  const role: AdminRole | null =
    (profile?.admin_role as AdminRole) ??
    (profile?.is_admin ? "super_admin" : null);
  if (!role) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    role,
  };
}

/** Admin bağlamını zorunlu kılar; yoksa hata fırlatır (server action guard). */
export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) throw new Error("Yetkisiz: admin erişimi gerekli.");
  return ctx;
}
