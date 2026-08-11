import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type {
  UserGamification, Level, Achievement, AchievementProgress, Badge,
  WeeklyChallenge, RewardCatalogItem, RewardClaim, LeaderboardRow,
  SyncGamificationResult, LeaderboardPeriod, LeaderboardScope,
} from "@/lib/database.types";
import type { RecoveryStatus } from "./constants";

// --- Yardımcılar -------------------------------------------------------------
function mondayOf(d = new Date()): string {
  const x = new Date(d);
  const day = (x.getUTCDay() + 6) % 7; // Pazartesi = 0
  x.setUTCDate(x.getUTCDate() - day);
  return x.toISOString().slice(0, 10);
}
// --- Leaderboard dönem pencereleri ------------------------------------------
// Tarihler Türkiye saatine (Europe/Istanbul) göre hesaplanır; UTC kayması
// yüzünden "bugün"ün yanlış güne düşmesini engeller.
const TR_TZ = "Europe/Istanbul";
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Türkiye saatiyle bugünün tarihi (YYYY-MM-DD). */
function todayTR(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TR_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  return new Date(`${parts}T00:00:00Z`);
}
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

export interface PeriodWindow { start: string | null; end: string | null }

/**
 * Dönem penceresi. `previous=true` ise bir önceki eşdeğer dönem döner
 * (sıra değişimi/delta hesabı için).
 *   weekly  → son 7 gün        (önceki: ondan önceki 7 gün)
 *   monthly → bulunulan ay     (önceki: geçen ay)
 *   yearly  → bulunulan yıl    (önceki: geçen yıl)
 *   all_time→ pencere yok
 */
export function periodWindow(period: LeaderboardPeriod, previous = false): PeriodWindow {
  const today = todayTR();
  if (period === "all_time") return { start: null, end: null };

  if (period === "weekly") {
    const end = previous ? addDays(today, -7) : today;
    return { start: iso(addDays(end, -6)), end: iso(end) };
  }
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  if (period === "monthly") {
    const first = previous ? new Date(Date.UTC(y, m - 1, 1)) : new Date(Date.UTC(y, m, 1));
    const last = previous ? new Date(Date.UTC(y, m, 0)) : today;
    return { start: iso(first), end: iso(last) };
  }
  // yearly
  const first = previous ? new Date(Date.UTC(y - 1, 0, 1)) : new Date(Date.UTC(y, 0, 1));
  const last = previous ? new Date(Date.UTC(y - 1, 11, 31)) : today;
  return { start: iso(first), end: iso(last) };
}

export interface AchievementView extends Achievement {
  progress: number;
  completed: boolean;
  completed_at: string | null;
  badge: Badge | null;
}

export interface GamificationOverview {
  sync: SyncGamificationResult;
  stats: UserGamification;
  currentLevel: Level | null;
  nextLevel: Level | null;
  levels: Level[];
  achievements: AchievementView[];
  recentUnlocks: AchievementView[];
  fitnessHistory: { date: string; score: number }[];
  weeklyXp: number;
}

/** Kullanıcının oyunlaştırma durumunu senkronize eder ve tam görünümü döndürür. */
/** Bu süreden daha eski `user_gamification` kayıtları yeniden hesaplanır. */
const SYNC_STALE_MS = 15 * 60 * 1000;

export async function getOverview(userId: string): Promise<GamificationOverview> {
  const supabase = await createClient();

  // Bayatlık kontrolü: ağır sync_gamification'ı her yüklemede değil, yalnızca
  // kayıt yoksa veya 15 dk'dan eskiyse çalıştır (performans).
  const { data: existing } = await supabase
    .from("user_gamification").select("total_xp, level, fitness_score, current_streak, longest_streak, updated_at")
    .eq("user_id", userId).maybeSingle();
  const fresh = existing && Date.now() - new Date(existing.updated_at as string).getTime() < SYNC_STALE_MS;

  let sync: SyncGamificationResult;
  if (fresh) {
    const e = existing as UserGamification;
    sync = { total_xp: e.total_xp, level: e.level, prev_level: e.level, leveled_up: false, fitness_score: e.fitness_score, current_streak: e.current_streak, longest_streak: e.longest_streak };
  } else {
    const { data: syncData } = await supabase.rpc("sync_gamification", { p_user: userId });
    sync = (syncData as SyncGamificationResult) ?? {
      total_xp: 0, level: 1, prev_level: 1, leveled_up: false, fitness_score: 0, current_streak: 0, longest_streak: 0,
    };
  }

  const weekStart = mondayOf();
  const [{ data: stats }, { data: levels }, { data: achs }, { data: progress }, { data: badges }, { data: fitness }, { data: weekLogs }] =
    await Promise.all([
      supabase.from("user_gamification").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("levels").select("*").order("min_xp"),
      supabase.from("achievements").select("*").eq("enabled", true).order("sort_order"),
      supabase.from("achievement_progress").select("*").eq("user_id", userId),
      supabase.from("badges").select("*"),
      supabase.from("fitness_scores").select("score_date, score").eq("user_id", userId).order("score_date", { ascending: false }).limit(30),
      supabase.from("xp_logs").select("xp").eq("user_id", userId).gte("created_at", weekStart),
    ]);
  const weeklyXp = ((weekLogs as { xp: number }[]) ?? []).reduce((s, l) => s + (l.xp ?? 0), 0);

  const lv = (levels ?? []) as Level[];
  const totalXp = (stats as UserGamification)?.total_xp ?? sync.total_xp;
  const currentLevel = [...lv].reverse().find((l) => l.min_xp <= totalXp) ?? lv[0] ?? null;
  const nextLevel = lv.find((l) => l.min_xp > totalXp) ?? null;

  const progMap = new Map((progress as AchievementProgress[] ?? []).map((p) => [p.achievement_id, p]));
  const badgeMap = new Map((badges as Badge[] ?? []).map((b) => [b.id, b]));
  const achievements: AchievementView[] = ((achs as Achievement[]) ?? []).map((a) => {
    const p = progMap.get(a.id);
    return {
      ...a,
      progress: p?.progress ?? 0,
      completed: p?.completed ?? false,
      completed_at: p?.completed_at ?? null,
      badge: a.badge_id ? badgeMap.get(a.badge_id) ?? null : null,
    };
  });

  const recentUnlocks = achievements
    .filter((a) => a.completed && a.completed_at)
    .sort((x, y) => (y.completed_at! > x.completed_at! ? 1 : -1))
    .slice(0, 5);

  return {
    sync,
    stats: (stats as UserGamification) ?? {
      user_id: userId, total_xp: sync.total_xp, level: sync.level, fitness_score: sync.fitness_score,
      coins: 0, current_streak: sync.current_streak, longest_streak: sync.longest_streak,
      last_active_on: null, season_xp: sync.total_xp, updated_at: new Date().toISOString(),
    },
    currentLevel,
    nextLevel,
    levels: lv,
    achievements,
    recentUnlocks,
    fitnessHistory: ((fitness as { score_date: string; score: number }[]) ?? [])
      .map((f) => ({ date: f.score_date, score: f.score })).reverse(),
    weeklyXp,
  };
}

export interface ChallengeView extends WeeklyChallenge {
  progress: number;
  completed: boolean;
}

/** Bu haftanın görevleri + kullanıcı ilerlemesi. */
export async function getWeeklyChallenges(userId: string): Promise<ChallengeView[]> {
  const supabase = await createClient();
  const weekStart = mondayOf();
  // Bu hafta için görev yoksa otomatik üret (haftaya göre dönen set).
  await supabase.rpc("ensure_weekly_challenges", { p_week: weekStart }).then(
    () => undefined,
    () => undefined, // fonksiyon henüz yoksa sessiz geç
  );
  const { data: challenges } = await supabase
    .from("weekly_challenges").select("*").eq("week_start", weekStart).eq("active", true).order("created_at");
  if (!challenges || challenges.length === 0) return [];

  const [{ data: workouts }, { data: water }, { data: nutrition }] = await Promise.all([
    supabase.from("workouts").select("id, title, status, workout_date").eq("user_id", userId).gte("workout_date", weekStart),
    supabase.from("water_logs").select("amount_ml, log_date").eq("user_id", userId).gte("log_date", weekStart),
    supabase.from("nutrition_logs").select("protein_g, log_date").eq("user_id", userId).gte("log_date", weekStart),
  ]);

  const done = ((workouts as { title: string; status: string }[]) ?? []).filter((w) => w.status === "completed");
  const workoutCount = done.length;
  const mobilityCount = done.filter((w) => /mobil|esne|stretch/i.test(w.title ?? "")).length;
  const waterMl = ((water as { amount_ml: number }[]) ?? []).reduce((s, w) => s + (w.amount_ml ?? 0), 0);
  const proteinG = ((nutrition as { protein_g: number }[]) ?? []).reduce((s, n) => s + Number(n.protein_g ?? 0), 0);

  const metricValue = (metric: string): number => {
    switch (metric) {
      case "workouts": return workoutCount;
      case "water_ml": return waterMl;
      case "protein_g": return Math.round(proteinG);
      case "mobility": return mobilityCount;
      case "steps": return 0; // adım kaynağı entegrasyonu bekleniyor
      default: return 0;
    }
  };

  // Kalıcı ilerleme: sync_gamification `challenge_progress`'e sticky "tamamlandı"
  // yazıyor. Yalnızca anlık metriğe bakılırsa hafta içinde tamamlanmış bir görev,
  // sayaç düştüğünde (ör. kayıt silinince) UI'da geri açılırdı.
  const { data: saved } = await supabase
    .from("challenge_progress")
    .select("challenge_id, progress, completed")
    .eq("user_id", userId)
    .in("challenge_id", (challenges as { id: string }[]).map((c) => c.id));
  const savedById = new Map(
    ((saved as { challenge_id: string; progress: number; completed: boolean }[]) ?? [])
      .map((r) => [r.challenge_id, r])
  );

  return (challenges as WeeklyChallenge[]).map((c) => {
    const live = metricValue(c.metric);
    const stored = savedById.get(c.id);
    const progress = Math.max(live, Number(stored?.progress ?? 0));
    return {
      ...c,
      progress,
      completed: (stored?.completed ?? false) || progress >= Number(c.target),
    };
  });
}

/** Ödül kataloğu + kullanıcı coin bakiyesi + talepler. */
export async function getRewards(userId: string): Promise<{ catalog: RewardCatalogItem[]; coins: number; claims: RewardClaim[] }> {
  const supabase = await createClient();
  const [{ data: catalog }, { data: stats }, { data: claims }] = await Promise.all([
    supabase.from("reward_catalog").select("*").eq("enabled", true).order("sort_order"),
    supabase.from("user_gamification").select("coins").eq("user_id", userId).maybeSingle(),
    supabase.from("reward_claims").select("*").eq("user_id", userId).order("claimed_at", { ascending: false }),
  ]);
  return {
    catalog: (catalog as RewardCatalogItem[]) ?? [],
    coins: (stats as { coins: number })?.coins ?? 0,
    claims: (claims as RewardClaim[]) ?? [],
  };
}

export interface TimelineEvent { id: string; kind: "xp" | "achievement" | "level"; title: string; detail: string; xp: number; at: string; }

/** Kullanıcının başarı zaman çizgisi (XP olayları + başarımlar). */
export async function getTimeline(userId: string): Promise<TimelineEvent[]> {
  const supabase = await createClient();
  const [{ data: logs }, { data: prog }, { data: achs }] = await Promise.all([
    supabase.from("xp_logs").select("id, event_key, xp, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(40),
    supabase.from("achievement_progress").select("achievement_id, completed_at").eq("user_id", userId).eq("completed", true).not("completed_at", "is", null),
    supabase.from("achievements").select("id, name, xp_reward"),
  ]);
  const achMap = new Map(((achs as { id: string; name: string; xp_reward: number }[]) ?? []).map((a) => [a.id, a]));
  const events: TimelineEvent[] = [];
  for (const p of (prog as { achievement_id: string; completed_at: string }[]) ?? []) {
    const a = achMap.get(p.achievement_id);
    if (a) events.push({ id: `ach-${p.achievement_id}`, kind: "achievement", title: a.name, detail: "Başarım açıldı", xp: a.xp_reward, at: p.completed_at });
  }
  for (const l of (logs as { id: string; event_key: string; xp: number; created_at: string }[]) ?? []) {
    events.push({ id: `xp-${l.id}`, kind: "xp", title: l.event_key, detail: "XP kazanıldı", xp: l.xp, at: l.created_at });
  }
  return events.sort((a, b) => (b.at > a.at ? 1 : -1)).slice(0, 40);
}

/** Son 30 günün kas ısı haritası (set sayısına göre). */
export interface HeatmapEntry { muscle_id: string; name: string; region: string; svg_region_id: string | null; sets: number; }
export async function getMuscleHeatmap(userId: string): Promise<HeatmapEntry[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const { data: workouts } = await supabase.from("workouts").select("id").eq("user_id", userId).gte("workout_date", since);
  const ids = ((workouts as { id: string }[]) ?? []).map((w) => w.id);
  if (ids.length === 0) return [];
  const { data: sets } = await supabase.from("workout_sets").select("exercise_id").in("workout_id", ids).eq("completed", true);
  const exIds = Array.from(new Set(((sets as { exercise_id: string | null }[]) ?? []).map((s) => s.exercise_id).filter(Boolean))) as string[];
  if (exIds.length === 0) return [];

  const { data: em } = await supabase.from("exercise_muscles").select("exercise_id, muscle_id, role").in("exercise_id", exIds);
  const setCountByEx = new Map<string, number>();
  for (const s of (sets as { exercise_id: string | null }[]) ?? []) {
    if (s.exercise_id) setCountByEx.set(s.exercise_id, (setCountByEx.get(s.exercise_id) ?? 0) + 1);
  }
  const byMuscle = new Map<string, number>();
  for (const row of (em as { exercise_id: string; muscle_id: string; role: string }[]) ?? []) {
    const w = row.role === "primary" ? 1 : 0.5;
    byMuscle.set(row.muscle_id, (byMuscle.get(row.muscle_id) ?? 0) + (setCountByEx.get(row.exercise_id) ?? 0) * w);
  }
  const muscleIds = Array.from(byMuscle.keys());
  if (muscleIds.length === 0) return [];
  const { data: muscles } = await supabase.from("muscles").select("id, name_tr, region, svg_region_id").in("id", muscleIds);
  return ((muscles as { id: string; name_tr: string; region: string; svg_region_id: string | null }[]) ?? [])
    .map((m) => ({ muscle_id: m.id, name: m.name_tr, region: m.region, svg_region_id: m.svg_region_id, sets: Math.round(byMuscle.get(m.id) ?? 0) }))
    .sort((a, b) => b.sets - a.sets);
}

/** Recovery Score — son 2 günün antrenman yoğunluğuna göre. */
export async function getRecovery(userId: string): Promise<{ status: RecoveryStatus; score: number }> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
  const { data: workouts } = await supabase.from("workouts").select("id, workout_date").eq("user_id", userId).eq("status", "completed").gte("workout_date", since);
  const rows = (workouts as { id: string }[]) ?? [];
  const ids = rows.map((w) => w.id);
  let volume = 0;
  if (ids.length) {
    const { data: sets } = await supabase.from("workout_sets").select("reps, weight_kg").in("workout_id", ids).eq("completed", true);
    volume = ((sets as { reps: number | null; weight_kg: number | null }[]) ?? []).reduce((s, x) => s + (x.reps ?? 0) * Number(x.weight_kg ?? 0), 0);
  }
  const load = rows.length * 2 + volume / 3000;
  let status: RecoveryStatus = "ready";
  if (load >= 8) status = "overloaded";
  else if (load >= 3) status = "rest";
  const score = Math.max(0, Math.min(100, Math.round(100 - load * 8)));
  return { status, score };
}

// --- Takımlar ----------------------------------------------------------------
export interface TeamView {
  id: string; name: string; slug: string; description: string | null;
  badge: string | null; color: string | null;
  points: number; weekly_points: number; member_count: number;
  is_member: boolean; is_owner: boolean; rank: number;
}

/**
 * Takım puanı = üyelerin gerçek XP toplamı (all-time) + bu haftaki katkı.
 * (teams.points sütunu artık dinamik hesaplanır; statik değere güvenilmez.)
 */
export async function getTeams(userId: string): Promise<{ teams: TeamView[]; myTeamId: string | null }> {
  const admin = createAdminClient();
  const weekStart = mondayOf();
  const [{ data: teams }, { data: members }, { data: gam }, { data: weekLogs }] = await Promise.all([
    admin.from("teams").select("id, name, slug, description, badge, color, owner_id").limit(100),
    admin.from("team_members").select("team_id, user_id"),
    admin.from("user_gamification").select("user_id, total_xp"),
    admin.from("xp_logs").select("user_id, xp").gte("created_at", weekStart),
  ]);
  const memberRows = (members as { team_id: string; user_id: string }[]) ?? [];
  const xpByUser = new Map(((gam as { user_id: string; total_xp: number }[]) ?? []).map((g) => [g.user_id, g.total_xp]));
  const weekByUser = new Map<string, number>();
  for (const l of (weekLogs as { user_id: string; xp: number }[]) ?? []) {
    weekByUser.set(l.user_id, (weekByUser.get(l.user_id) ?? 0) + (l.xp ?? 0));
  }
  const countByTeam = new Map<string, number>();
  const pointsByTeam = new Map<string, number>();
  const weeklyByTeam = new Map<string, number>();
  for (const m of memberRows) {
    countByTeam.set(m.team_id, (countByTeam.get(m.team_id) ?? 0) + 1);
    pointsByTeam.set(m.team_id, (pointsByTeam.get(m.team_id) ?? 0) + (xpByUser.get(m.user_id) ?? 0));
    weeklyByTeam.set(m.team_id, (weeklyByTeam.get(m.team_id) ?? 0) + (weekByUser.get(m.user_id) ?? 0));
  }
  const myTeam = memberRows.find((m) => m.user_id === userId)?.team_id ?? null;
  const views: TeamView[] = ((teams as { id: string; name: string; slug: string; description: string | null; badge: string | null; color: string | null; owner_id: string | null }[]) ?? [])
    .map((t) => ({
      id: t.id, name: t.name, slug: t.slug, description: t.description, badge: t.badge, color: t.color,
      points: pointsByTeam.get(t.id) ?? 0, weekly_points: weeklyByTeam.get(t.id) ?? 0,
      member_count: countByTeam.get(t.id) ?? 0,
      is_member: memberRows.some((m) => m.team_id === t.id && m.user_id === userId),
      is_owner: t.owner_id === userId, rank: 0,
    }))
    .sort((a, b) => b.points - a.points || b.weekly_points - a.weekly_points)
    .map((t, i) => ({ ...t, rank: i + 1 }))
    .slice(0, 50);
  return { teams: views, myTeamId: myTeam };
}

export interface TeamRosterMember {
  user_id: string; name: string; avatar_url: string | null;
  level: number; total_xp: number; weekly_xp: number; role: string; is_me: boolean;
}

/** Bir takımın üye kadrosu — katkıya (toplam XP) göre sıralı. */
export async function getTeamRoster(teamId: string, meId: string): Promise<TeamRosterMember[]> {
  const admin = createAdminClient();
  const weekStart = mondayOf();
  const { data: members } = await admin.from("team_members").select("user_id, role").eq("team_id", teamId);
  const rows = (members as { user_id: string; role: string }[]) ?? [];
  const ids = rows.map((r) => r.user_id);
  if (ids.length === 0) return [];
  const [{ data: profiles }, { data: gam }, { data: weekLogs }] = await Promise.all([
    admin.from("profiles").select("id, full_name, avatar_url").in("id", ids),
    admin.from("user_gamification").select("user_id, total_xp, level").in("user_id", ids),
    admin.from("xp_logs").select("user_id, xp").in("user_id", ids).gte("created_at", weekStart),
  ]);
  const profMap = new Map(((profiles as { id: string; full_name: string | null; avatar_url: string | null }[]) ?? []).map((p) => [p.id, p]));
  const gamMap = new Map(((gam as { user_id: string; total_xp: number; level: number }[]) ?? []).map((g) => [g.user_id, g]));
  const weekByUser = new Map<string, number>();
  for (const l of (weekLogs as { user_id: string; xp: number }[]) ?? []) {
    weekByUser.set(l.user_id, (weekByUser.get(l.user_id) ?? 0) + (l.xp ?? 0));
  }
  return rows
    .map((r) => {
      const p = profMap.get(r.user_id);
      const g = gamMap.get(r.user_id);
      return {
        user_id: r.user_id, name: p?.full_name ?? "Anonim", avatar_url: p?.avatar_url ?? null,
        level: g?.level ?? 1, total_xp: g?.total_xp ?? 0, weekly_xp: weekByUser.get(r.user_id) ?? 0,
        role: r.role, is_me: r.user_id === meId,
      };
    })
    .sort((a, b) => b.total_xp - a.total_xp);
}

// --- Leaderboard (cross-user; service_role ile okunur) ----------------------
export interface LeaderboardResult {
  rows: LeaderboardRow[];
  me: LeaderboardRow | null;
  /** Filtre uygulandıktan sonraki toplam yarışmacı sayısı (sayfalama için). */
  total: number;
  /** Kullanıcının profilinde bu scope için değer yoksa true → UI bilgi ister. */
  needsProfile: boolean;
  /** Uygulanan bölge değeri (ör. "Türkiye" / "İstanbul"). */
  scopeValue: string | null;
}

type ScoreRow = { user_id: string; score: number; level: number; streak: number };

/** RPC'den dönem skorlarını alır (start null → tüm zamanlar). */
async function fetchScores(
  admin: ReturnType<typeof createAdminClient>,
  win: PeriodWindow
): Promise<ScoreRow[]> {
  const { data, error } = await admin.rpc("leaderboard_scores", {
    p_start: win.start,
    p_end: win.end,
  });
  if (error) {
    console.error("[leaderboard] leaderboard_scores RPC hatası:", error.message);
    return [];
  }
  return ((data as ScoreRow[]) ?? []).map((r) => ({
    user_id: r.user_id,
    score: Number(r.score) || 0,
    level: r.level ?? 1,
    streak: r.streak ?? 0,
  }));
}

export async function getLeaderboard(opts: {
  period: LeaderboardPeriod;
  scope: LeaderboardScope;
  scopeValue?: string | null;
  userId: string;
  limit?: number;
  offset?: number;
}): Promise<LeaderboardResult> {
  const admin = createAdminClient();
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const empty: LeaderboardResult = { rows: [], me: null, total: 0, needsProfile: false, scopeValue: null };

  // 1) Skorlar: bu dönem + önceki dönem (sıra değişimi için)
  const win = periodWindow(opts.period);
  const prevWin = periodWindow(opts.period, true);
  const [current, previous] = await Promise.all([
    fetchScores(admin, win),
    opts.period === "all_time" ? Promise.resolve([] as ScoreRow[]) : fetchScores(admin, prevWin),
  ]);
  if (current.length === 0) return empty;

  // 2) Profiller + gizlilik tercihi
  const userIds = current.map((r) => r.user_id);
  const [{ data: profiles }, { data: prefs }] = await Promise.all([
    admin.from("profiles").select("id, full_name, avatar_url, country, city").in("id", userIds),
    admin.from("user_settings").select("user_id, privacy").in("user_id", userIds),
  ]);
  type Prof = { id: string; full_name: string | null; avatar_url: string | null; country: string | null; city: string | null };
  const profMap = new Map(((profiles as Prof[]) ?? []).map((p) => [p.id, p]));
  const hidden = new Set(
    ((prefs as { user_id: string; privacy: Record<string, unknown> | null }[]) ?? [])
      .filter((s) => s.privacy && (s.privacy as { leaderboard_visible?: boolean }).leaderboard_visible === false)
      .map((s) => s.user_id)
  );

  // 3) Bölge değeri: verilmediyse kullanıcının kendi profilinden türet
  const meProf = profMap.get(opts.userId);
  let scopeValue = opts.scopeValue ?? null;
  if (!scopeValue && opts.scope !== "global") {
    if (opts.scope === "country") scopeValue = meProf?.country ?? null;
    if (opts.scope === "city") scopeValue = meProf?.city ?? null;
    if (!scopeValue) {
      // Profilde bilgi yok → UI kullanıcıdan istesin
      let mp = meProf ?? null;
      if (!mp) {
        const { data } = await admin
          .from("profiles").select("id, full_name, avatar_url, country, city").eq("id", opts.userId).maybeSingle();
        mp = (data as Prof) ?? null;
      }
      const v = opts.scope === "country" ? mp?.country : mp?.city;
      if (!v) return { ...empty, needsProfile: true };
      scopeValue = v;
    }
  }

  // 4) Önceki dönem sıraları (filtre uygulanmış hâliyle karşılaştırılır)
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  const inScope = (id: string): boolean => {
    if (opts.scope === "global") return true;
    const p = profMap.get(id);
    if (!p) return false;
    const field = opts.scope === "country" ? p.country : p.city;
    return norm(field) === norm(scopeValue);
  };

  const prevRank = new Map<string, number>();
  previous
    .filter((r) => (!hidden.has(r.user_id) || r.user_id === opts.userId) && inScope(r.user_id))
    .sort((a, b) => b.score - a.score)
    .forEach((r, i) => prevRank.set(r.user_id, i + 1));

  // 5) Sıralama
  const ranked: LeaderboardRow[] = current
    .filter((r) => (!hidden.has(r.user_id) || r.user_id === opts.userId) && inScope(r.user_id))
    .sort((a, b) => b.score - a.score || a.user_id.localeCompare(b.user_id))
    .map((r, i) => {
      const p = profMap.get(r.user_id);
      const before = prevRank.get(r.user_id);
      return {
        user_id: r.user_id,
        full_name: p?.full_name ?? "Anonim",
        avatar_url: p?.avatar_url ?? null,
        country: p?.country ?? null,
        city: p?.city ?? null,
        score: r.score,
        level: r.level,
        streak: r.streak,
        rank: i + 1,
        delta: before == null ? null : before - (i + 1), // + yükseldi, − düştü
      };
    });

  return {
    rows: ranked.slice(offset, offset + limit),
    me: ranked.find((r) => r.user_id === opts.userId) ?? null,
    total: ranked.length,
    needsProfile: false,
    scopeValue,
  };
}
