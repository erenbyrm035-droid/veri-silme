"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { STATE_COLOR, type RegionKey, type MuscleState } from "@/lib/anatomy3d/regions";
import { meshNameToRegion } from "@/lib/anatomy3d/model-config";

const SKIN = "#3a4150";

/**
 * Gerçek GLB anatomik modeli — her kas mesh'i adına göre bölgeye eşlenir,
 * duruma göre renklendirilir (animasyonlu), tıklamayla seçilir.
 * Yalnızca ANATOMY_MODEL_URL tanımlıysa kullanılır.
 */
export function GLBAnatomyModel({
  url,
  states,
  onSelect,
}: {
  url: string;
  states: Record<RegionKey, MuscleState>;
  onSelect?: (region: RegionKey) => void;
}) {
  const { scene } = useGLTF(url);
  // Sahneyi klonla (aynı model birden çok yerde kullanılabilsin).
  const model = useMemo(() => scene.clone(true), [scene]);

  // Mesh → bölge eşlemesi + her mesh'e kendi materyali.
  const tagged = useMemo(() => {
    const list: { mesh: THREE.Mesh; region: RegionKey | null; mat: THREE.MeshStandardMaterial }[] = [];
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        const region = meshNameToRegion(mesh.name);
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(SKIN), roughness: 0.5, metalness: 0.05 });
        mesh.material = mat;
        list.push({ mesh, region, mat });
      }
    });
    return list;
  }, [model]);

  const tmp = useRef(new THREE.Color());
  useFrame(() => {
    for (const { region, mat } of tagged) {
      const target = region ? STATE_COLOR[states[region] ?? "none"] : SKIN;
      tmp.current.set(target);
      mat.color.lerp(tmp.current, 0.12);
      const em = region && states[region] === "primary" ? 0.35 : 0;
      mat.emissive.setRGB(0.1 * em, 0.9 * em, 0.2 * em);
    }
  });

  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    const hit = tagged.find((t) => t.mesh === e.object);
    if (hit?.region && onSelect) onSelect(hit.region);
  }

  useEffect(() => () => tagged.forEach((t) => t.mat.dispose()), [tagged]);

  return <primitive object={model} onClick={handleClick} />;
}
