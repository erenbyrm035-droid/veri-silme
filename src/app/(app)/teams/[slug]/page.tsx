import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeamHub } from "@/lib/teams/queries";
import { TeamHubClient } from "@/components/teams/TeamHubClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { title: "Takım · Viva" };
  const hub = await getTeamHub(slug, user.id);
  return { title: hub ? `${hub.team.name} · Viva` : "Takım · Viva" };
}

export default async function TeamHubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const hub = await getTeamHub(slug, user.id);
  if (!hub) notFound();
  return <TeamHubClient hub={hub} />;
}
