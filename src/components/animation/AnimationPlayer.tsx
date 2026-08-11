"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows, useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { Play, Pause, RotateCcw, Repeat, Loader2, Box } from "lucide-react";
import { PlaceholderCharacter, motionForKey } from "./PlaceholderCharacter";
import type { Animation, CameraPosition } from "@/lib/database.types";

const SPEEDS = [0.5, 1, 1.5] as const;

/**
 * Egzersiz 3D animasyon oynatıcısı.
 * animation.url varsa gerçek .glb yüklenir (GLBCharacter); yoksa placeholder
 * karakter prosedürel hareket oynatır. Kontroller her iki modda da çalışır.
 */
export default function AnimationPlayer({
  animation,
  animationKey,
  exerciseName,
}: {
  animation: Animation | null;
  animationKey: string;
  exerciseName: string;
}) {
  const cam: CameraPosition = animation?.camera_position ?? { x: 0, y: 1.4, z: 3.2 };
  const duration = animation?.duration_sec ?? 3;
  const url = animation?.url ?? null;
  const motion = motionForKey(animation?.animation_key ?? animationKey);

  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [loop, setLoop] = useState<boolean>(animation?.loop ?? true);
  const [restart, setRestart] = useState(0);

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-border bg-gradient-to-b from-ink-soft to-ink-card">
      {/* Sahne */}
      <div className="relative h-72 w-full sm:h-80">
        <span className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-medium text-fg-muted backdrop-blur">
          <Box size={12} /> 3D {url ? "Animasyon" : "Önizleme (placeholder)"}
        </span>
        <Canvas shadows camera={{ position: [cam.x, cam.y, cam.z], fov: 42 }} dpr={[1, 2]}>
          <color attach="background" args={["#0e0e11"]} />
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[3, 6, 4]}
            intensity={1.4}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <Suspense fallback={null}>
            {url ? (
              <GLBCharacter
                url={url}
                playing={playing}
                speed={speed}
                loop={loop}
                restartSignal={restart}
              />
            ) : (
              <PlaceholderCharacter
                motion={motion}
                playing={playing}
                speed={speed}
                loop={loop}
                duration={duration}
                restartSignal={restart}
                onEnded={() => setPlaying(false)}
              />
            )}
            <ContactShadows
              position={[0, 0, 0]}
              opacity={0.5}
              scale={6}
              blur={2.4}
              far={4}
            />
          </Suspense>
          <OrbitControls
            enablePan={false}
            minDistance={2}
            maxDistance={6}
            target={[0, 1, 0]}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 1.9}
          />
        </Canvas>
      </div>

      {/* Kontroller */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-border p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="grid h-9 w-9 place-items-center rounded-full bg-brand text-black transition-transform hover:scale-105"
            aria-label={playing ? "Duraklat" : "Oynat"}
          >
            {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>
          <button
            onClick={() => {
              setRestart((r) => r + 1);
              setPlaying(true);
            }}
            className="grid h-9 w-9 place-items-center rounded-full bg-ink-soft text-fg-muted transition-colors hover:text-fg"
            aria-label="Baştan başlat"
          >
            <RotateCcw size={15} />
          </button>
          <button
            onClick={() => setLoop((l) => !l)}
            className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${
              loop ? "bg-brand/15 text-brand" : "bg-ink-soft text-fg-muted"
            }`}
            aria-label="Döngü"
          >
            <Repeat size={15} />
          </button>
        </div>

        {/* Oynatma hızı */}
        <div className="flex items-center gap-1 rounded-full bg-ink-soft p-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                speed === s ? "bg-brand text-black" : "text-fg-muted hover:text-fg"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <p className="border-t border-ink-border px-3 py-2 text-[11px] text-fg-muted">
        {exerciseName} · {url ? "gerçek animasyon" : "placeholder animasyon"} · sürükleyerek döndür
      </p>
    </div>
  );
}

/**
 * Gerçek .glb karakter + animasyon (ActorCore / Mixamo çıktısı).
 * Dosya geldiğinde animation.url set edilir; bu bileşen otomatik devreye girer.
 */
function GLBCharacter({
  url,
  playing,
  speed,
  loop,
  restartSignal,
}: {
  url: string;
  playing: boolean;
  speed: number;
  loop: boolean;
  restartSignal: number;
}) {
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, scene);
  const action = names.length ? actions[names[0]] : null;

  useEffect(() => {
    if (action) action.reset().play();
  }, [action]);
  useEffect(() => {
    if (action) action.paused = !playing;
  }, [action, playing]);
  useEffect(() => {
    if (action) action.timeScale = speed;
  }, [action, speed]);
  useEffect(() => {
    if (!action) return;
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
  }, [action, loop]);
  useEffect(() => {
    if (action) action.reset().play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartSignal]);

  return <primitive object={scene} />;
}
