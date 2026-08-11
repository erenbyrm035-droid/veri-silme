// Viva — Anatomi GLB üreteci.
// three.js geometrisinden, her kas AYRI ADLANDIRILMIŞ mesh olan gerçek bir .glb
// dosyası üretir → public/models/anatomy-male.glb.
// GLBAnatomyModel bu mesh adlarını (chest, biceps, quads…) bölgelere eşler.
//
// NOT: Bu prosedürel bir modeldir (foto-gerçekçi anatomik sculpt DEĞİL). Amacı
// gerçek 3B GLB hattını uçtan uca çalıştırmaktır. Foto-gerçekçi için Z-Anatomy
// (CC-BY-SA) modelini Blender'da .glb export edip aynı yola koyman yeterli.
import * as THREE from "three";
import { Document, NodeIO } from "@gltf-transform/core";
import { mkdirSync } from "node:fs";

// [region, geo, args, [x,y,z], [rx,ry,rz]?]
const P = (region, geo, args, pos, rot) => ({ region, geo, args, pos, rot });
const pair = (region, geo, args, pos, rot) => [P(region, geo, args, pos, rot), P(region, geo, args, [-pos[0], pos[1], pos[2]], rot)];

const PARTS = [
  P("skin", "sphere", [0.17], [0, 0.86, 0]),
  P("neck", "capsule", [0.07, 0.1], [0, 0.66, 0]),
  P("skin", "capsule", [0.24, 0.5], [0, 0.32, 0]),
  P("skin", "sphere", [0.2], [0, 0.02, 0]),
  ...pair("chest", "sphere", [0.1], [0.11, 0.46, 0.14]),
  P("abs", "box", [0.2, 0.26, 0.08], [0, 0.22, 0.16]),
  ...pair("obliques", "capsule", [0.05, 0.18], [0.17, 0.24, 0.06]),
  P("traps", "box", [0.26, 0.14, 0.08], [0, 0.52, -0.12]),
  ...pair("lats", "capsule", [0.07, 0.22], [0.14, 0.34, -0.12]),
  P("lowerback", "box", [0.22, 0.16, 0.08], [0, 0.14, -0.14]),
  ...pair("shoulders", "sphere", [0.11], [0.26, 0.54, 0]),
  ...pair("biceps", "capsule", [0.06, 0.2], [0.31, 0.36, 0.05], [0, 0, 0.12]),
  ...pair("triceps", "capsule", [0.055, 0.2], [0.32, 0.36, -0.07], [0, 0, 0.12]),
  ...pair("forearms", "capsule", [0.05, 0.22], [0.37, 0.06, 0.02], [0, 0, 0.08]),
  ...pair("glutes", "sphere", [0.11], [0.1, -0.04, -0.1]),
  ...pair("quads", "capsule", [0.09, 0.28], [0.11, -0.32, 0.06]),
  ...pair("hamstrings", "capsule", [0.085, 0.28], [0.11, -0.32, -0.08]),
  ...pair("calves", "capsule", [0.07, 0.24], [0.11, -0.74, -0.03]),
];

function makeGeom(p) {
  let g;
  if (p.geo === "sphere") g = new THREE.SphereGeometry(p.args[0], 24, 18);
  else if (p.geo === "capsule") g = new THREE.CapsuleGeometry(p.args[0], p.args[1], 8, 18);
  else g = new THREE.BoxGeometry(p.args[0], p.args[1], p.args[2] ?? 0.1, 3, 3, 3);
  return g.toNonIndexed(); // basit, güvenli ihracat için indekssiz
}

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene("anatomy");
const counts = {};

for (const p of PARTS) {
  const g = makeGeom(p);
  const pos = g.attributes.position.array;
  const nor = g.attributes.normal.array;

  const posAcc = doc.createAccessor().setType("VEC3").setArray(new Float32Array(pos)).setBuffer(buffer);
  const norAcc = doc.createAccessor().setType("VEC3").setArray(new Float32Array(nor)).setBuffer(buffer);
  const prim = doc.createPrimitive().setAttribute("POSITION", posAcc).setAttribute("NORMAL", norAcc);

  const idx = (counts[p.region] = (counts[p.region] ?? 0) + 1);
  const name = idx === 1 ? p.region : `${p.region}_${idx}`;
  const mesh = doc.createMesh(name).addPrimitive(prim);

  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot ?? [0, 0, 0])));
  const node = doc.createNode(name)
    .setMesh(mesh)
    .setTranslation(p.pos)
    .setRotation([q.x, q.y, q.z, q.w]);
  scene.addChild(node);
}

mkdirSync("public/models", { recursive: true });
await new NodeIO().write("public/models/anatomy-male.glb", doc);
console.log(`OK → public/models/anatomy-male.glb (${PARTS.length} mesh)`);
