import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getFeed, type FeedScope } from "@/lib/social/feed";
import { listFriends, getFriendParty } from "@/lib/social/queries";
import { FeedClient } from "@/components/feed/FeedClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Akış · Viva",
  description: "Arkadaşlarının antrenmanları, başarıları ve paylaşımları.",
};

const SCOPES: FeedScope[] = ["friends", "public", "mine"];

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ kapsam?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const scope: FeedScope = SCOPES.includes(sp.kapsam as FeedScope)
    ? (sp.kapsam as FeedScope)
    : "friends";

  const admin = createAdminClient();
  // Tek tur: akış + arkadaşlar + aktif parti + kilo (kalori tahmini için).
  const [feed, friends, party, { data: prof }] = await Promise.all([
    getFeed(user.id, scope),
    listFriends(admin, user.id),
    getFriendParty(admin, user.id),
    admin.from("profiles").select("weight_kg").eq("id", user.id).maybeSingle(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Akış</h1>
        <p className="text-sm text-fg-muted">
          Arkadaşlarının antrenmanları, başarıları ve paylaşımları.
        </p>
      </header>

      <FeedClient
        posts={feed.posts}
        scope={scope}
        meId={feed.meId}
        friendCount={feed.friendCount}
        hasTeam={feed.hasTeam}
        friends={friends}
        party={party}
        weightKg={(prof?.weight_kg as number) ?? null}
      />
    </div>
  );
}
