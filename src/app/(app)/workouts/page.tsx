import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { VolumeChart } from "@/components/workout/VolumeChart";
import { PremiumGate } from "@/components/premium/PremiumGate";
import { getWeeklyVolume, getTopPRs } from "@/lib/data/workouts";
import { formatShortDate } from "@/lib/utils";
import { Plus, Dumbbell, CheckCircle2, Clock, Trophy, BarChart3, LayoutGrid, ChevronRight, Play } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkoutsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // En son YARIM KALAN antrenman: tamamlanmamış ama en az bir seti bitmiş.
  // Ayrı bir sorgu değil; aşağıdaki listeden türetiliyor.
  const [{ data: workouts }, volume, prs] = await Promise.all([
    supabase
      .from("workouts")
      .select("id, title, workout_date, status, duration_min, workout_sets(count)")
      .eq("user_id", user!.id)
      .order("workout_date", { ascending: false })
      .limit(50),
    getWeeklyVolume(user!.id),
    getTopPRs(user!.id),
  ]);

  // Yarım kalan antrenman: tamamlanmamış, planlı seti olan en yeni kayıt.
  const aday = (workouts ?? []).find((w) => w.status !== "completed");
  const adayToplam = aday
    ? ((aday.workout_sets as unknown as { count: number }[])?.[0]?.count ?? 0)
    : 0;

  // Tamamlanan set sayısı listede yok; yalnızca ADAY VARSA tek küçük sorgu.
  // Sabit bir sayı göstermek ("0/12") kullanıcıyı yanıltırdı.
  let devamEden: { id: string; title: string; toplam: number; tamamlanan: number } | null = null;
  if (aday && adayToplam > 0) {
    const { count } = await supabase
      .from("workout_sets")
      .select("id", { count: "exact", head: true })
      .eq("workout_id", aday.id)
      .eq("completed", true);
    devamEden = {
      id: aday.id as string,
      title: aday.title as string,
      toplam: adayToplam,
      tamamlanan: count ?? 0,
    };
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Antrenmanlar</h1>
          <p className="text-sm text-fg-muted">Geçmişini takip et, yenisini başlat.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/exercises" className="btn-ghost">
            Egzersizler
          </Link>
          <Link href="/workouts/new" className="btn-primary">
            <Plus size={18} /> Yeni
          </Link>
        </div>
      </header>

      {/* YARIM KALAN ANTRENMAN — kullanıcı uygulamadan çıkıp döndüğünde
          kaldığı yeri bulmalı. İlerleme zaten workout_sets'te kalıcı;
          burada yalnızca görünür kılıyoruz. */}
      {devamEden && (
        <Link href={`/workouts/${devamEden.id}`}>
          <Card className="card-hover flex items-center justify-between border-brand/40 bg-brand/5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
                <Play size={20} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">Antrenmanına devam et</p>
                <p className="truncate text-sm text-fg-muted">
                  {devamEden.title} · {devamEden.tamamlanan}/{devamEden.toplam} set tamamlandı
                </p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-semibold text-brand">Devam →</span>
          </Card>
        </Link>
      )}

      {/* Hazır programlar girişi */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/programs/hazir">
          <Card className="card-hover flex items-center justify-between border-brand/30 bg-brand/5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/15 text-brand">
                <LayoutGrid size={20} />
              </span>
              <div>
                <p className="font-semibold">Hazır Programlar</p>
                <p className="text-xs text-fg-muted">Pilates, yoga, kalistenik, HIIT… seç ve başla</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-fg-muted" />
          </Card>
        </Link>
        <Link href="/programs">
          <Card className="card-hover flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-fg/5 text-fg-muted">
                <Dumbbell size={20} />
              </span>
              <div>
                <p className="font-semibold">AI Programlarım</p>
                <p className="text-xs text-fg-muted">Sana özel plan oluştur / geçmiş planlar</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-fg-muted" />
          </Card>
        </Link>
      </div>

      {/* Rekorlar */}
      {prs.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">
            <Trophy size={15} className="text-brand" /> Kişisel Rekorlar
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {prs.map((pr) => (
              <Card key={pr.id} className="gap-1 p-3.5">
                <p className="truncate text-sm font-semibold">{pr.exercise_name}</p>
                <p className="text-lg font-bold text-brand tabular-nums">
                  {pr.best_weight} kg
                  {pr.best_reps ? (
                    <span className="text-xs font-medium text-fg-muted"> × {pr.best_reps}</span>
                  ) : null}
                </p>
                <p className="text-xs text-fg-muted tabular-nums">~{pr.est_1rm} kg 1RM</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Haftalık hacim — `advanced_analytics` kapsamındaki "hacim trendi".
          Antrenman listesi, PR'lar ve devam eden antrenman açık kalıyor;
          kapı yalnızca trend grafiğinde. */}
      {volume.length >= 2 && (
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">
            <BarChart3 size={15} className="text-brand" /> Haftalık Hacim (tonaj)
          </h2>
          <PremiumGate
            feature="advanced_analytics"
            description="Haftalık tonaj trendini görmek Premium'a özeldir."
          >
            <VolumeChart data={volume} />
          </PremiumGate>
        </Card>
      )}

      {!workouts || workouts.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Dumbbell size={26} />
          </span>
          <div>
            <p className="font-semibold">Henüz antrenman yok</p>
            <p className="mt-1 text-sm text-fg-muted">
              İlk antrenmanını başlatarak yolculuğa çık.
            </p>
          </div>
          <Link href="/workouts/new" className="btn-primary">
            <Plus size={18} /> Antrenman Başlat
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {workouts.map((w) => {
            const setCount =
              (w.workout_sets as unknown as { count: number }[])?.[0]?.count ?? 0;
            const completed = w.status === "completed";
            return (
              <Link key={w.id} href={`/workouts/${w.id}`}>
                <Card className="card-hover flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span
                      className={
                        completed
                          ? "grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand"
                          : "grid h-11 w-11 place-items-center rounded-xl bg-fg/5 text-fg-muted"
                      }
                    >
                      {completed ? (
                        <CheckCircle2 size={20} />
                      ) : (
                        <Clock size={20} />
                      )}
                    </span>
                    <div>
                      <p className="font-semibold">{w.title}</p>
                      <p className="text-sm text-fg-muted">
                        {formatShortDate(w.workout_date)} · {setCount} set
                        {w.duration_min ? ` · ${w.duration_min} dk` : ""}
                      </p>
                    </div>
                  </div>
                  <span
                    className={
                      completed
                        ? "rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand"
                        : "rounded-full bg-fg/5 px-3 py-1 text-xs font-medium text-fg-muted"
                    }
                  >
                    {completed ? "Tamamlandı" : w.status === "planned" ? "Planlandı" : "Devam ediyor"}
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
