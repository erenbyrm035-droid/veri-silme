"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, CameraOff, Loader2, AlertTriangle, RotateCcw, Info, Volume2, VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { reportErrorSync } from "@/lib/observability/report";
import { useVoiceCoach, useWakeLock } from "@/lib/voice/useVoiceCoach";
import {
  FORM_EXERCISES, exerciseByKey, toMap, advanceRep, initialRepState,
  depthPercent, activeWarnings, MIN_SCORE,
  type Keypoint, type RepState,
} from "@/lib/form/exercises";

type Status = "idle" | "loading" | "running" | "error";

const SKELETON: [string, string][] = [
  ["left_shoulder", "right_shoulder"], ["left_shoulder", "left_hip"], ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"], ["left_hip", "left_knee"], ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"], ["right_knee", "right_ankle"], ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"], ["right_shoulder", "right_elbow"], ["right_elbow", "right_wrist"],
];

/**
 * Canlı form analizi — kamera + MoveNet + tekrar sayacı.
 *
 * TASARIM NOTLARI
 * - Görüntü CİHAZDAN ÇIKMIYOR. Model tarayıcıda çalışır, hiçbir kare sunucuya
 *   gönderilmez. (Kullanıcıya da açıkça yazıyoruz.)
 * - Ağır TF.js paketi yalnızca "Başlat"a basılınca dinamik yüklenir; sayfayı
 *   açan herkese ~2 MB indirtmemek için.
 * - rAF döngüsü yerine sabit aralıklı çalışır: MoveNet Lightning mobilde
 *   ~20-30 FPS verir, 60 FPS istemek sadece pili tüketirdi.
 */
export function FormAnalyzer({ isPremium }: { isPremium: boolean }) {
  const [status, setStatus] = React.useState<Status>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [exerciseKey, setExerciseKey] = React.useState(FORM_EXERCISES[0].key);
  const [rep, setRep] = React.useState<RepState>(initialRepState);
  const [angle, setAngle] = React.useState<number | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [visible, setVisible] = React.useState(true);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const detectorRef = React.useRef<unknown>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const loopRef = React.useRef<number | null>(null);
  const repRef = React.useRef<RepState>(initialRepState());
  const cfgRef = React.useRef(exerciseByKey(exerciseKey));

  const voice = useVoiceCoach({ premium: isPremium });
  useWakeLock(status === "running");

  cfgRef.current = exerciseByKey(exerciseKey);
  const cfg = cfgRef.current;

  // Sayfa kapanırken kamerayı MUTLAKA bırak — aksi halde kamera ışığı yanık kalır.
  React.useEffect(() => () => teardown(), []);

  function teardown() {
    if (loopRef.current !== null) {
      window.clearInterval(loopRef.current);
      loopRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function start() {
    setError(null);
    setStatus("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      if (!detectorRef.current) {
        const tf = await import("@tensorflow/tfjs-core");
        await import("@tensorflow/tfjs-backend-webgl");
        const pose = await import("@tensorflow-models/pose-detection");
        await tf.setBackend("webgl");
        await tf.ready();
        detectorRef.current = await pose.createDetector(pose.SupportedModels.MoveNet, {
          modelType: pose.movenet.modelType.SINGLEPOSE_LIGHTNING,
        });
      }

      repRef.current = initialRepState();
      setRep(repRef.current);
      setStatus("running");
      voice.speak(`${cfgRef.current.label} analizi başladı.`);

      // ~15 kare/sn — MoveNet Lightning için yeterli, pil dostu.
      loopRef.current = window.setInterval(tick, 66);
    } catch (err) {
      teardown();
      setStatus("error");
      const name = (err as { name?: string })?.name;
      setError(
        name === "NotAllowedError"
          ? "Kamera izni verilmedi. Tarayıcı ayarlarından izin verip tekrar dene."
          : name === "NotFoundError"
            ? "Kamera bulunamadı."
            : "Model veya kamera başlatılamadı. Bağlantını kontrol et."
      );
      reportErrorSync(err, { where: "FormAnalyzer/start", severity: "warning" });
    }
  }

  function stop() {
    teardown();
    setStatus("idle");
    setAngle(null);
    setWarnings([]);
    voice.stop();
  }

  async function tick() {
    const detector = detectorRef.current as {
      estimatePoses: (v: HTMLVideoElement) => Promise<{ keypoints: Keypoint[] }[]>;
    } | null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!detector || !video || !canvas || video.readyState < 2) return;

    try {
      const poses = await detector.estimatePoses(video);
      const kps = poses[0]?.keypoints ?? [];
      const m = toMap(kps);

      const conf = kps.filter((k) => (k.score ?? 0) >= MIN_SCORE).length;
      setVisible(conf >= 8);

      const cur = cfgRef.current;
      const a = cur.angle(m);
      setAngle(a === null ? null : Math.round(a));

      const before = repRef.current.reps;
      repRef.current = advanceRep(repRef.current, a, cur);
      if (repRef.current.reps !== before) {
        voice.speak(String(repRef.current.reps), { interrupt: true });
      }
      setRep(repRef.current);
      setWarnings(activeWarnings(m, cur));

      draw(canvas, video, kps);
    } catch (err) {
      reportErrorSync(err, { where: "FormAnalyzer/tick", severity: "warning" });
    }
  }

  function draw(canvas: HTMLCanvasElement, video: HTMLVideoElement, kps: Keypoint[]) {
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    const byName = new Map(kps.map((k) => [k.name, k]));
    ctx.strokeStyle = "rgba(163,230,53,0.9)";
    ctx.lineWidth = 3;
    for (const [a, b] of SKELETON) {
      const ka = byName.get(a);
      const kb = byName.get(b);
      if (ka && kb && (ka.score ?? 0) > MIN_SCORE && (kb.score ?? 0) > MIN_SCORE) {
        ctx.beginPath();
        ctx.moveTo(ka.x, ka.y);
        ctx.lineTo(kb.x, kb.y);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "#ff6b5a";
    for (const k of kps) {
      if ((k.score ?? 0) > MIN_SCORE) {
        ctx.beginPath();
        ctx.arc(k.x, k.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function reset() {
    repRef.current = initialRepState();
    setRep(repRef.current);
  }

  function changeExercise(key: string) {
    setExerciseKey(key);
    repRef.current = initialRepState();
    setRep(repRef.current);
  }

  const depth = depthPercent(angle, cfg);
  const running = status === "running";

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-ink-border bg-ink-card p-4">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-brand" />
          <h3 className="text-sm font-semibold">Canlı Form Analizi</h3>
          <span className="ml-auto rounded-lg bg-ink-soft px-2 py-0.5 text-[10px] uppercase text-fg-muted">
            beta
          </span>
        </div>
        <p className="mt-1 flex items-start gap-1.5 text-xs text-fg-muted">
          <Info size={13} className="mt-0.5 shrink-0" />
          Görüntü cihazından çıkmaz — model tarayıcıda çalışır, hiçbir kare
          sunucuya gönderilmez.
        </p>

        {/* Egzersiz seçimi */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {FORM_EXERCISES.map((e) => (
            <button
              key={e.key}
              onClick={() => changeExercise(e.key)}
              aria-pressed={e.key === exerciseKey}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
                e.key === exerciseKey
                  ? "border-brand/50 bg-brand/15 text-brand"
                  : "border-ink-border bg-ink-soft text-fg-muted hover:border-brand/40"
              )}
            >
              {e.emoji} {e.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-fg-muted">{cfg.hint}</p>
      </div>

      {/* Kamera + iskelet */}
      <div className="relative overflow-hidden rounded-2xl border border-ink-border bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn("w-full", !running && "opacity-0")}
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ transform: "scaleX(-1)" }}
        />

        {!running && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <div>
              {status === "loading" ? (
                <>
                  <Loader2 size={28} className="mx-auto mb-2 animate-spin text-brand" />
                  <p className="text-sm font-semibold text-white">Model yükleniyor…</p>
                  <p className="mt-1 text-xs text-white/60">İlk açılışta birkaç saniye sürer.</p>
                </>
              ) : (
                <>
                  <CameraOff size={28} className="mx-auto mb-2 text-white/40" />
                  <p className="text-sm font-semibold text-white">Kamera kapalı</p>
                  <p className="mt-1 text-xs text-white/60">{cfg.hint}</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tekrar sayacı */}
        {running && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-2xl bg-black/55 px-3.5 py-2 backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">Tekrar</p>
            <motion.p
              key={rep.reps}
              initial={{ scale: 1.35, color: "#A3E635" }}
              animate={{ scale: 1, color: "#ffffff" }}
              transition={{ duration: 0.35 }}
              className="text-3xl font-black leading-none tabular-nums"
            >
              {rep.reps}
            </motion.p>
          </div>
        )}

        {/* Açı + derinlik */}
        {running && (
          <div className="pointer-events-none absolute right-3 top-3 rounded-2xl bg-black/55 px-3 py-2 text-right backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">Açı</p>
            <p className="text-lg font-black leading-none tabular-nums text-white">
              {angle === null ? "—" : `${angle}°`}
            </p>
            <div className="mt-1.5 h-1.5 w-16 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-100"
                style={{ width: `${depth}%` }}
              />
            </div>
          </div>
        )}

        {/* Görünürlük uyarısı */}
        {running && !visible && (
          <div className="absolute inset-x-3 bottom-3 rounded-xl bg-amber-500/90 px-3 py-2 text-center text-xs font-bold text-black">
            Tüm vücudun kadraja girsin — geriye çekil
          </div>
        )}

        {/* Form uyarıları */}
        <AnimatePresence>
          {running && visible && warnings.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute inset-x-3 bottom-3 space-y-1"
            >
              {warnings.map((w) => (
                <p
                  key={w}
                  className="rounded-xl bg-coral/90 px-3 py-2 text-center text-xs font-bold text-white"
                >
                  {w}
                </p>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <AlertTriangle size={14} className="shrink-0" /> {error}
        </p>
      )}

      {/* Kontroller */}
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <button onClick={stop} className="flex items-center gap-2 rounded-xl border border-coral/40 bg-coral/10 px-4 py-2.5 text-sm font-semibold text-coral">
            <CameraOff size={16} /> Durdur
          </button>
        ) : (
          <button onClick={start} disabled={status === "loading"} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {status === "loading" ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            {status === "loading" ? "Hazırlanıyor…" : "Kamerayı Başlat"}
          </button>
        )}

        <button
          onClick={reset}
          className="flex items-center gap-1.5 rounded-xl border border-ink-border bg-ink-soft px-3.5 py-2.5 text-sm font-semibold text-fg-muted hover:text-fg"
        >
          <RotateCcw size={15} /> Sayacı sıfırla
        </button>

        <button
          onClick={voice.toggle}
          aria-pressed={voice.enabled}
          className={cn(
            "flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors",
            voice.enabled
              ? "border-brand/40 bg-brand/10 text-brand"
              : "border-ink-border bg-ink-soft text-fg-muted hover:text-fg"
          )}
        >
          {voice.enabled ? <Volume2 size={15} /> : <VolumeX size={15} />} Sesli sayım
        </button>
      </div>

      {/* Son tekrar özeti */}
      {rep.lastDepth !== null && (
        <div className="flex items-center justify-between rounded-xl border border-ink-border bg-ink-card px-3.5 py-2.5 text-xs">
          <span className="text-fg-muted">Son tekrarın en derin açısı</span>
          <span className="font-bold tabular-nums">{Math.round(rep.lastDepth)}°</span>
        </div>
      )}
    </div>
  );
}
