import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { ErrorLog } from "@/lib/database.types";

export interface SystemHealth {
  db: { ok: boolean; latencyMs: number };
  counts: { users: number; workouts: number; aiConversations: number; errors24h: number };
  ai: { totalRequests: number; totalTokens: number; provider: string; configured: boolean };
  storage: { bucket: string; objects: number }[];
  config: { aiKey: boolean; billing: string; fcm: boolean; sentry: boolean; siteUrl: string };
  recentErrors: ErrorLog[];
}

const BUCKETS = ["exercise-media", "animations", "body-photos", "posture-photos", "meal-photos"];

export async function getSystemHealth(): Promise<SystemHealth> {
  const s = createAdminClient();
  const t0 = Date.now();
  const since = new Date(Date.now() - 864e5).toISOString();

  const [users, workouts, aiConv, errs24, aiUsage, recentErrors] = await Promise.all([
    s.from("profiles").select("id", { count: "exact", head: true }),
    s.from("workouts").select("id", { count: "exact", head: true }),
    s.from("ai_conversations").select("id", { count: "exact", head: true }),
    s.from("error_logs").select("id", { count: "exact", head: true }).gte("created_at", since),
    s.from("ai_usage").select("total_tokens"),
    s.from("error_logs").select("*").order("created_at", { ascending: false }).limit(20),
  ]);
  const latencyMs = Date.now() - t0;

  const usageRows = (aiUsage.data as { total_tokens: number | null }[]) ?? [];
  const totalTokens = usageRows.reduce((a, b) => a + (b.total_tokens ?? 0), 0);

  const storage = await Promise.all(
    BUCKETS.map(async (b) => {
      try {
        const { data } = await s.storage.from(b).list("", { limit: 1000 });
        return { bucket: b, objects: (data ?? []).length };
      } catch { return { bucket: b, objects: -1 }; }
    })
  );

  return {
    db: { ok: !users.error, latencyMs },
    counts: { users: users.count ?? 0, workouts: workouts.count ?? 0, aiConversations: aiConv.count ?? 0, errors24h: errs24.count ?? 0 },
    ai: {
      totalRequests: usageRows.length, totalTokens,
      provider: process.env.AI_PROVIDER ?? "openai",
      configured: !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY),
    },
    storage,
    config: {
      aiKey: !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY),
      billing: process.env.BILLING_PROVIDER ?? "manual",
      fcm: !!(process.env.FCM_SERVER_KEY || process.env.FCM_SERVICE_ACCOUNT_JSON),
      sentry: !!process.env.SENTRY_DSN,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "—",
    },
    recentErrors: (recentErrors.data as ErrorLog[]) ?? [],
  };
}
