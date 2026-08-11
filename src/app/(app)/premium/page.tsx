import { getUserEntitlements } from "@/lib/premium/guard";
import { PremiumClient } from "@/components/premium/PremiumClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Premium" };

export default async function PremiumPage() {
  const ent = await getUserEntitlements();
  return (
    <PremiumClient currentPlan={ent.plan} isPremium={ent.isPremium} premiumUntil={ent.premiumUntil} />
  );
}
