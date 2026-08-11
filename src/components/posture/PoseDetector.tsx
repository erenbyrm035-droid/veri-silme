"use client";

import * as React from "react";
import { Camera, Upload, Loader2, AlertTriangle } from "lucide-react";
import { reportErrorSync } from "@/lib/observability/report";

type Kp = { name?: string; x: number; y: number; score?: number };
type Metric = { label: string; value: string };

const SKELETON: [string, string][] = [
  ["left_shoulder", "right_shoulder"], ["left_shoulder", "left_hip"], ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"], ["left_hip", "left_knee"], ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"], ["right_knee", "right_ankle"], ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"], ["right_shoulder", "right_elbow"], ["right_elbow", "right_wrist"],
];

/**
 * MediaPipe/MoveNet (TensorFlow.js) tabanlı poz tespiti.
 * Ağır kütüphaneler yalnızca kullanıcı bu bileşeni kullandığında dinamik
 * yüklenir (code-split). Model yüklenemezse (offline/CSP) zarif fallback.
 * İleride canlı kamera / video analizi için genişletilebilir.
 */
export function PoseDetector({ onKeypoints }: { onKeypoints?: (kp: Kp[]) => void }) {
  const [status, setStatus] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [metrics, setMetrics] = React.useState<Metric[]>([]);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const detectorRef = React.useRef<unknown>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function ensureDetector() {
    if (detectorRef.current) return detectorRef.current;
    setStatus("loading");
    const tf = await import("@tensorflow/tfjs-core");
    await import("@tensorflow/tfjs-backend-webgl");
    const pose = await import("@tensorflow-models/pose-detection");
    await tf.setBackend("webgl");
    await tf.ready();
    const detector = await pose.createDetector(pose.SupportedModels.MoveNet, {
      modelType: pose.movenet.modelType.SINGLEPOSE_LIGHTNING,
    });
    detectorRef.current = detector;
    return detector;
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const detector = (await ensureDetector()) as {
        estimatePoses: (img: HTMLImageElement) => Promise<{ keypoints: Kp[] }[]>;
      };
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const poses = await detector.estimatePoses(img);
      const canvas = canvasRef.current!;
      const maxW = 360;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);

      const kps = (poses[0]?.keypoints ?? []).map((k) => ({ ...k, x: k.x * scale, y: k.y * scale }));
      const byName = new Map(kps.map((k) => [k.name, k]));
      // İskelet
      ctx.strokeStyle = "rgba(190,255,80,0.9)"; ctx.lineWidth = 2;
      SKELETON.forEach(([a, b]) => {
        const ka = byName.get(a), kb = byName.get(b);
        if (ka && kb && (ka.score ?? 0) > 0.3 && (kb.score ?? 0) > 0.3) {
          ctx.beginPath(); ctx.moveTo(ka.x, ka.y); ctx.lineTo(kb.x, kb.y); ctx.stroke();
        }
      });
      kps.forEach((k) => { if ((k.score ?? 0) > 0.3) { ctx.fillStyle = "#ff6b5a"; ctx.beginPath(); ctx.arc(k.x, k.y, 3, 0, 7); ctx.fill(); } });

      setMetrics(computeMetrics(byName));
      setStatus("ready");
      onKeypoints?.(poses[0]?.keypoints ?? []);
    } catch (err) {
      setStatus("error");
      setError("Poz modeli yüklenemedi (çevrimdışı olabilirsiniz). Fotoğraf yükleme ile analiz yine de çalışır.");
      reportErrorSync(err, { where: "PoseDetector", severity: "warning" });
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="rounded-2xl border border-ink-border bg-ink-card p-5">
      <div className="flex items-center gap-2">
        <Camera size={18} className="text-brand" />
        <h3 className="text-sm font-semibold">Poz Tespiti (TensorFlow.js · MoveNet)</h3>
        <span className="ml-auto rounded-lg bg-ink-soft px-2 py-0.5 text-[11px] uppercase text-fg-muted">beta</span>
      </div>
      <p className="mt-1 text-xs text-fg-muted">
        Fotoğrafındaki eklem noktalarını çıkarır; simetri/eğim ölçümleri hesaplar. Model tarayıcıda çalışır,
        fotoğraf sunucuya gönderilmez. Canlı kamera/video için altyapı hazırdır.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
        <button onClick={() => fileRef.current?.click()} disabled={status === "loading"}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
          {status === "loading" ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {status === "loading" ? "Model yükleniyor…" : "Fotoğraf Seç / Kamera"}
        </button>
      </div>

      {error && <p className="mt-3 flex items-center gap-2 text-xs text-amber-400"><AlertTriangle size={14} /> {error}</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
        <canvas ref={canvasRef} className="max-w-full rounded-xl border border-ink-border" style={{ display: status === "ready" ? "block" : "none" }} />
        {metrics.length > 0 && (
          <div className="grid content-start gap-2">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between rounded-lg border border-ink-border px-3 py-1.5 text-sm">
                <span className="text-fg-muted">{m.label}</span><span className="font-medium">{m.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function angleDeg(dx: number, dy: number): number {
  return Math.round(Math.abs((Math.atan2(dy, dx) * 180) / Math.PI) * 10) / 10;
}
/**
 * Ölçümler omuz genişliğine bölünerek normalize edilir. Ham piksel değerleri
 * fotoğrafın çözünürlüğüne ve kişinin kameraya uzaklığına göre değiştiği için
 * iki farklı çekim arasında karşılaştırılamıyordu; oran cinsinden (%) değerler
 * karşılaştırılabilir ve zaman içinde takip edilebilir.
 */
function computeMetrics(m: Map<string | undefined, Kp>): Metric[] {
  const out: Metric[] = [];
  const ls = m.get("left_shoulder"), rs = m.get("right_shoulder");
  const lh = m.get("left_hip"), rh = m.get("right_hip");
  const le = m.get("left_ear"), nose = m.get("nose");

  // Referans uzunluk: omuzlar arası mesafe (yoksa kalçalar arası).
  const shoulderW = ls && rs ? Math.hypot(rs.x - ls.x, rs.y - ls.y) : 0;
  const hipW = lh && rh ? Math.hypot(rh.x - lh.x, rh.y - lh.y) : 0;
  const ref = shoulderW || hipW;
  const pct = (px: number) => (ref > 0 ? `%${Math.round((px / ref) * 100)}` : `${Math.round(px)} px`);

  if (ls && rs) out.push({ label: "Omuz eğimi", value: `${angleDeg(rs.x - ls.x, rs.y - ls.y)}°` });
  if (lh && rh) out.push({ label: "Kalça eğimi", value: `${angleDeg(rh.x - lh.x, rh.y - lh.y)}°` });
  if (ls && rs && lh && rh) {
    const shoulderMid = (ls.x + rs.x) / 2, hipMid = (lh.x + rh.x) / 2;
    out.push({ label: "Gövde kayması", value: pct(Math.abs(shoulderMid - hipMid)) });
  }
  if (le && (nose || ls)) {
    const anchor = ls ?? nose!;
    out.push({ label: "Baş öne kayma", value: pct(Math.abs(le.x - anchor.x)) });
  }
  return out;
}
