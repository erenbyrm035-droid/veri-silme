import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/premium/entitlements";
import { SettingsClient } from "@/components/settings/SettingsClient";
import type { UserSettings } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ayarlar" };

const DEFAULTS: Omit<UserSettings, "user_id"> = {
  theme: "system", locale: "tr", units: "metric", notif_prefs: {}, privacy: {}, updated_at: "",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: settings }, { data: profile }] = await Promise.all([
    supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("is_premium, membership_type, premium_until").eq("id", user.id).maybeSingle(),
  ]);

  const ent = getEntitlements(profile ?? undefined);
  const merged: UserSettings = { user_id: user.id, ...DEFAULTS, ...(settings ?? {}) };

  return <SettingsClient email={user.email ?? ""} settings={merged} isPremium={ent.isPremium} />;
}
