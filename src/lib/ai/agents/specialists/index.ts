import type { SpecialistKey } from "../types";
import type { SpecialistDefinition } from "./kit";

import { fitnessAgent } from "./fitness";
import { nutritionAgent } from "./nutrition";
import { physioAgent } from "./physio";
import { recoveryAgent } from "./recovery";
import { mentalAgent } from "./mental";
import { gamificationAgent } from "./gamification";
import { socialAgent } from "./social";
import { medicalAgent } from "./medical";

// ============================================================================
// UZMAN KAYIT DEFTERİ
//
// YENİ AJAN EKLEMEK İÇİN TEK YAPILACAK:
//   1. Bu klasöre `yeni-ajan.ts` ekle (kit.ts'teki SpecialistDefinition'ı uygula)
//   2. Yukarıya import et, aşağıdaki diziye ekle
//   3. types.ts'teki AgentKey birleşimine anahtarı ekle
//
// Yönlendirici, çalıştırıcı, telemetri ve admin paneli bu diziyi okur —
// başka hiçbir dosyaya dokunmak gerekmez.
//
// SIRALAMA ÖNEMLİ DEĞİL: seçim skora göre yapılır, dizi sırasına göre değil.
// ============================================================================

export const SPECIALISTS: SpecialistDefinition[] = [
  fitnessAgent,
  nutritionAgent,
  physioAgent,
  recoveryAgent,
  mentalAgent,
  gamificationAgent,
  socialAgent,
  medicalAgent,
];

export const SPECIALIST_MAP: Record<string, SpecialistDefinition> =
  Object.fromEntries(SPECIALISTS.map((s) => [s.key, s]));

export function getSpecialist(key: string): SpecialistDefinition | null {
  return SPECIALIST_MAP[key] ?? null;
}

/**
 * Tıbbi güvenlik ajanı diğerlerinden ayrı tutulur.
 *
 * Diğerleri "bulgu" üretip birleştiriciye gider; bu ajan nihai cevabı
 * DENETLER. Yönlendirmede normal uzman gibi seçilmemeli, yoksa kullanıcıya
 * ikinci bir görüş bölümü olarak sızar.
 */
export const ROUTABLE_SPECIALISTS: SpecialistDefinition[] =
  SPECIALISTS.filter((s) => s.key !== "medical");

export const SPECIALIST_KEYS: SpecialistKey[] = SPECIALISTS.map((s) => s.key);

export type { SpecialistDefinition };
export { medicalAgent };
