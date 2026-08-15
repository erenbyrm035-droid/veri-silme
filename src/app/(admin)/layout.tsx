import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QueryProvider } from "@/features/admin/providers/query-provider";
import { AdminSidebar } from "@/features/admin/components/layout/admin-sidebar";
import { AdminTopbar } from "@/features/admin/components/layout/admin-topbar";
import type { AdminRole } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · Viva",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, admin_role, full_name, avatar_url")
    .eq("id", user.id)
    .single();

  const hasAccess =
    profile?.is_admin ||
    ["super_admin", "admin", "editor"].includes(profile?.admin_role ?? "");
  if (!hasAccess) redirect("/dashboard");

  const role: AdminRole | null =
    (profile?.admin_role as AdminRole) ??
    (profile?.is_admin ? "super_admin" : null);

  return (
    <QueryProvider>
      <div className="flex min-h-[100dvh] bg-ink">
        <AdminSidebar role={role} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopbar
            name={profile?.full_name ?? ""}
            email={user.email ?? ""}
            avatarUrl={profile?.avatar_url ?? null}
            role={role}
          />
          <main id="icerik" tabIndex={-1} className="px-safe mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </QueryProvider>
  );
}
