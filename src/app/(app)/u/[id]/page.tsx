import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicProfile } from "@/lib/social/feed";
import { PublicProfileClient } from "@/components/social/PublicProfileClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { title: "Sporcu · Viva" };
  const p = await getPublicProfile(id, user.id);
  return { title: p ? `${p.name} · Viva` : "Sporcu · Viva" };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Kendi profilinde tam sürüm gösterilir; herkese açık görünüm başkaları içindir.
  if (id === user.id) redirect("/profile");

  const profile = await getPublicProfile(id, user.id);
  if (!profile) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PublicProfileClient profile={profile} meId={user.id} />
    </div>
  );
}
