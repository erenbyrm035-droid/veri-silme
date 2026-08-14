import { describe, it, expect } from "vitest";
import { tiltDegrees, deriveFindings, THRESHOLDS, MIN_SCORE, type Kp } from "./from-keypoints";

// ============================================================================
// Postür bulguları (MoveNet noktalarından).
//
// Buradaki hata kullanıcıya OLMAYAN bir postür sorunu olduğunu söyler.
// Eşikler bilerek tutucu; testler hem eşik davranışını hem de "ölçemedim"
// durumunun sessizce "sorun yok"a dönüşmediğini koruyor.
// ============================================================================

const kp = (name: string, x: number, y: number, score = 0.9): Kp => ({ name, x, y, score });

describe("tiltDegrees", () => {
  it("yatay çizgide 0 derece", () => {
    expect(tiltDegrees(kp("a", 0, 0), kp("b", 100, 0))).toBe(0);
  });

  it("45 derecelik çizgiyi ölçer", () => {
    expect(tiltDegrees(kp("a", 0, 0), kp("b", 100, 100))).toBeCloseTo(45, 1);
  });

  it("eğimin yönü önemli değil — mutlak değer döner", () => {
    const asagi = tiltDegrees(kp("a", 0, 0), kp("b", 100, 20));
    const yukari = tiltDegrees(kp("a", 0, 0), kp("b", 100, -20));
    expect(asagi).toBeCloseTo(yukari!, 5);
  });

  // Çakışık noktalarda 0 dönmek "kusursuz simetri" demek olurdu ve bozuk
  // kareyi sağlıklı gösterirdi.
  it("çakışık noktalarda null döner, 0 değil", () => {
    expect(tiltDegrees(kp("a", 50, 50), kp("b", 50, 50))).toBeNull();
  });
});

describe("deriveFindings", () => {
  const omuzlar = (dy: number, score = 0.9): Kp[] => [
    kp("left_shoulder", 0, 0, score),
    kp("right_shoulder", 100, dy, score),
  ];

  it("düz omuzlarda bulgu üretmez", () => {
    expect(deriveFindings(omuzlar(0))).toHaveLength(0);
  });

  it("eşiğin altındaki eğimde bulgu üretmez", () => {
    // ~2.9° — eşik 5°
    expect(deriveFindings(omuzlar(5))).toHaveLength(0);
  });

  it("eşiği aşan eğimde omuz asimetrisi bildirir", () => {
    // ~16.7°
    const f = deriveFindings(omuzlar(30));
    expect(f.some((x) => x.problem === "shoulder_asymmetry")).toBe(true);
  });

  it("bulguda kullanıcıya gösterilecek ölçüm bulunur", () => {
    const f = deriveFindings(omuzlar(30));
    expect(f[0].measurement).toMatch(/°/);
  });

  // Düşük güvenli noktalar ölçüm sayılmaz — bozuk kareden bulgu üretilmemeli.
  it("güven skoru düşük noktaları yok sayar", () => {
    expect(deriveFindings(omuzlar(30, MIN_SCORE - 0.01))).toHaveLength(0);
  });

  it("nokta yoksa boş döner, çökmez", () => {
    expect(deriveFindings([])).toHaveLength(0);
  });

  it("isimsiz noktalar yok sayılır", () => {
    expect(deriveFindings([{ x: 0, y: 0, score: 0.9 }, { x: 100, y: 30, score: 0.9 }])).toHaveLength(0);
  });

  it("kalça asimetrisini ayrı bildirir", () => {
    const f = deriveFindings([kp("left_hip", 0, 0), kp("right_hip", 100, 30)]);
    expect(f.some((x) => x.problem === "hip_asymmetry")).toBe(true);
  });

  it("eşikler tutucu kalmalı (kazara gevşetilmesin)", () => {
    expect(THRESHOLDS.tiltDeg).toBeGreaterThanOrEqual(5);
    expect(THRESHOLDS.forwardHeadRatio).toBeGreaterThanOrEqual(0.2);
  });
});
