import { redirect } from "next/navigation";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { createAdminClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/features/admin/features/settings/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ayarlar · Admin" };

export default async function SettingsPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  if (ctx.role !== "super_admin") redirect("/admin");

  const supabase = createAdminClient();
  const { data } = await supabase.from("app_settings").select("key, value");
  const map = new Map((data ?? []).map((r: { key: string; value: Record<string, unknown> }) => [r.key, r.value]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ayarlar</h1>
        <p className="mt-1 text-sm text-fg-muted">AI, özellik bayrakları ve site yapılandırması.</p>
      </div>
      <SettingsForm
        ai={(map.get("ai") as Record<string, unknown>) ?? {}}
        features={(map.get("features") as Record<string, unknown>) ?? {}}
        site={(map.get("site") as Record<string, unknown>) ?? {}}
        nutritionAi={(map.get("nutrition_ai") as Record<string, unknown>) ?? {}}
      />
    </div>
  );
}
