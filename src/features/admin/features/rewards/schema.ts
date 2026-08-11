import { z } from "zod";

/** Boş string'i null'a çeviren yardımcı — form alanları boş bırakılabilsin. */
const nullableText = (max = 500) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));

export const rewardSchema = z.object({
  key: z.string().trim().min(2, "Anahtar en az 2 karakter").max(60)
    .regex(/^[a-z0-9_-]+$/, "Yalnızca küçük harf, rakam, tire ve alt çizgi"),
  name: z.string().trim().min(2, "Ad en az 2 karakter").max(120),
  description: nullableText(300),
  long_description: nullableText(2000),
  type: z.enum([
    "premium_days", "profile_frame", "theme", "ai_avatar",
    "badge", "exercise_pack", "program", "diet_pack",
  ]).default("badge"),
  fulfillment_type: z.enum(["digital", "coupon", "physical"]).default("digital"),
  category: nullableText(60),
  icon: nullableText(16),
  image_url: nullableText(500),

  cost_coins: z.coerce.number().int().min(0).max(1_000_000).default(0),
  req_xp: z.coerce.number().int().min(0).max(10_000_000).default(0),
  req_level: z.coerce.number().int().min(0).max(999).default(0),
  req_team_level: z.coerce.number().int().min(0).max(999).default(0),
  req_badge_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  req_achievement_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  req_challenge_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),

  /** null = sınırsız stok */
  stock: z.union([z.coerce.number().int().min(0).max(1_000_000), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : Number(v))),
  expires_at: z.string().trim().optional().transform((v) => (v ? new Date(v).toISOString() : null)),

  terms: nullableText(2000),
  coupon_code: nullableText(120),
  external_url: nullableText(500),
  sponsor_name: nullableText(120),
  sponsor_logo_url: nullableText(500),

  /** Ödül türüne özel yapılandırma (ör. premium_days için {"days": 30}) */
  value: z.string().trim().optional().transform((v) => {
    if (!v) return {};
    try { return JSON.parse(v) as Record<string, unknown>; } catch { return {}; }
  }),

  enabled: z.coerce.boolean().default(true),
  featured: z.coerce.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
});

export type RewardFormValues = z.input<typeof rewardSchema>;

export const decisionSchema = z.object({
  claimId: z.string().uuid(),
  status: z.enum(["approved", "rejected", "delivered", "cancelled", "shipped"]),
  note: z.string().trim().max(500).optional(),
});
