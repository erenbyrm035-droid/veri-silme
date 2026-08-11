import { createClient } from "@/lib/supabase/server";
import { getPostureAnalyses } from "@/lib/data/posture";
import { PostureClient } from "@/components/posture/PostureClient";
import { PremiumGate } from "@/components/premium/PremiumGate";
import { PoseSection } from "./PoseSection";
import type { TrainingEnvironment } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Postür Analizi · Viva",
  description:
    "AI destekli postür analizi ve kişiselleştirilmiş düzeltici egzersiz programı.",
};

export default async function PosturePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, analyses] = await Promise.all([
    supabase
      .from("profiles")
      .select("training_environment")
      .eq("id", user!.id)
      .single(),
    getPostureAnalyses(user!.id),
  ]);

  const defaultEnv: TrainingEnvironment =
    (profile?.training_environment as TrainingEnvironment) ?? "both";

  return (
    <div className="space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">🧍 Postür Analizi</h1>
        <p className="text-sm text-fg-muted">
          AI destekli duruş analizi ve kişiselleştirilmiş düzeltici egzersiz programı.
        </p>
      </header>
      <PremiumGate
        feature="posture_analysis"
        mode="replace"
        title="AI Postür Analizi"
        description="Duruş analizi ve düzeltici program Premium üyeliğe özeldir."
      >
        <PostureClient
          userId={user!.id}
          defaultEnv={defaultEnv}
          initialAnalyses={analyses}
        />
        {/* Tarayıcı içi poz tespiti (MoveNet). Ağır TF.js paketi yalnızca
            kullanıcı bu bölümü açtığında yüklenir. */}
        <PoseSection />
      </PremiumGate>
    </div>
  );
}
