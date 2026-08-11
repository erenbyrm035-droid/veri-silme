import { createClient } from "@/lib/supabase/server";
import { getPostureAnalyses } from "@/lib/data/posture";
import { PostureClient } from "@/components/posture/PostureClient";
import { ClinicalWarning } from "@/components/posture/ClinicalWarning";
import { PremiumGate } from "@/components/premium/PremiumGate";
import { PoseSection } from "./PoseSection";
import type { TrainingEnvironment } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Postür Analizi · Viva",
  description: "Kameradan veya galeriden fotoğrafla AI destekli postür analizi ve düzeltici program.",
};

export default async function PostureAnalysisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, analyses] = await Promise.all([
    supabase.from("profiles").select("training_environment").eq("id", user!.id).single(),
    getPostureAnalyses(user!.id),
  ]);
  const defaultEnv: TrainingEnvironment = (profile?.training_environment as TrainingEnvironment) ?? "both";

  return (
    <div className="space-y-6">
      <ClinicalWarning risk={analyses[0]?.risk_level ?? null} />
      <PremiumGate
        feature="posture_analysis"
        mode="replace"
        title="AI Postür Analizi"
        description="Duruş analizi ve düzeltici program Premium üyeliğe özeldir."
      >
        <PoseSection />
        <PostureClient userId={user!.id} defaultEnv={defaultEnv} initialAnalyses={analyses} />
      </PremiumGate>
    </div>
  );
}
