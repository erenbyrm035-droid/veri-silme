import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditProfileForm } from "@/components/profile/EditProfileForm";
import type { Profile } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Profili Düzenle" };

export default async function ProfileEditPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Mevcut profil verisi (form otomatik dolar; INSERT yok, yalnızca UPDATE).
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-2xl">
      <EditProfileForm profile={profile as Profile} userId={user.id} />
    </div>
  );
}
