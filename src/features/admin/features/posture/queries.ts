import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  AdminPostureRow, PostureAnalysis, PostureFinding, RiskLevel, PostureRegion,
} from "@/lib/database.types";
import { REGION_LABELS } from "@/lib/posture/recommend";
import { POSTURE_PROBLEMS } from "@/lib/posture/problems";

const PAGE_SIZE = 20;

export interface ListParams { q?: string; risk?: string; page?: number; }
export interface ListResult { rows: AdminPostureRow[]; total: number; page: number; pageCount: number; pageSize: number; }

export async function listAnalyses(p: ListParams): Promise<ListResult> {
  const supabase = createAdminClient();
  const page = Math.max(1, p.page ?? 1);
  const from = (page - 1) * PAGE_SIZE, to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("posture_analyses")
    .select("id, user_id, posture_score, risk_level, environment, analysis_type, country, findings, created_at", { count: "exact" })
    .order("created_at", { ascending: false });
  if (p.risk) query = query.eq("risk_level", p.risk);
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as (Omit<AdminPostureRow, "user_name" | "email" | "top_problems"> & { findings: PostureFinding[] })[];

  // Kullanıcı adı + e-posta (admin_users görünümü).
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const nameMap = new Map<string, { name: string | null; email: string | null }>();
  if (userIds.length > 0) {
    const { data: users } = await supabase.from("admin_users").select("id, full_name, email").in("id", userIds);
    (users ?? []).forEach((u: { id: string; full_name: string | null; email: string | null }) => nameMap.set(u.id, { name: u.full_name, email: u.email }));
  }

  let mapped: AdminPostureRow[] = rows.map((r) => ({
    id: r.id, user_id: r.user_id,
    user_name: nameMap.get(r.user_id)?.name ?? null,
    email: nameMap.get(r.user_id)?.email ?? null,
    posture_score: r.posture_score, risk_level: r.risk_level, environment: r.environment,
    analysis_type: r.analysis_type, country: r.country,
    top_problems: (r.findings ?? []).slice(0, 3).map((f) => f.label),
    created_at: r.created_at,
  }));

  // İsim/e-posta araması (sunucu tarafı, sayfa içi).
  if (p.q) {
    const term = p.q.toLowerCase();
    mapped = mapped.filter((r) => (r.user_name ?? "").toLowerCase().includes(term) || (r.email ?? "").toLowerCase().includes(term));
  }

  const total = count ?? 0;
  return { rows: mapped, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), pageSize: PAGE_SIZE };
}

export async function getAnalysis(id: string): Promise<(PostureAnalysis & { user_name: string | null; email: string | null }) | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("posture_analyses").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const analysis = data as PostureAnalysis;
  const { data: user } = await supabase.from("admin_users").select("full_name, email").eq("id", analysis.user_id).maybeSingle();
  return { ...analysis, user_name: (user as { full_name: string | null } | null)?.full_name ?? null, email: (user as { email: string | null } | null)?.email ?? null };
}

export interface PostureAnalytics {
  total: number;
  avgScore: number;
  riskCounts: Record<RiskLevel, number>;
  topProblems: { problem: string; label: string; count: number }[];
  riskyRegions: { region: string; label: string; avgScore: number }[];
  countries: { country: string; count: number }[];
}

export async function getAnalytics(): Promise<PostureAnalytics> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("posture_analyses")
    .select("posture_score, risk_level, findings, region_scores, country")
    .order("created_at", { ascending: false })
    .limit(5000);
  const rows = (data ?? []) as { posture_score: number; risk_level: RiskLevel | null; findings: PostureFinding[]; region_scores: Record<string, { score: number }>; country: string | null }[];

  const riskCounts: Record<RiskLevel, number> = { low: 0, moderate: 0, high: 0 };
  const problemCounts = new Map<string, number>();
  const regionTotals = new Map<string, { sum: number; n: number }>();
  const countryCounts = new Map<string, number>();
  let scoreSum = 0;

  rows.forEach((r) => {
    scoreSum += Number(r.posture_score);
    if (r.risk_level) riskCounts[r.risk_level]++;
    (r.findings ?? []).forEach((f) => problemCounts.set(f.problem, (problemCounts.get(f.problem) ?? 0) + 1));
    Object.entries(r.region_scores ?? {}).forEach(([region, v]) => {
      const cur = regionTotals.get(region) ?? { sum: 0, n: 0 };
      cur.sum += Number(v.score); cur.n++; regionTotals.set(region, cur);
    });
    if (r.country) countryCounts.set(r.country, (countryCounts.get(r.country) ?? 0) + 1);
  });

  const n = rows.length || 1;
  return {
    total: rows.length,
    avgScore: Math.round(scoreSum / n),
    riskCounts,
    topProblems: [...problemCounts.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([problem, count]) => ({ problem, label: POSTURE_PROBLEMS[problem as keyof typeof POSTURE_PROBLEMS]?.label ?? problem, count })),
    riskyRegions: [...regionTotals.entries()]
      .map(([region, v]) => ({ region, label: REGION_LABELS[region as PostureRegion] ?? region, avgScore: Math.round(v.sum / v.n) }))
      .sort((a, b) => a.avgScore - b.avgScore).slice(0, 6),
    countries: [...countryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([country, count]) => ({ country, count })),
  };
}

/** Akıllı öneri: kas adlarına göre Exercise CMS'ten egzersiz önerir. */
export async function suggestExercisesFromCms(
  muscles: string[], environment: string, limit = 8
): Promise<{ id: string; name: string; muscle_group: string; equipment: string | null; slug: string | null; gif_url: string | null }[]> {
  if (muscles.length === 0) return [];
  const supabase = createAdminClient();
  // Kas grubu / ikincil kaslar eşleşmesi (ilk kelimeye göre gevşek eşleşme).
  const terms = [...new Set(muscles.map((m) => m.split(/[ (/]/)[0]).filter((t) => t.length > 2))].slice(0, 8);
  const or = terms.map((t) => `muscle_group.ilike.%${t}%`).join(",");
  let query = supabase
    .from("exercises")
    .select("id, name, muscle_group, equipment, slug, gif_url")
    .eq("status", "published")
    .limit(limit * 3);
  if (or) query = query.or(or);
  if (environment === "home") query = query.eq("is_home", true);
  else if (environment === "gym") query = query.eq("is_gym", true);
  const { data } = await query;
  return ((data ?? []) as { id: string; name: string; muscle_group: string; equipment: string | null; slug: string | null; gif_url: string | null }[]).slice(0, limit);
}
