"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Sparkles, RotateCcw, ScanLine } from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import { PostureUploader, type UploadedPhotos } from "./PostureUploader";
import { SelfAssessment } from "./SelfAssessment";
import { AnalysisResult } from "./AnalysisResult";
import { ScoreTrends } from "./ScoreTrends";
import { POSTURE_DISCLAIMER } from "@/lib/posture/problems";
import { deriveFindings, type Kp, type DerivedFinding } from "@/lib/posture/from-keypoints";
import { Skeleton } from "@/components/ui/Skeleton";
import type {
  PostureAnalysis,
  PostureProblem,
  TrainingEnvironment,
} from "@/lib/database.types";

// Ağır TF.js paketi yalnızca bu bölüm görününce yüklenir.
const PoseDetector = dynamic(
  () => import("./PoseDetector").then((m) => m.PoseDetector),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full rounded-2xl" /> }
);

type Mode = "result" | "form" | "analyzing";

export function PostureClient({
  userId,
  defaultEnv,
  initialAnalyses,
}: {
  userId: string;
  defaultEnv: TrainingEnvironment;
  initialAnalyses: PostureAnalysis[];
}) {
  const [analyses, setAnalyses] = useState<PostureAnalysis[]>(initialAnalyses);
  const [current, setCurrent] = useState<PostureAnalysis | null>(
    initialAnalyses[0] ?? null
  );
  const [mode, setMode] = useState<Mode>(initialAnalyses.length ? "result" : "form");

  // Form durumu
  const [env, setEnv] = useState<TrainingEnvironment>(defaultEnv);
  const [photos, setPhotos] = useState<UploadedPhotos>({});
  const [selected, setSelected] = useState<Set<PostureProblem>>(new Set());
  const [measured, setMeasured] = useState<DerivedFinding[]>([]);
  const [error, setError] = useState<string | null>(null);

  /**
   * Poz tespitinden gelen NESNEL bulgular. Eskiden eklem noktaları
   * hesaplanıp atılıyordu; artık ölçülen bulgular işaretli duruma eklenir ve
   * öz-değerlendirmeyle birlikte analize gider.
   *
   * Ölçüm işareti EKLER, kaldırmaz: kullanıcının kendi işaretlediği bir
   * durumu makine ölçemedi diye silmek yanlış olurdu.
   */
  function onKeypoints(kps: Kp[]) {
    const found = deriveFindings(kps);
    setMeasured(found);
    if (found.length === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const f of found) next.add(f.problem);
      return next;
    });
  }

  function toggle(p: PostureProblem) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  const canSubmit =
    selected.size > 0 || Object.keys(photos).length > 0;

  async function analyze() {
    setError(null);
    setMode("analyzing");
    const started = Date.now();
    try {
      const res = await fetch("/api/ai/analyze-posture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: env,
          photos,
          assessment: Array.from(selected),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.analysis) throw new Error(json.error || "Analiz başarısız.");
      // Minimum ~2.2 sn premium his
      const wait = Math.max(0, 2200 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      const analysis = json.analysis as PostureAnalysis;
      setCurrent(analysis);
      setAnalyses((prev) => [analysis, ...prev]);
      setSelected(new Set());
      setPhotos({});
      setMode("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu.");
      setMode("form");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ScanLine size={24} className="text-brand" /> Postür Analizi
          </h1>
          <p className="text-sm text-fg-muted">
            AI destekli postür değerlendirmesi + kişisel düzeltici program.
          </p>
        </div>
        {mode === "result" && (
          <button onClick={() => setMode("form")} className="btn-primary text-sm">
            <Sparkles size={16} /> Yeni Analiz
          </button>
        )}
      </header>

      <AnimatePresence mode="wait">
        {mode === "analyzing" && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex min-h-[50vh] flex-col items-center justify-center text-center"
          >
            <div className="relative mb-6 grid place-items-center">
              <motion.span
                className="absolute h-24 w-24 rounded-full border border-brand/30"
                animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
              />
              <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-brand to-coral text-3xl">
                🧍
              </div>
            </div>
            <h2 className="text-lg font-bold">Postürün analiz ediliyor...</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Bulgular değerlendiriliyor ve düzeltici program hazırlanıyor.
            </p>
          </motion.div>
        )}

        {mode === "form" && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* 1. Ortam */}
            <div className="card">
              <h2 className="mb-1 text-sm font-semibold">1. Antrenman Ortamı</h2>
              <p className="mb-3 text-xs text-fg-muted">
                Program bu seçime göre oluşturulur; sonuçta tek dokunuşla
                değiştirebilirsin.
              </p>
              <Segmented
                value={env}
                onChange={(v) => setEnv(v)}
                options={[
                  { value: "home", label: "🏠 Ev" },
                  { value: "gym", label: "🏋️ Salon" },
                  { value: "both", label: "🔁 Her İkisi" },
                ]}
              />
            </div>

            {/* 2. Fotoğraflar */}
            <div className="card">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <Camera size={16} /> 2. Fotoğraflar (opsiyonel)
              </h2>
              <p className="mb-3 text-xs text-fg-muted">
                Ön, yan ve arka fotoğraflarını yükle. Fotoğraflar özel olarak
                saklanır ve gelecekteki karşılaştırmalarda kullanılır.
              </p>
              <PostureUploader userId={userId} value={photos} onChange={setPhotos} />
            </div>

            {/* 3. Öz-değerlendirme */}
            <div className="card">
              <h2 className="mb-1 text-sm font-semibold">3. Gözlem (Öz-Değerlendirme)</h2>
              <p className="mb-4 text-xs text-fg-muted">
                Fotoğraflarına bakarak gözlemlediğin durumları işaretle. Bu
                bilgiler analiz sonucunu ve düzeltici programı belirler.
              </p>
              <SelfAssessment selected={selected} onToggle={toggle} />
            </div>

            <div className="rounded-2xl border border-ink-border bg-ink-card p-4">
              <h2 className="mb-1 text-sm font-semibold">4. Ölçüm (İsteğe Bağlı)</h2>
              <p className="mb-4 text-xs text-fg-muted">
                Fotoğrafını yükle; eklem noktaların tarayıcıda ölçülsün. Bulunan
                durumlar yukarıdaki listede otomatik işaretlenir.
              </p>
              <PoseDetector onKeypoints={onKeypoints} />
              {measured.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {measured.map((f) => (
                    <li key={f.problem} className="flex items-start gap-2 text-xs text-brand">
                      <span aria-hidden>✓</span>
                      <span>
                        <strong>{f.problem}</strong> işaretlendi — {f.measurement}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-200/90">
              <p className="text-xs leading-relaxed">{POSTURE_DISCLAIMER}</p>
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={analyze}
                disabled={!canSubmit}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                <Sparkles size={16} />
                Analizi Başlat
              </button>
              {analyses.length > 0 && (
                <button
                  onClick={() => {
                    setCurrent(analyses[0]);
                    setMode("result");
                  }}
                  className="btn-ghost text-sm"
                >
                  <RotateCcw size={15} /> Vazgeç
                </button>
              )}
            </div>
            {!canSubmit && (
              <p className="text-center text-xs text-fg-muted">
                Başlamak için en az bir gözlem işaretle veya fotoğraf yükle.
              </p>
            )}
          </motion.div>
        )}

        {mode === "result" && current && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <AnalysisResult analysis={current} />
            {analyses.length >= 2 && <ScoreTrends analyses={analyses} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
