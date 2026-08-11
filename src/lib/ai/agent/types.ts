// ============================================================================
// Agent tipleri — SUNUCU/İSTEMCİ ORTAK.
//
// Bu dosyada `server-only` YOK ve hiçbir sunucu modülü import edilmez; çünkü
// UI (agent araç göstergesi, öneri onay kartı, rapor görünümü) bu tipleri ve
// etiket sabitlerini kullanacak. Sunucu modülleri (`tools.ts`, `runtime.ts`)
// buradan tip alır, buraya değer yazmaz.
//
// Daha önce iki kez `server-only` bir modülden DEĞER (sabit) import edilen
// istemci component'i build'i kırdı; tipler silinir ama sabitler silinmez.
// Bu ayrım o hatanın tekrarlanmasını engelliyor.
// ============================================================================

/** Agent'ın veri değiştirme riski. Yüksek riskli araç kullanıcı onayı ister. */
export type ToolRisk = "read" | "write" | "sensitive";

/** `ai_actions.status` ile birebir aynı. */
export type AgentActionStatus =
  | "executed"
  | "proposed"
  | "approved"
  | "rejected"
  | "failed";

/** `ai_reports.kind` ile birebir aynı. */
export type ReportKind = "morning" | "evening" | "weekly" | "monthly";

/** Agent'ın kaydettiği/önerdiği bir işlem — UI'da kart olarak gösterilir. */
export interface AgentAction {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  status: AgentActionStatus;
  summary: string | null;
  error: string | null;
  created_at: string;
}

/** Hedef ilerlemesi — `goal_progress()` RPC çıktısı. */
export interface GoalProgress {
  id: string;
  title: string;
  metric: string;
  direction: "decrease" | "increase" | "maintain";
  start_value: number | null;
  current_value: number | null;
  target_value: number;
  progress_pct: number | null;
  time_pct: number | null;
  on_track: boolean;
  days_left: number | null;
  target_date: string | null;
  status: string;
}

/** Kalıcı hafıza kaydı. */
export interface AgentFact {
  key: string;
  value: string;
  category: string;
  confidence: number;
  source: string;
}

/** Rapor kaydı. */
export interface AgentReport {
  id: string;
  kind: ReportKind;
  report_date: string;
  headline: string;
  body: string;
  metrics: Record<string, unknown>;
  suggestions: { label: string; tool?: string; args?: Record<string, unknown> }[];
  seen_at: string | null;
  created_at: string;
}

/** Proaktif uyarı — agent'ın kendiliğinden söylediği şey. */
export interface ProactiveNudge {
  /** Kararlı kimlik — aynı uyarı tekrar üretilirse aynı id gelir. */
  id: string;
  tone: "alert" | "warning" | "info" | "celebrate";
  text: string;
  href?: string;
  cta?: string;
  /** 0-100; UI en yüksek öncelikli birkaçını gösterir. */
  priority: number;
}

// --- Etiketler (UI) --------------------------------------------------------

export const TOOL_LABELS: Record<string, string> = {
  get_workout_history: "Antrenman geçmişi okundu",
  get_nutrition_status: "Beslenme durumu okundu",
  get_gamification: "Seviye ve seri okundu",
  get_team_and_friends: "Takım ve arkadaşlar okundu",
  get_goal_progress: "Hedef ilerlemesi hesaplandı",
  remember_fact: "Bilgi hatırlandı",
  forget_fact: "Bilgi unutuldu",
  set_goal: "Hedef tanımlandı",
  log_water: "Su kaydedildi",
  schedule_workout: "Antrenman planlandı",
  add_rest_day: "Dinlenme günü eklendi",
  update_macro_targets: "Makro hedefleri güncellendi",
  adjust_program_intensity: "Program yoğunluğu değiştirildi",
};

export const REPORT_LABELS: Record<ReportKind, string> = {
  morning: "Günaydın raporu",
  evening: "Gün sonu raporu",
  weekly: "Haftalık rapor",
  monthly: "Aylık rapor",
};
