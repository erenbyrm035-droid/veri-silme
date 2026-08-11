"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STATE_COLOR, type RegionKey, type MuscleState } from "@/lib/anatomy3d/regions";

/**
 * Prosedürel erkek vücut modeli — kas bölgeleri renk kodlu mesh gruplarıdır.
 * Renk geçişleri her karede lerp ile yumuşatılır (animasyonlu).
 *
 * MİMARİ NOTU: Model bir "sağlayıcı"dır. İleride GLB tabanlı gerçek anatomik
 * model (erkek/kadın) veya iskelet sistemi bu arayüzü (states: bölge→durum)
 * uygulayan yeni bir bileşenle değiştirilebilir; Viewer ve tüm entegrasyonlar
 * (egzersiz/AI/postür/program) aynı kalır.
 */

type Geo = "sphere" | "capsule" | "box";
interface Part {
  region: RegionKey | "skin";
  geo: Geo;
  args: number[];
  pos: [number, number, number];
  rot?: [number, number, number];
}

const SKIN_DARK = "#3a4150";

// Simetrik parça üret (sol/sağ).
function pair(base: Omit<Part, "pos"> & { pos: [number, number, number] }): Part[] {
  const [x, y, z] = base.pos;
  return [
    { ...base, pos: [x, y, z] },
    { ...base, pos: [-x, y, z], rot: base.rot },
  ];
}

const PARTS: Part[] = [
  // Baş + boyun (deri)
  { region: "skin", geo: "sphere", args: [0.17], pos: [0, 0.86, 0] },
  { region: "neck", geo: "capsule", args: [0.07, 0.1], pos: [0, 0.66, 0] },
  // Gövde tabanı (deri) — şekil versin
  { region: "skin", geo: "capsule", args: [0.24, 0.5], pos: [0, 0.32, 0], rot: [0, 0, 0] },
  { region: "skin", geo: "sphere", args: [0.2], pos: [0, 0.02, 0] }, // kalça tabanı
  // Göğüs
  ...pair({ region: "chest", geo: "sphere", args: [0.1], pos: [0.11, 0.46, 0.14] }),
  // Karın
  { region: "abs", geo: "box", args: [0.2, 0.26, 0.08], pos: [0, 0.22, 0.16] },
  // Yan karın
  ...pair({ region: "obliques", geo: "capsule", args: [0.05, 0.18], pos: [0.17, 0.24, 0.06] }),
  // Trapez (arka üst)
  { region: "traps", geo: "box", args: [0.26, 0.14, 0.08], pos: [0, 0.52, -0.12] },
  // Sırt / kanat
  ...pair({ region: "lats", geo: "capsule", args: [0.07, 0.22], pos: [0.14, 0.34, -0.12] }),
  // Bel
  { region: "lowerback", geo: "box", args: [0.22, 0.16, 0.08], pos: [0, 0.14, -0.14] },
  // Omuz
  ...pair({ region: "shoulders", geo: "sphere", args: [0.11], pos: [0.26, 0.54, 0] }),
  // Biceps (ön üst kol)
  ...pair({ region: "biceps", geo: "capsule", args: [0.06, 0.2], pos: [0.31, 0.36, 0.05], rot: [0, 0, 0.12] }),
  // Triceps (arka üst kol)
  ...pair({ region: "triceps", geo: "capsule", args: [0.055, 0.2], pos: [0.32, 0.36, -0.07], rot: [0, 0, 0.12] }),
  // Ön kol
  ...pair({ region: "forearms", geo: "capsule", args: [0.05, 0.22], pos: [0.37, 0.06, 0.02], rot: [0, 0, 0.08] }),
  // Kalça (arka)
  ...pair({ region: "glutes", geo: "sphere", args: [0.11], pos: [0.1, -0.04, -0.1] }),
  // Ön bacak (quadriceps)
  ...pair({ region: "quads", geo: "capsule", args: [0.09, 0.28], pos: [0.11, -0.32, 0.06] }),
  // Arka bacak (hamstring)
  ...pair({ region: "hamstrings", geo: "capsule", args: [0.085, 0.28], pos: [0.11, -0.32, -0.08] }),
  // Baldır
  ...pair({ region: "calves", geo: "capsule", args: [0.07, 0.24], pos: [0.11, -0.74, -0.03] }),
];

function makeGeometry(part: Part): THREE.BufferGeometry {
  switch (part.geo) {
    case "sphere":
      return new THREE.SphereGeometry(part.args[0], 20, 16);
    case "capsule":
      return new THREE.CapsuleGeometry(part.args[0], part.args[1], 6, 14);
    case "box":
      return new THREE.BoxGeometry(part.args[0], part.args[1], part.args[2] ?? 0.1, 2, 2, 2);
  }
}

export function HumanModel({ states }: { states: Record<RegionKey, MuscleState> }) {
  const group = useRef<THREE.Group>(null);
  // Her parça için geometri + materyal + hedef renk (bir kez oluşturulur).
  const parts = useMemo(
    () =>
      PARTS.map((p) => {
        const geometry = makeGeometry(p);
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(SKIN_DARK),
          roughness: 0.55,
          metalness: 0.05,
        });
        return { p, geometry, material };
      }),
    []
  );

  // Renkleri her karede hedefe doğru yumuşat (animasyonlu geçiş).
  const tmp = useRef(new THREE.Color());
  useFrame(() => {
    for (const { p, material } of parts) {
      const target =
        p.region === "skin" ? SKIN_DARK : STATE_COLOR[states[p.region as RegionKey] ?? "none"];
      tmp.current.set(target);
      material.color.lerp(tmp.current, 0.12);
      const em = p.region !== "skin" && states[p.region as RegionKey] === "primary" ? 0.25 : 0;
      material.emissive.setRGB(0, em * 0.5, 0);
    }
  });

  return (
    <group ref={group} position={[0, -0.05, 0]}>
      {parts.map(({ p, geometry, material }, i) => (
        <mesh key={i} geometry={geometry} material={material} position={p.pos} rotation={p.rot ?? [0, 0, 0]} castShadow />
      ))}
    </group>
  );
}
