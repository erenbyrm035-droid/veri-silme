// ============================================================================
// Form analizi — egzersiz tanımları ve açı motoru.
//
// Saf fonksiyonlar: DOM yok, TensorFlow yok. Böylece hem canlı kamera
// döngüsünde hem de testlerde kullanılabilir.
//
// MoveNet 17 anahtar nokta üretir (COCO düzeni). Burada ilgilendiğimiz açılar
// ÜÇ NOKTALI: örn. diz açısı = kalça–diz–ayak bileği. Mevcut `angleDeg`
// (PoseDetector içinde) iki noktalı eğim hesaplıyordu; tekrar saymak için
// yetersizdi çünkü eklem bükülmesini ölçmüyordu.
// ============================================================================

export interface Keypoint {
  name?: string;
  x: number;
  y: number;
  score?: number;
}

export type KeypointMap = Map<string, Keypoint>;

/** Güven eşiği — altındaki noktalar "yok" sayılır. */
export const MIN_SCORE = 0.35;

export function toMap(keypoints: Keypoint[]): KeypointMap {
  const m = new Map<string, Keypoint>();
  for (const k of keypoints) {
    if (k.name && (k.score ?? 0) >= MIN_SCORE) m.set(k.name, k);
  }
  return m;
}

/**
 * Üç nokta arasındaki açı (b tepe noktası), derece cinsinden 0-180.
 * Örn. jointAngle(kalça, diz, ayakBileği) → diz bükülme açısı.
 *
 * Noktalar üst üste düşerse (MoveNet zaman zaman iki eklemi aynı koordinata
 * koyar) açı TANIMSIZDIR → `null`. Eskiden `0` dönüyordu; 0 geçerli bir
 * "tam bükülmüş" açı olduğu için bozuk kare hayalet tekrar saydırıyordu.
 */
export function jointAngle(a: Keypoint, b: Keypoint, c: Keypoint): number | null {
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const magA = Math.hypot(abx, aby);
  const magC = Math.hypot(cbx, cby);
  if (magA === 0 || magC === 0) return null;
  // Kayan nokta hatası acos'u NaN yapabilir → aralığa kıstır.
  const cos = Math.min(1, Math.max(-1, dot / (magA * magC)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * İki taraftan görünür olanın açısı.
 *
 * `mode`:
 *   "average" → simetrik hareketler (squat, şınav, press, curl). İki taraf
 *               birlikte çalışır; ortalama gürültüyü azaltır.
 *   "min"     → TEK TARAFLI hareketler (lunge). Ortalama almak burada YANLIŞ:
 *               lunge'da ön diz 90°'ye inerken arka diz 150°'de kalabilir;
 *               ortalama 120° olur ve eşiğin (105) altına hiç inmez, yani
 *               tekrar hiç sayılmaz. Çalışan tarafı en bükülmüş taraf temsil
 *               eder → minimum alınır.
 */
function bilateralAngle(
  m: KeypointMap, a: string, b: string, c: string, mode: "average" | "min" = "average"
): number | null {
  const vals: number[] = [];
  for (const side of ["left", "right"] as const) {
    const ka = m.get(`${side}_${a}`);
    const kb = m.get(`${side}_${b}`);
    const kc = m.get(`${side}_${c}`);
    if (ka && kb && kc) {
      const v = jointAngle(ka, kb, kc);
      if (v !== null) vals.push(v);
    }
  }
  if (vals.length === 0) return null;
  if (mode === "min") return Math.min(...vals);
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

export interface FormCheck {
  /** Kısa uyarı metni — kullanıcıya anlık gösterilir. */
  message: string;
  /** true dönerse uyarı gösterilir. */
  test: (m: KeypointMap) => boolean;
}

export interface ExerciseConfig {
  key: string;
  label: string;
  emoji: string;
  /** Hangi eklem açısı sayılıyor (bilgi amaçlı gösterilir). */
  jointLabel: string;
  /** Açıyı ölçen fonksiyon; nokta görünmüyorsa null. */
  angle: (m: KeypointMap) => number | null;
  /**
   * Faz eşikleri. Hareket `down` fazına inip `up` fazına döndüğünde 1 tekrar.
   * `downBelow`: bu açının ALTINA inince "aşağıda" sayılır.
   * `upAbove`:  bu açının ÜSTÜNE çıkınca "yukarıda" sayılır.
   * Aradaki boşluk histerezis — titreşimden kaynaklı sahte tekrarı engeller.
   */
  downBelow: number;
  upAbove: number;
  /** Derinlik yüzdesi hesabı için tam aralık. */
  range: [number, number];
  checks: FormCheck[];
  /** Kullanıcıya kamera yerleşimi ipucu. */
  hint: string;
}

const y = (k: Keypoint | undefined) => (k ? k.y : null);

/** Sırt düzlüğü: omuz–kalça–diz açısı. 160°+ düz kabul edilir. */
function backAngle(m: KeypointMap): number | null {
  return bilateralAngle(m, "shoulder", "hip", "knee");
}

export const FORM_EXERCISES: ExerciseConfig[] = [
  {
    key: "squat",
    label: "Squat",
    emoji: "🦵",
    jointLabel: "Diz açısı (kalça–diz–bilek)",
    angle: (m) => bilateralAngle(m, "hip", "knee", "ankle"),
    downBelow: 100,
    upAbove: 160,
    range: [70, 175],
    hint: "Kamerayı yandan, tüm vücudu görecek şekilde yerleştir.",
    checks: [
      {
        message: "Sırtını daha dik tut",
        test: (m) => {
          const a = backAngle(m);
          return a !== null && a < 60;
        },
      },
      {
        message: "Daha derine in",
        test: (m) => {
          const a = bilateralAngle(m, "hip", "knee", "ankle");
          return a !== null && a > 110 && a < 140;
        },
      },
    ],
  },
  {
    key: "pushup",
    label: "Şınav",
    emoji: "💪",
    jointLabel: "Dirsek açısı (omuz–dirsek–bilek)",
    angle: (m) => bilateralAngle(m, "shoulder", "elbow", "wrist"),
    downBelow: 95,
    upAbove: 155,
    range: [60, 175],
    hint: "Kamerayı yandan, yere yakın konumlandır.",
    checks: [
      {
        message: "Kalçanı düşürme — gövdeni düz tut",
        test: (m) => {
          const a = backAngle(m);
          return a !== null && a < 150;
        },
      },
    ],
  },
  {
    key: "lunge",
    label: "Lunge",
    emoji: "🚶",
    jointLabel: "Ön diz açısı",
    // Tek taraflı hareket: çalışan (öndeki) bacak en bükülmüş olandır.
    angle: (m) => bilateralAngle(m, "hip", "knee", "ankle", "min"),
    downBelow: 105,
    upAbove: 160,
    range: [75, 175],
    hint: "Kamerayı yandan yerleştir; iki bacak da görünsün.",
    checks: [
      {
        message: "Gövdeni dik tut",
        test: (m) => {
          const a = backAngle(m);
          return a !== null && a < 140;
        },
      },
    ],
  },
  {
    key: "shoulder_press",
    label: "Omuz Press",
    emoji: "🏋️",
    jointLabel: "Dirsek açısı",
    angle: (m) => bilateralAngle(m, "shoulder", "elbow", "wrist"),
    downBelow: 95,
    upAbove: 160,
    range: [60, 178],
    hint: "Kameraya karşı dur, kollar tam görünsün.",
    checks: [
      {
        message: "Belini kırma — karnını sık",
        test: (m) => {
          const a = backAngle(m);
          return a !== null && a < 150;
        },
      },
    ],
  },
  {
    key: "bicep_curl",
    label: "Biceps Curl",
    emoji: "💪",
    jointLabel: "Dirsek açısı",
    angle: (m) => bilateralAngle(m, "shoulder", "elbow", "wrist"),
    downBelow: 60,
    upAbove: 150,
    range: [30, 175],
    hint: "Kameraya yan dur; dirseğin görünür olsun.",
    checks: [
      {
        message: "Dirseğini sabit tut, gövdeni sallama",
        test: (m) => {
          const ls = m.get("left_shoulder") ?? m.get("right_shoulder");
          const lh = m.get("left_hip") ?? m.get("right_hip");
          const sy = y(ls), hy = y(lh);
          if (sy === null || hy === null) return false;
          // Omuz–kalça mesafesi ani daralıyorsa gövde sallanıyordur.
          return Math.abs(sy - hy) < 40;
        },
      },
    ],
  },
];

export const exerciseByKey = (k: string): ExerciseConfig =>
  FORM_EXERCISES.find((e) => e.key === k) ?? FORM_EXERCISES[0];

// ---------------------------------------------------------------------------
// Faz durum makinesi
// ---------------------------------------------------------------------------
export type Phase = "up" | "down" | "unknown";

export interface RepState {
  phase: Phase;
  reps: number;
  /** Son tamamlanan tekrarın en derin açısı (form kalitesi göstergesi). */
  lastDepth: number | null;
  /** Bu tekrar sırasında görülen en küçük açı. */
  minAngleThisRep: number;
}

export const initialRepState = (): RepState => ({
  phase: "unknown",
  reps: 0,
  lastDepth: null,
  minAngleThisRep: 180,
});

/**
 * Tek karelik açı okumasını duruma işler.
 *
 * Tekrar, `down` → `up` GEÇİŞİNDE sayılır (aşağı inişte değil). Sebebi:
 * kullanıcı yarı yolda durup vazgeçerse tekrar sayılmamalı; ancak yukarı
 * dönüş tamamlandığında hareket bitmiş sayılır.
 *
 * Saf fonksiyon — yeni durum döndürür, mutasyon yapmaz.
 */
/**
 * Fiziksel alt sınır. Diz ve dirsek bu hareketlerde 20°'nin altına İNEMEZ;
 * bu değerler ancak bozuk poz tahmininden gelir. Kaynakta (jointAngle) artık
 * `null` dönüyoruz, ama sayacın kendisi de saçma girdiyi reddetmeli —
 * tek bir bozuk kare sahte tekrar saydırmasın.
 */
const MIN_PLAUSIBLE_ANGLE = 20;

export function advanceRep(
  state: RepState, angle: number | null, cfg: ExerciseConfig
): RepState {
  if (angle === null || !Number.isFinite(angle)) return state;
  if (angle < MIN_PLAUSIBLE_ANGLE) return state;

  if (angle <= cfg.downBelow) {
    return {
      ...state,
      phase: "down",
      minAngleThisRep: Math.min(state.minAngleThisRep, angle),
    };
  }

  if (angle >= cfg.upAbove) {
    if (state.phase === "down") {
      return {
        phase: "up",
        reps: state.reps + 1,
        lastDepth: state.minAngleThisRep,
        minAngleThisRep: 180,
      };
    }
    return { ...state, phase: "up" };
  }

  // Ara bölge (histerezis) — faz değişmez, ama derinlik izlenmeye devam eder.
  return {
    ...state,
    minAngleThisRep: state.phase === "down" ? Math.min(state.minAngleThisRep, angle) : state.minAngleThisRep,
  };
}

/** Açının hareket aralığındaki konumu (0 = tam açık, 100 = tam bükülü). */
export function depthPercent(angle: number | null, cfg: ExerciseConfig): number {
  if (angle === null) return 0;
  const [min, max] = cfg.range;
  if (max <= min) return 0;
  const pct = ((max - angle) / (max - min)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** Aktif form uyarıları. */
export function activeWarnings(m: KeypointMap, cfg: ExerciseConfig): string[] {
  return cfg.checks.filter((c) => c.test(m)).map((c) => c.message);
}
