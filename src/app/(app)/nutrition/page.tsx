import Link from "next/link";
import { Salad, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NutritionTracker } from "@/components/NutritionTracker";
import { todayISO } from "@/lib/utils";
import type { Food, NutritionLog } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function NutritionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: foods }, { data: logs }, { data: water }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("daily_calorie_goal, daily_protein_goal, daily_water_goal_ml")
        .eq("id", user!.id)
        .single(),
      supabase.from("foods").select("*").order("name"),
      supabase
        .from("nutrition_logs")
        .select("*")
        .eq("user_id", user!.id)
        .eq("log_date", todayISO())
        .order("created_at", { ascending: true }),
      supabase
        .from("water_logs")
        .select("amount_ml")
        .eq("user_id", user!.id)
        .eq("log_date", todayISO()),
    ]);

  const waterMl = (water ?? []).reduce((s, w) => s + Number(w.amount_ml), 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Beslenme</h1>
        <p className="text-sm text-fg-muted">
          Öğünlerini, makrolarını ve suyunu takip et.
        </p>
      </header>

      <Link
        href="/nutrition/coach"
        className="flex items-center gap-3 rounded-2xl border border-brand/30 bg-gradient-to-r from-brand/10 to-transparent p-4 transition-colors hover:border-brand/60"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/15 text-2xl">
          🥗
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-bold">
            <Salad size={16} className="text-brand" /> AI Diyetisyen
          </p>
          <p className="text-xs text-fg-muted">
            Kişisel makro hedefleri, öğün planı, tarif, alışveriş listesi ve haftalık rapor.
          </p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-fg-muted" />
      </Link>

      <NutritionTracker
        userId={user!.id}
        foods={(foods ?? []) as Food[]}
        initialLogs={(logs ?? []) as NutritionLog[]}
        calorieGoal={profile?.daily_calorie_goal ?? 2000}
        proteinGoal={profile?.daily_protein_goal ?? 120}
        waterGoalMl={profile?.daily_water_goal_ml ?? 2500}
        initialWaterMl={waterMl}
      />
    </div>
  );
}
