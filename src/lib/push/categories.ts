// Push bildirim kategorileri — client & server güvenli (yan etkisiz).
export type PushCategory =
  | "workout" | "water" | "protein" | "calorie"
  | "challenge" | "leaderboard" | "premium" | "ai_tip";

export const PUSH_CATEGORY_LABELS: Record<PushCategory, string> = {
  workout: "Antrenman", water: "Su", protein: "Protein", calorie: "Kalori",
  challenge: "Challenge", leaderboard: "Liderlik", premium: "Premium", ai_tip: "AI Tavsiyesi",
};
