import { Trophy, Clock, Flame, Layers, Repeat, Dumbbell, TrendingUp, TrendingDown, Sparkles, HeartPulse } from "lucide-react";
import type { WorkoutSummaryData } from "@/lib/workout/summary";
import type { AnalysisResult } from "@/lib/workout/ai-analysis";
import { ShareWorkout } from "./ShareWorkout";
import { JoinParty } from "./JoinParty";
import type { LiveSessionView } from "@/lib/social/types";

// ============================================================================
// Antrenman sonu özeti — sunucu bileşeni (istemci JS'i yok).
//
// Rakamların TAMAMI `summary.ts` içinde veritabanından hesaplandı. Bu bileşen
// yalnızca gösteriyor. AI anlatısı varsa üste eklenir; yoksa özet eksiksiz
// çalışmaya devam eder.
// ============================================================================

export function WorkoutSummary({
  data,
  analysis,
  party = null,
}: {
  data: WorkoutSummaryData;
  analysis: AnalysisResult | null;
  /** Arkadaşların açık partisi — yoksa kart gösterilmez. */
  party?: LiveSessionView | null;
}) {
  const { totals, comparison, prs } = data;
  const artis = comparison.volumeChangePct;

  return (
    <div className="space-y-4">
      {/* Rekorlar en üstte — antrenmanın en değerli sonucu */}
      {prs.length > 0 && (
        <div className="card border-brand/40 bg-brand/5">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-brand" />
            <h2 className="text-sm font-bold text-brand">
              {prs.length > 1 ? `${prs.length} yeni rekor!` : "Yeni rekor!"}
            </h2>
          </div>
          <div className="mt-3 space-y-2">
            {prs.map((pr) => (
              <div key={pr.exerciseName} className="flex items-center justify-between rounded-xl bg-ink-soft px-3 py-2.5">
                <span className="text-sm font-semibold">{pr.exerciseName}</span>
                <span className="text-sm text-brand">
                  {pr.weightKg} kg × {pr.reps}
                  <span className="ml-2 text-xs text-fg-muted">1RM ~{pr.est1rm}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Temel sayılar */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={<Clock size={15} />} label="Süre" value={data.durationMin ? `${data.durationMin} dk` : "—"} />
        <Stat icon={<Dumbbell size={15} />} label="Hacim" value={`${totals.totalVolume.toLocaleString("tr-TR")} kg`} />
        <Stat icon={<Layers size={15} />} label="Set" value={String(totals.totalSets)} />
        <Stat icon={<Repeat size={15} />} label="Tekrar" value={String(totals.totalReps)} />
        <Stat icon={<Flame size={15} />} label="Kalori" value={data.calories ? `~${data.calories}` : "—"} />
        <Stat icon={<Dumbbell size={15} />} label="Hareket" value={String(totals.exerciseCount)} />
      </div>

      {/* Önceki antrenmanla karşılaştırma */}
      {artis !== null && comparison.previousVolume !== null && (
        <div className={`card flex items-center gap-3 ${artis >= 0 ? "border-brand/30" : "border-amber-500/30"}`}>
          {artis >= 0
            ? <TrendingUp size={20} className="shrink-0 text-brand" />
            : <TrendingDown size={20} className="shrink-0 text-amber-400" />}
          <div>
            <p className="text-sm font-semibold">
              Hacim {artis >= 0 ? "arttı" : "azaldı"}: %{Math.abs(artis)}
            </p>
            <p className="text-xs text-fg-muted">
              Önceki antrenman {comparison.previousVolume.toLocaleString("tr-TR")} kg →
              bugün {totals.totalVolume.toLocaleString("tr-TR")} kg
            </p>
          </div>
        </div>
      )}

      {/* Kas grubu dağılımı */}
      {totals.muscleGroups.length > 0 && (
        <div className="card space-y-2.5">
          <h3 className="text-sm font-semibold">Kas grubu dağılımı</h3>
          {totals.muscleGroups.map((m) => {
            const pay = totals.totalVolume > 0
              ? Math.round((m.volume / totals.totalVolume) * 100)
              : Math.round((m.sets / Math.max(1, totals.totalSets)) * 100);
            return (
              <div key={m.name}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-fg-muted">{m.sets} set · {pay > 0 ? `%${pay}` : "—"}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-soft">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, pay)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI değerlendirmesi — bulguları anlatır, sayı üretmez */}
      {analysis?.text && (
        <div className="card space-y-2 border-brand/25">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={16} className="text-brand" /> Koç değerlendirmesi
          </h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-fg-muted">{analysis.text}</p>
        </div>
      )}

      {/* Toparlanma notu */}
      {data.recoveryNote && (
        <div className="card flex gap-3 border-ink-border">
          <HeartPulse size={18} className="mt-0.5 shrink-0 text-fg-muted" />
          <div>
            <p className="text-sm font-semibold">Toparlanma</p>
            <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{data.recoveryNote}</p>
          </div>
        </div>
      )}

      {/* Arkadaşların hâlâ çalışıyorsa katıl */}
      {party && party.status === "live" && (
        <JoinParty
          sessionId={party.id}
          title={party.title}
          hostName={party.host.name}
          participants={party.participants.length}
          alreadyIn={party.im_in}
        />
      )}

      {/* Paylaşım — metin özet rakamlarından üretilir, kullanıcı düzenleyebilir */}
      <ShareWorkout defaultText={shareText(data)} />

      {/* AI yoksa bulgular yine gösterilir — veri kaybolmaz */}
      {!analysis?.text && data.facts.length > 0 && (
        <div className="card space-y-1.5">
          <h3 className="text-sm font-semibold">Bu antrenmanda</h3>
          <ul className="space-y-1">
            {data.facts.map((f, i) => (
              <li key={i} className="text-xs leading-relaxed text-fg-muted">· {f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Paylaşım metni — abartı yok, gerçek rakamlar. */
function shareText(d: WorkoutSummaryData): string {
  const p: string[] = [`${d.workout.title} tamamlandı.`];
  const t = d.totals;
  p.push(`${t.exerciseCount} hareket · ${t.totalSets} set · ${t.totalReps} tekrar`);
  if (t.totalVolume > 0) p.push(`Toplam hacim: ${t.totalVolume.toLocaleString("tr-TR")} kg`);
  if (d.durationMin) p.push(`Süre: ${d.durationMin} dk`);
  for (const pr of d.prs) p.push(`Yeni rekor: ${pr.exerciseName} ${pr.weightKg} kg × ${pr.reps}`);
  return p.join("\n");
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-border bg-ink-soft px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] text-fg-muted">{icon} {label}</p>
      <p className="mt-0.5 text-base font-bold">{value}</p>
    </div>
  );
}
