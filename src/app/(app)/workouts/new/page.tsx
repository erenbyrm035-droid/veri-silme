"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/utils";
import { ArrowLeft, Dumbbell } from "lucide-react";
import Link from "next/link";

const PRESETS = [
  "Göğüs & Triceps",
  "Sırt & Biceps",
  "Bacak Günü",
  "Omuz & Karın",
  "Full Body",
  "Kardiyo",
];

export default function NewWorkoutPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [loading, setLoading] = useState(false);

  async function start() {
    if (!title.trim()) return;
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Oturum arada düşmüş olabilir (sekme uzun süre açık kaldıysa sık görülür).
    // `user!` demek burada çökmeye yol açıyordu; kullanıcıyı girişe yolluyoruz.
    if (!user) {
      setLoading(false);
      router.push("/login");
      return;
    }
    const { data, error } = await supabase
      .from("workouts")
      .insert({
        user_id: user.id,
        title: title.trim(),
        workout_date: date,
        status: "in_progress",
      })
      .select("id")
      .single();

    if (error || !data) {
      setLoading(false);
      return;
    }
    router.push(`/workouts/${data.id}`);
  }

  return (
    <div className="space-y-6">
      <Link
        href="/workouts"
        className="inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft size={16} /> Antrenmanlar
      </Link>

      <header>
        <h1 className="text-2xl font-bold">Yeni Antrenman</h1>
        <p className="text-sm text-fg-muted">Bir isim ver ve başla.</p>
      </header>

      <div className="card space-y-4">
        <div>
          <label className="label">Antrenman Adı</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn: Göğüs & Triceps"
          />
        </div>

        <div>
          <label className="label">Hızlı Seçim</label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTitle(p)}
                className="rounded-full border border-ink-border bg-ink-soft px-3 py-1.5 text-xs text-fg-muted transition-colors hover:border-brand/50"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Tarih</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <button
          onClick={start}
          disabled={!title.trim() || loading}
          className="btn-primary w-full"
        >
          <Dumbbell size={18} />
          {loading ? "Başlatılıyor..." : "Antrenmanı Başlat"}
        </button>
      </div>
    </div>
  );
}
