import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listTeams } from "@/lib/teams/queries";
import { TeamsDirectory } from "@/components/teams/TeamsDirectory";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Takımlar · Viva",
  description: "Takımına katıl, birlikte antrenman yap, sıralamada yüksel.",
};

export default async function TeamsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { teams, myTeamId } = await listTeams(user.id, { period: "all_time" });
  const myTeam = teams.find((t) => t.id === myTeamId) ?? null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold sm:text-2xl">Takımlar</h1>
        <p className="text-sm text-fg-muted">
          Bir topluluğa katıl, birlikte antrenman yap ve takımını zirveye taşı.
        </p>
      </header>
      <TeamsDirectory initial={teams} myTeam={myTeam} />
    </div>
  );
}
