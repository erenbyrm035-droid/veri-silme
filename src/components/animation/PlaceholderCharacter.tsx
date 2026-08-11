"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type MotionType =
  | "press"
  | "pull"
  | "squat"
  | "hinge"
  | "curl"
  | "core"
  | "calf"
  | "idle";

/** animation_key → prosedürel hareket tipi (placeholder). */
export function motionForKey(key: string): MotionType {
  if (key.startsWith("bench_press") || key === "push_up" || key === "shoulder_press") return "press";
  if (key === "row" || key === "lat_pulldown" || key === "pull_up") return "pull";
  if (key === "squat" || key === "leg_press" || key === "lunge") return "squat";
  if (key === "deadlift" || key === "hip_thrust") return "hinge";
  if (key === "biceps_curl" || key === "triceps_extension" || key === "lateral_raise") return "curl";
  if (key === "plank" || key === "crunch") return "core";
  if (key === "calf_raise") return "calf";
  return "idle";
}

const SKIN = "#c8d24a";
const DARK = "#3a3f12";

/**
 * Primitif geometrilerden yapılmış placeholder insansı figür.
 * Gerçek .glb karakter geldiğinde bu bileşen GLBCharacter ile değiştirilir.
 * Hareket, motionType + oynatma durumuna göre prosedürel üretilir.
 */
export function PlaceholderCharacter({
  motion,
  playing,
  speed,
  loop,
  duration,
  restartSignal,
  onEnded,
}: {
  motion: MotionType;
  playing: boolean;
  speed: number;
  loop: boolean;
  duration: number;
  restartSignal: number;
  onEnded?: () => void;
}) {
  // Kontrol değerlerini ref'te tut (useFrame en güncel değeri okur).
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const loopRef = useRef(loop);
  loopRef.current = loop;

  const phase = useRef(0);
  const endedFired = useRef(false);
  const lastRestart = useRef(restartSignal);
  if (lastRestart.current !== restartSignal) {
    lastRestart.current = restartSignal;
    phase.current = 0;
    endedFired.current = false;
  }

  // Eklem grupları
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const lArm = useRef<THREE.Group>(null);
  const rArm = useRef<THREE.Group>(null);
  const lForearm = useRef<THREE.Group>(null);
  const rForearm = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const lLeg = useRef<THREE.Group>(null);
  const rLeg = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (playingRef.current) {
      phase.current += (delta * speedRef.current) / Math.max(0.5, duration);
      if (phase.current >= 1) {
        if (loopRef.current) {
          phase.current -= 1;
        } else {
          phase.current = 1;
          if (!endedFired.current) {
            endedFired.current = true;
            onEnded?.();
          }
        }
      } else {
        endedFired.current = false;
      }
    }
    // 0..1..0 üçgen dalga (tek tekrar)
    const p = phase.current;
    const rep = 1 - Math.abs(1 - 2 * p); // 0→1→0
    const eased = 0.5 - 0.5 * Math.cos(rep * Math.PI); // yumuşat
    apply(motion, eased, {
      root: root.current,
      torso: torso.current,
      lArm: lArm.current,
      rArm: rArm.current,
      lForearm: lForearm.current,
      rForearm: rForearm.current,
      hips: hips.current,
      lLeg: lLeg.current,
      rLeg: rLeg.current,
    });
  });

  return (
    <group ref={root} position={[0, 0, 0]}>
      {/* Kalça / gövde */}
      <group ref={hips} position={[0, 1, 0]}>
        <group ref={torso} position={[0, 0, 0]}>
          {/* Gövde */}
          <mesh position={[0, 0.35, 0]} castShadow>
            <capsuleGeometry args={[0.22, 0.5, 6, 12]} />
            <meshStandardMaterial color={SKIN} />
          </mesh>
          {/* Baş */}
          <mesh position={[0, 0.95, 0]} castShadow>
            <sphereGeometry args={[0.18, 24, 24]} />
            <meshStandardMaterial color={SKIN} />
          </mesh>
          {/* Sol kol (omuz pivot) */}
          <group ref={lArm} position={[-0.28, 0.6, 0]}>
            <mesh position={[0, -0.22, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.3, 4, 8]} />
              <meshStandardMaterial color={DARK} />
            </mesh>
            <group ref={lForearm} position={[0, -0.42, 0]}>
              <mesh position={[0, -0.2, 0]} castShadow>
                <capsuleGeometry args={[0.06, 0.28, 4, 8]} />
                <meshStandardMaterial color={SKIN} />
              </mesh>
            </group>
          </group>
          {/* Sağ kol */}
          <group ref={rArm} position={[0.28, 0.6, 0]}>
            <mesh position={[0, -0.22, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.3, 4, 8]} />
              <meshStandardMaterial color={DARK} />
            </mesh>
            <group ref={rForearm} position={[0, -0.42, 0]}>
              <mesh position={[0, -0.2, 0]} castShadow>
                <capsuleGeometry args={[0.06, 0.28, 4, 8]} />
                <meshStandardMaterial color={SKIN} />
              </mesh>
            </group>
          </group>
        </group>
        {/* Sol bacak (kalça pivot) */}
        <group ref={lLeg} position={[-0.12, 0, 0]}>
          <mesh position={[0, -0.45, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.7, 4, 8]} />
            <meshStandardMaterial color={DARK} />
          </mesh>
        </group>
        {/* Sağ bacak */}
        <group ref={rLeg} position={[0.12, 0, 0]}>
          <mesh position={[0, -0.45, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.7, 4, 8]} />
            <meshStandardMaterial color={DARK} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

type Joints = {
  root: THREE.Group | null;
  torso: THREE.Group | null;
  lArm: THREE.Group | null;
  rArm: THREE.Group | null;
  lForearm: THREE.Group | null;
  rForearm: THREE.Group | null;
  hips: THREE.Group | null;
  lLeg: THREE.Group | null;
  rLeg: THREE.Group | null;
};

/** motionType + faz(0..1) → eklem rotasyonları. */
function apply(motion: MotionType, t: number, j: Joints) {
  // Nötrle
  reset(j);
  switch (motion) {
    case "press":
      // Kollar öne/yukarı iter
      set(j.lArm, -Math.PI / 2 + t * 0.9, 0, 0);
      set(j.rArm, -Math.PI / 2 + t * 0.9, 0, 0);
      set(j.lForearm, -t * 0.5, 0, 0);
      set(j.rForearm, -t * 0.5, 0, 0);
      break;
    case "pull":
      set(j.lArm, -Math.PI / 2.4 - t * 0.6, 0, 0.2);
      set(j.rArm, -Math.PI / 2.4 - t * 0.6, 0, -0.2);
      set(j.lForearm, -t * 1.2, 0, 0);
      set(j.rForearm, -t * 1.2, 0, 0);
      break;
    case "squat":
      if (j.hips) j.hips.position.y = 1 - t * 0.35;
      set(j.lLeg, t * 0.5, 0, 0.05);
      set(j.rLeg, t * 0.5, 0, -0.05);
      if (j.torso) j.torso.rotation.x = t * 0.15;
      set(j.lArm, -t * 0.6, 0, 0);
      set(j.rArm, -t * 0.6, 0, 0);
      break;
    case "hinge":
      if (j.torso) j.torso.rotation.x = t * 0.9;
      set(j.lArm, t * 0.9, 0, 0);
      set(j.rArm, t * 0.9, 0, 0);
      break;
    case "curl":
      set(j.lForearm, -t * 1.6, 0, 0);
      set(j.rForearm, -t * 1.6, 0, 0);
      break;
    case "core":
      if (j.torso) j.torso.rotation.x = t * 0.5;
      break;
    case "calf":
      if (j.hips) j.hips.position.y = 1 + t * 0.12;
      break;
    default:
      // idle: hafif nefes
      if (j.hips) j.hips.position.y = 1 + Math.sin(t * Math.PI) * 0.03;
      set(j.lArm, 0.05, 0, 0.05);
      set(j.rArm, 0.05, 0, -0.05);
  }
}

function set(g: THREE.Group | null, x: number, y: number, z: number) {
  if (g) g.rotation.set(x, y, z);
}
function reset(j: Joints) {
  set(j.lArm, 0, 0, 0.08);
  set(j.rArm, 0, 0, -0.08);
  set(j.lForearm, 0, 0, 0);
  set(j.rForearm, 0, 0, 0);
  set(j.lLeg, 0, 0, 0.03);
  set(j.rLeg, 0, 0, -0.03);
  if (j.torso) j.torso.rotation.set(0, 0, 0);
  if (j.hips) j.hips.position.y = 1;
}
