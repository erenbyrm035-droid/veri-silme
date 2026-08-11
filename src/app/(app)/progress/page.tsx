import { createClient } from "@/lib/supabase/server";
import { ProgressTracker } from "@/components/ProgressTracker";
import { PhotoCompare } from "@/components/PhotoCompare";
import type { BodyMeasurement } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: measurements } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("user_id", user!.id)
    .order("measured_on", { ascending: true })
    .limit(100);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Vücut Gelişimi</h1>
        <p className="text-sm text-fg-muted">
          Kilo, ölçü ve fotoğraflarınla değişimini izle.
        </p>
      </header>

      <ProgressTracker
        userId={user!.id}
        initial={(measurements ?? []) as BodyMeasurement[]}
      />

      <PhotoCompare userId={user!.id} />
    </div>
  );
}
