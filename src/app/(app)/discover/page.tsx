import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDiscover } from "@/lib/social/feed";
import { listTeams } from "@/lib/teams/queries";
import { DiscoverClient } from "@/components/discover/DiscoverClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Keşfet · Viva",
  description: "Trend hareketler, öne çıkan sporcular, takımlar ve haftalık görevler.",
};

export default async function DiscoverPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [data, directory] = await Promise.all([
    getDiscover(user.id),
    listTeams(user.id, { period: "all_time" }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Keşfet</h1>
        <p className="text-sm text-fg-muted">
          Trend hareketler, öne çıkan sporcular, takımlar ve haftalık görevler.
        </p>
      </header>

      <DiscoverClient data={data} teams={directory.teams.slice(0, 12)} />
    </div>
  );
}
