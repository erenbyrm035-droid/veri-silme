// ============================================================================
// Poz noktalarından NESNEL postür bulgusu türetme.
//
// PoseDetector (MoveNet) eklem noktalarını çıkarıyordu ama sonuç hiçbir yere
// gitmiyordu: ölçüm ekranda gösterilip atılıyordu. Bu modül noktaları
// `PostureProblem` anahtarlarına çevirir; böylece ölçüm, kullanıcının
// öz-değerlendirmesiyle birlikte analize girer ve kayda geçer.
//
// Saf fonksiyon — DOM/model bağımlılığı yok, test edilebilir.
// ============================================================================

import type { PostureProblem } from "@/lib/database.types";

export interface Kp { name?: string; x: number; y: number; score?: number }

/** Bu eşiğin altındaki noktalar güvenilmez sayılır (MoveNet skorları). */
export const MIN_SCORE = 0.35;

/**
 * Eşikler. Kasıtlı olarak TUTUCU: yanlış pozitif, kullanıcıya olmayan bir
 * postür sorunu olduğunu söylemek demektir. Şüphede kalınca bulgu üretme.
 */
export const THRESHOLDS = {
  /** Omuz/kalça çizgisinin yataya göre eğimi (derece). */
  tiltDeg: 5,
  /** Kulak–omuz yatay mesafesi, omuz genişliğine oran. */
  forwardHeadRatio: 0.22,
};

function get(m: Map<string, Kp>, name: string): Kp | undefined {
  const k = m.get(name);
  return k && (k.score ?? 0) >= MIN_SCORE ? k : undefined;
}

/** İki nokta arasındaki çizginin YATAYA göre eğimi (0-90°). */
export function tiltDegrees(a: Kp, b: Kp): number | null {
  const dx = Math.abs(b.x - a.x);
  const dy = b.y - a.y;
  // Noktalar üst üsteyse eğim tanımsız — 0 döndürmek "kusursuz simetri"
  // demek olurdu ve bozuk kareyi sağlıklı gösterirdi.
  if (dx === 0 && dy === 0) return null;
  return Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
}

export interface DerivedFinding {
  problem: PostureProblem;
  /** Kullanıcıya gösterilecek ölçüm ("7.4° eğim" gibi). */
  measurement: string;
}

/**
 * Noktalardan bulgu çıkarır. Ölçülemeyen şey için bulgu ÜRETİLMEZ —
 * boş dizi "sorun yok" değil, "ölçemedim" anlamına da gelebilir.
 */
export function deriveFindings(keypoints: Kp[]): DerivedFinding[] {
  const m = new Map<string, Kp>();
  for (const k of keypoints) if (k.name) m.set(k.name, k);

  const out: DerivedFinding[] = [];
  const ls = get(m, "left_shoulder"), rs = get(m, "right_shoulder");
  const lh = get(m, "left_hip"), rh = get(m, "right_hip");

  if (ls && rs) {
    const t = tiltDegrees(ls, rs);
    if (t !== null && t > THRESHOLDS.tiltDeg) {
      out.push({ problem: "shoulder_asymmetry", measurement: `${t.toFixed(1)}° omuz eğimi` });
    }
  }

  if (lh && rh) {
    const t = tiltDegrees(lh, rh);
    if (t !== null && t > THRESHOLDS.tiltDeg) {
      out.push({ problem: "hip_asymmetry", measurement: `${t.toFixed(1)}° kalça eğimi` });
    }
  }

  // Baş öne kayma: kulak, omuzun önünde. Omuz genişliğine göre normalize
  // edilir — ham piksel, çözünürlüğe ve kameraya uzaklığa göre değişir.
  const shoulderW = ls && rs ? Math.hypot(rs.x - ls.x, rs.y - ls.y) : 0;
  if (shoulderW > 0) {
    for (const side of ["left", "right"] as const) {
      const ear = get(m, `${side}_ear`);
      const sh = get(m, `${side}_shoulder`);
      if (!ear || !sh) continue;
      const ratio = Math.abs(ear.x - sh.x) / shoulderW;
      if (ratio > THRESHOLDS.forwardHeadRatio) {
        out.push({
          problem: "forward_head",
          measurement: `omuz genişliğinin %${Math.round(ratio * 100)}'i kadar öne kayma`,
        });
        break; // tek bulgu yeter
      }
    }
  }

  return out;
}
