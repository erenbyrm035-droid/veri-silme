"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Check, Loader2, ArrowRight, RefreshCw } from "lucide-react";
import { startReadyProgram, restartReadyProgram } from "@/lib/programs/ready-actions";

export function ReadyProgramStart({ programId, slug, active }: { programId: string; slug: string; active: boolean }) {
  const [loading, setLoading] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [done, setDone] = useState(active);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function start() {
    setLoading(true); setErr(null); setMsg(null);
    const res = await startReadyProgram(programId, slug);
    setLoading(false);
    if (res.ok) { setDone(true); setMsg(res.created ? `${res.created} antrenman eklendi` : null); router.refresh(); }
    else setErr(res.error ?? "Başlatılamadı.");
  }

  async function restart() {
    setRestarting(true); setErr(null); setMsg(null);
    const res = await restartReadyProgram(programId, slug);
    setRestarting(false);
    if (res.ok) { setMsg(`${res.created ?? 0} antrenman yeniden oluşturuldu`); router.refresh(); }
    else setErr(res.error ?? "Yeniden başlatılamadı.");
  }

  if (done) {
    return (
      <div className="space-y-2 rounded-xl border border-brand/30 bg-brand/8 p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand">
          <Check size={18} /> Program başlatıldı — günleri Antrenmanlar’a eklendi
        </p>
        {msg && <p className="text-xs text-fg-muted">{msg}</p>}
        <div className="flex gap-2">
          <Link href="/workouts" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-black">
            Antrenmanlarıma git <ArrowRight size={16} />
          </Link>
          <button onClick={restart} disabled={restarting}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-ink-border bg-ink-soft px-3 py-2 text-sm font-semibold text-fg-muted hover:text-fg disabled:opacity-50"
            title="Bu programın antrenmanlarını sıfırdan oluştur (tamamlananlara dokunmaz)">
            {restarting ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Yeniden
          </button>
        </div>
        {err && <p className="text-xs text-coral">{err}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button onClick={start} disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2">
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
        {loading ? "Antrenmanlar hazırlanıyor…" : "Programı Başlat"}
      </button>
      <p className="text-center text-[11px] text-fg-muted">Programın günleri planlı antrenman olarak Antrenmanlar’a eklenir.</p>
      {err && <p className="text-center text-xs text-coral">{err}</p>}
    </div>
  );
}
