import { createClient } from "@/lib/supabase/server";
import { getRewardsPage } from "@/lib/rewards/queries";
import { RewardsClient } from "@/components/rewards/RewardsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ödüller · Viva",
  description: "Kazandığın coin'lerle ödülleri talep et.",
};

export default async function RewardsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const data = await getRewardsPage(user!.id);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold sm:text-2xl">🎁 Ödüller</h1>
        <p className="text-sm text-fg-muted">
          Antrenman yaptıkça coin kazan, ödülleri talep et.
        </p>
      </header>
      <RewardsClient data={data} />
    </div>
  );
}
