import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

import { getCachedExercises } from "@/lib/data/catalog";
import { getFavoriteIds } from "@/lib/data/favorites";
import { ExerciseBrowser } from "@/components/exercise/ExerciseBrowser";
import { PersonStanding } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [exercises, favoriteIds] = await Promise.all([
    getCachedExercises(),
    user ? getFavoriteIds(user.id) : Promise.resolve(new Set<string>()),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Egzersiz Kütüphanesi</h1>
          <p className="text-sm text-fg-muted">
            Kas grubu, ekipman ve zorluğa göre filtrele; doğru formu öğren.
          </p>
        </div>
        <Link href="/anatomy" className="btn-ghost shrink-0">
          <PersonStanding size={16} /> Anatomi
        </Link>
      </header>

      <ExerciseBrowser exercises={exercises} favoriteIds={Array.from(favoriteIds)} />
    </div>
  );
}
