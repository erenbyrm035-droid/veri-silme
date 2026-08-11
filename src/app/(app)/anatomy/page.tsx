
import { getCachedMuscles } from "@/lib/data/catalog";
import { MuscleMap } from "@/components/anatomy/MuscleMap";
import { AnatomyExplorer } from "@/components/anatomy/AnatomyExplorer";

export const dynamic = "force-dynamic";

export default async function AnatomyPage() {
  const muscles = await getCachedMuscles();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Anatomi Kâşifi</h1>
        <p className="text-sm text-fg-muted">
          Kas haritasından bir bölgeye dokun ya da aşağıdan ara; çalıştıran hareketleri ve anatomiyi keşfet.
        </p>
      </header>

      <MuscleMap muscles={muscles} />

      <AnatomyExplorer muscles={muscles} />
    </div>
  );
}
