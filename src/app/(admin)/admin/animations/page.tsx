import { createClient } from "@/lib/supabase/server";
import { getAnimations } from "@/lib/data/animations";
import { AnimationManager } from "@/components/animation/AnimationManager";
import { PageHeader } from "@/features/admin/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function AdminAnimationsPage() {
  const supabase = await createClient();
  const [animations, { data: exercises }] = await Promise.all([
    getAnimations(),
    supabase.from("exercises").select("id, name").order("name").limit(2000),
  ]);

  return (
    <div>
      <PageHeader
        title="Animations"
        description="3D animasyon yükle, önizle, egzersize eşle ve yönet."
      />
      <AnimationManager
        initialAnimations={animations}
        exercises={(exercises ?? []) as { id: string; name: string }[]}
      />
    </div>
  );
}
