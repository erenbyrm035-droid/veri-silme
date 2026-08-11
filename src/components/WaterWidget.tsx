"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { syncMyGamification } from "@/lib/gamification/actions";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Droplet, Plus } from "lucide-react";
import { toPercent, todayISO } from "@/lib/utils";

export function WaterWidget({
  userId,
  initialMl,
  goalMl,
}: {
  userId: string;
  initialMl: number;
  goalMl: number;
}) {
  const router = useRouter();
  const [ml, setMl] = useState(initialMl);
  const [loading, setLoading] = useState(false);

  async function addWater(amount: number) {
    setLoading(true);
    const supabase = createClient();
    await supabase.from("water_logs").insert({
      user_id: userId,
      amount_ml: amount,
      log_date: todayISO(),
    });
    setMl((m) => m + amount);
    setLoading(false);
    void syncMyGamification(); // hedef tuttuğunda XP güncellensin (ateşle-unut)
    router.refresh();
  }

  return (
    <div className="card flex flex-col items-center gap-3">
      <ProgressRing value={toPercent(ml, goalMl)} color="#38bdf8" size={92}>
        <div className="text-center">
          <Droplet size={16} className="mx-auto text-sky-400" />
          <div className="mt-0.5 text-sm font-bold">
            {(ml / 1000).toFixed(1)}L
          </div>
        </div>
      </ProgressRing>
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">
          Su Tüketimi
        </p>
        <p className="text-xs text-fg-muted">Hedef {(goalMl / 1000).toFixed(1)}L</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => addWater(250)}
          disabled={loading}
          className="btn-ghost px-3 py-1.5 text-xs"
        >
          <Plus size={14} /> 250ml
        </button>
        <button
          onClick={() => addWater(500)}
          disabled={loading}
          className="btn-ghost px-3 py-1.5 text-xs"
        >
          <Plus size={14} /> 500ml
        </button>
      </div>
    </div>
  );
}
