"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { HumanModel } from "./HumanModel";
import { GLBAnatomyModel } from "./GLBAnatomyModel";
import { STATE_COLOR, type RegionKey, type MuscleState } from "@/lib/anatomy3d/regions";
import { RotateCcw } from "lucide-react";

export type CameraView = "front" | "back" | "right" | "left" | "top" | "bottom";

const R = 3.1;
const VIEW_POS: Record<CameraView, [number, number, number]> = {
  front: [0, 0, R],
  back: [0, 0, -R],
  right: [R, 0, 0],
  left: [-R, 0, 0],
  top: [0, R, 0.001],
  bottom: [0, -R, 0.001],
};

const VIEW_LABEL: { view: CameraView; label: string }[] = [
  { view: "front", label: "Ön" },
  { view: "back", label: "Arka" },
  { view: "left", label: "Sol" },
  { view: "right", label: "Sağ" },
  { view: "top", label: "Üst" },
  { view: "bottom", label: "Alt" },
];

/** Kamera preset animasyonu — hedefe yumuşak lerp, sonra OrbitControls'e bırakır. */
function CameraRig({ target }: { target: [number, number, number] | null }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { update: () => void } | null;
  const dest = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (target) dest.current = new THREE.Vector3(...target);
  }, [target]);

  useFrame(() => {
    if (!dest.current) return;
    camera.position.lerp(dest.current, 0.15);
    camera.lookAt(0, 0, 0);
    controls?.update();
    if (camera.position.distanceTo(dest.current) < 0.02) dest.current = null;
  });
  return null;
}

export function AnatomyViewer({
  states,
  className,
  modelUrl,
  onSelect,
}: {
  states: Record<RegionKey, MuscleState>;
  className?: string;
  modelUrl?: string;
  onSelect?: (r: RegionKey) => void;
}) {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<CameraView>("front");
  const [nonce, setNonce] = useState(0);
  const [target, setTarget] = useState<[number, number, number] | null>(null);

  function goto(v: CameraView) {
    setView(v);
    setNonce((n) => n + 1);
    setTarget(VIEW_POS[v]);
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-ink-border bg-gradient-to-b from-ink-soft to-ink-card ${className ?? ""}`}>
      {/* Skeleton (yüklenene kadar) */}
      {!ready && (
        <div className="absolute inset-0 z-10 grid place-items-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-16 w-16 animate-pulse rounded-full bg-fg/10" />
            <div className="h-32 w-10 animate-pulse rounded-2xl bg-fg/10" />
            <div className="flex gap-2">
              <div className="h-20 w-6 animate-pulse rounded-full bg-fg/10" />
              <div className="h-20 w-6 animate-pulse rounded-full bg-fg/10" />
            </div>
          </div>
        </div>
      )}

      <div
        className="aspect-[4/5] w-full transition-opacity duration-700 sm:aspect-square"
        style={{ opacity: ready ? 1 : 0 }}
      >
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: VIEW_POS.front, fov: 38 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={() => setTimeout(() => setReady(true), 120)}
        >
          <color attach="background" args={["#0e1116"]} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[3, 5, 4]} intensity={1.1} castShadow />
          <directionalLight position={[-3, 2, -3]} intensity={0.4} />
          {modelUrl ? (
            <Suspense fallback={null}>
              <GLBAnatomyModel url={modelUrl} states={states} onSelect={onSelect} />
            </Suspense>
          ) : (
            <HumanModel states={states} />
          )}
          <OrbitControls
            makeDefault
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            minDistance={1.8}
            maxDistance={5}
            target={[0, 0, 0]}
          />
          <CameraRig target={target} key={nonce} />
        </Canvas>
      </div>

      {/* Kamera preset butonları */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-1.5 bg-gradient-to-t from-ink-card/95 to-transparent p-2.5">
        {VIEW_LABEL.map((v) => (
          <button
            key={v.view}
            onClick={() => goto(v.view)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              view === v.view ? "bg-brand text-black" : "bg-ink-soft/90 text-fg-muted hover:text-fg"
            }`}
          >
            {v.label}
          </button>
        ))}
        <button
          onClick={() => goto("front")}
          className="grid h-7 w-7 place-items-center rounded-lg bg-ink-soft/90 text-fg-muted hover:text-fg"
          aria-label="Sıfırla"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Renk efsanesi */}
      <div className="absolute right-2.5 top-2.5 flex flex-col gap-1 rounded-xl border border-ink-border bg-ink-card/85 p-2 text-[11px] backdrop-blur">
        <LegendDot color={STATE_COLOR.primary} label="Ana kas" />
        <LegendDot color={STATE_COLOR.secondary} label="Yardımcı" />
        <LegendDot color={STATE_COLOR.none} label="Pasif" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-fg-muted">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {label}
    </span>
  );
}
