// ============================================================================
// Çoklu ajan mimarisi — ORTAK TİPLER (sunucu + istemci).
//
// Bu dosyada `server-only` YOK. Admin paneli ve kullanıcı arayüzü ajan
// etiketlerini/renklerini buradan alır. Uzman modülleri (specialists/*) de
// buradan tip alır — böylece tek bir sözleşme var.
// ============================================================================

export type AgentKey =
  | "orchestrator"
  | "fitness"
  | "nutrition"
  | "physio"
  | "recovery"
  | "mental"
  | "gamification"
  | "social"
  | "medical"
  | "synthesizer";

/** Uzman ajanlar — yönlendirici ve birleştirici bunların dışında. */
export type SpecialistKey = Exclude<AgentKey, "orchestrator" | "synthesizer">;

/**
 * Hafıza katmanları.
 *
 * Her ajana tüm bağlamı vermek hem token israfı hem odak kaybı: beslenme
 * uzmanının takım savaşını bilmesine gerek yok, bilirse de cevabı dağılır.
 * Ajan başına katman seçimi bu yüzden var.
 */
export type MemoryLayer =
  | "session"    // bu konuşmanın son mesajları (kısa vadeli)
  | "longterm"   // ai_facts — kalıcı hafıza
  | "profile"    // yaş, boy, kilo, hedef, deneyim, premium
  | "health"     // sakatlık, sağlık durumu, alerji, toparlanma
  | "nutrition"  // bugünkü ve 7 günlük beslenme
  | "workout"    // son antrenmanlar + aylık özet
  | "goals"      // aktif hedefler ve ilerleme
  | "social";    // takım, arkadaşlar, challenge

export const MEMORY_LAYER_LABELS: Record<MemoryLayer, string> = {
  session: "Oturum",
  longterm: "Kalıcı hafıza",
  profile: "Profil",
  health: "Sağlık",
  nutrition: "Beslenme",
  workout: "Antrenman",
  goals: "Hedefler",
  social: "Sosyal",
};

export const ALL_MEMORY_LAYERS: MemoryLayer[] = [
  "session", "longterm", "profile", "health",
  "nutrition", "workout", "goals", "social",
];

/** Bir ajanın çalıştırılabilir yapılandırması (kod varsayılanı + DB geçersiz kılması). */
export interface AgentConfig {
  key: AgentKey;
  name: string;
  description: string;
  enabled: boolean;
  model: string | null;
  temperature: number;
  maxTokens: number;
  memoryLayers: MemoryLayer[];
  allowedTools: string[];
  memoryLimit: number;
  sortOrder: number;
  /** Aktif prompt (DB'de sürüm varsa oradan, yoksa koddaki varsayılan). */
  prompt: string;
  /** A/B varyantı — telemetriye yazılır. */
  variant: "a" | "b";
}

/** Yönlendiricinin bir ajanı neden seçtiği — telemetride saklanır. */
export type SelectionReason = "rules" | "llm" | "forced" | "always";

export interface AgentSelection {
  key: SpecialistKey;
  score: number;
  reason: SelectionReason;
}

/** Bir uzmanın ürettiği bulgu. Kullanıcıya DOĞRUDAN gösterilmez. */
export interface AgentFinding {
  key: SpecialistKey;
  name: string;
  content: string;
  ok: boolean;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  model: string;
  variant: "a" | "b";
  reason: SelectionReason;
  error?: string;
  /** Bu uzmanın çağırdığı araçlar — arayüzde rozet olarak gösterilir. */
  toolsUsed: { name: string; ok: boolean; summary: string | null }[];
  /** Bu uzmanın açtığı, kullanıcı onayı bekleyen işlem sayısı. */
  proposals: number;
}

/** UI'da gösterilecek etiket ve renk. */
export const AGENT_LABELS: Record<AgentKey, string> = {
  orchestrator: "Yönlendirici",
  fitness: "Fitness Koçu",
  nutrition: "Beslenme Uzmanı",
  physio: "Fizyoterapist",
  recovery: "Toparlanma Uzmanı",
  mental: "Mental Koç",
  gamification: "Oyunlaştırma",
  social: "Sosyal Koç",
  medical: "Tıbbi Güvenlik",
  synthesizer: "Birleştirici",
};

/** Ajan rozetleri için emoji — arayüzde ikon kütüphanesine bağımlılık yaratmadan. */
export const AGENT_EMOJI: Record<AgentKey, string> = {
  orchestrator: "🧭",
  fitness: "🏋️",
  nutrition: "🥗",
  physio: "🩹",
  recovery: "😴",
  mental: "🧠",
  gamification: "🎮",
  social: "👥",
  medical: "⚕️",
  synthesizer: "✍️",
};
