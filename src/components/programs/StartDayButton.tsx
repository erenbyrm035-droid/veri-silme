"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/utils";
import type { ProgramDay } from "@/lib/database.types";
import { Play, Loader2 } from "lucide-react";

/**
 * Bir program gününü gerçek antrenmana dönüştürür: workout + planlı setler
 * oluşturur ve oturuma yönlendirir.
 */
export function StartDayButton({ day, userId }: { day: ProgramDay; userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    const supabase = createClient();

    const { data: workout, error } = await supabase
      .from("workouts")
      .insert({
        user_id: userId,
        title: `${day.day} · ${day.focus}`,
        workout_date: todayISO(),
        status: "in_progress",
      })
      .select("id")
      .single();

    if (error || !workout) {
      setLoading(false);
      return;
    }

    // Egzersiz adlarını kütüphaneyle eşleştir (id için)
    const names = day.exercises.map((e) => e.name);
    const { data: exRows } = await supabase
      .from("exercises")
      .select("id, name")
      .in("name", names);
    const idByName = new Map((exRows ?? []).map((e) => [e.name, e.id as string]));

    // Planlı setleri oluştur (her egzersiz için set sayısı kadar satır)
    const rows: {
      workout_id: string;
      exercise_id: string | null;
      exercise_name: string;
      set_order: number;
      reps: number | null;
      completed: boolean;
    }[] = [];
    day.exercises.forEach((ex) => {
      const firstRep = parseInt(String(ex.reps).match(/\d+/)?.[0] ?? "", 10);
      for (let i = 1; i <= (ex.sets || 1); i++) {
        rows.push({
          workout_id: workout.id,
          exercise_id: idByName.get(ex.name) ?? null,
          exercise_name: ex.name,
          set_order: i,
          reps: Number.isFinite(firstRep) ? firstRep : null,
          completed: false,
        });
      }
    });
    if (rows.length) await supabase.from("workout_sets").insert(rows);

    router.push(`/workouts/${workout.id}`);
    router.refresh();
  }

  return (
    <button
      onClick={start}
      disabled={loading}
      className="btn-ghost w-full text-sm"
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
      Bu günü antrenman olarak başlat
    </button>
  );
}
