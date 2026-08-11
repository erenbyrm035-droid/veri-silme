import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  AdminUserRow,
  AdminUserNote,
  AdminUserStats,
  AdminUserActivityItem,
} from "@/lib/database.types";
import {
  USERS_PAGE_SIZE,
  type UserFilter,
  type UserSort,
} from "./constants";

export interface ListUsersParams {
  q?: string;
  filter?: UserFilter;
  sort?: UserSort;
  page?: number;
}

export interface ListUsersResult {
  rows: AdminUserRow[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

/** PostgREST or() sözdizimini bozan karakterleri temizler. */
function sanitize(q: string): string {
  return q.replace(/[,()*%]/g, " ").trim();
}

function applyFilter(
  query: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  filter: UserFilter
) {
  switch (filter) {
    case "premium":
      return query.eq("is_premium", true);
    case "free":
      return query.eq("is_premium", false);
    case "admin":
      return query.eq("admin_role", "admin");
    case "editor":
      return query.eq("admin_role", "editor");
    case "super_admin":
      return query.eq("admin_role", "super_admin");
    case "banned":
      return query.eq("is_banned", true);
    case "active":
      return query.eq("is_active", true);
    case "passive":
      return query.eq("is_active", false);
    default:
      return query;
  }
}

function applySort(
  query: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  sort: UserSort
) {
  switch (sort) {
    case "oldest":
      return query.order("created_at", { ascending: true });
    case "name_asc":
      return query.order("full_name", { ascending: true, nullsFirst: false });
    case "name_desc":
      return query.order("full_name", { ascending: false, nullsFirst: false });
    case "last_login":
      return query.order("last_sign_in_at", { ascending: false, nullsFirst: false });
    case "premium":
      return query
        .order("is_premium", { ascending: false })
        .order("created_at", { ascending: false });
    default:
      return query.order("created_at", { ascending: false });
  }
}

/** Server-side sayfalı kullanıcı listesi (admin_users görünümü, service_role). */
export async function listUsers({
  q,
  filter = "all",
  sort = "newest",
  page = 1,
}: ListUsersParams): Promise<ListUsersResult> {
  const supabase = createAdminClient();
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * USERS_PAGE_SIZE;
  const to = from + USERS_PAGE_SIZE - 1;

  let query = supabase
    .from("admin_users")
    .select("*", { count: "exact" });

  query = applyFilter(query, filter);

  const term = q ? sanitize(q) : "";
  if (term) {
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  }

  query = applySort(query, sort);
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    rows: (data ?? []) as AdminUserRow[],
    total,
    page: safePage,
    pageCount: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)),
    pageSize: USERS_PAGE_SIZE,
  };
}

/** Tek kullanıcı detayı. */
export async function getUserById(id: string): Promise<AdminUserRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("admin_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as AdminUserRow) ?? null;
}

async function countRows(
  supabase: ReturnType<typeof createAdminClient>,
  table: string,
  userId: string,
  extra?: (q: any) => any // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<number> {
  let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (extra) q = extra(q);
  const { count } = await q;
  return count ?? 0;
}

/** Kullanıcı istatistikleri (detay sayfası kartları). */
export async function getUserStats(userId: string): Promise<AdminUserStats> {
  const supabase = createAdminClient();
  const [
    totalLogins,
    totalWorkouts,
    completedWorkouts,
    totalPrograms,
    favoriteExercises,
    aiConversations,
    postureAnalyses,
    mealPlans,
  ] = await Promise.all([
    countRows(supabase, "user_login_events", userId),
    countRows(supabase, "workouts", userId),
    countRows(supabase, "workouts", userId, (q) => q.eq("status", "completed")),
    countRows(supabase, "programs", userId),
    countRows(supabase, "favorites", userId),
    countRows(supabase, "ai_conversations", userId),
    countRows(supabase, "posture_analyses", userId),
    countRows(supabase, "meal_plans", userId),
  ]);
  return {
    totalLogins,
    totalWorkouts,
    completedWorkouts,
    totalPrograms,
    favoriteExercises,
    aiConversations,
    postureAnalyses,
    mealPlans,
  };
}

/** Admin notları (en yeni önce). */
export async function getUserNotes(userId: string): Promise<AdminUserNote[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("admin_user_notes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as AdminUserNote[];
}

/** Birleşik aktivite zaman çizelgesi (son 30 kayıt). */
export async function getUserActivity(
  userId: string
): Promise<AdminUserActivityItem[]> {
  const supabase = createAdminClient();
  const limit = 8;
  const [logins, programs, chats, postures, meals, workouts] = await Promise.all([
    supabase.from("user_login_events").select("provider, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit),
    supabase.from("programs").select("title, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit),
    supabase.from("ai_conversations").select("title, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit),
    supabase.from("posture_analyses").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit),
    supabase.from("meal_plans").select("title, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit),
    supabase.from("workouts").select("title, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit),
  ]);

  const items: AdminUserActivityItem[] = [];
  (logins.data ?? []).forEach((r: { provider: string | null; created_at: string }) =>
    items.push({ kind: "login", title: r.provider ? `Giriş (${r.provider})` : "Giriş yaptı", created_at: r.created_at })
  );
  (programs.data ?? []).forEach((r: { title: string; created_at: string }) =>
    items.push({ kind: "program", title: `Program: ${r.title}`, created_at: r.created_at })
  );
  (chats.data ?? []).forEach((r: { title: string; created_at: string }) =>
    items.push({ kind: "ai_chat", title: `AI Sohbeti: ${r.title}`, created_at: r.created_at })
  );
  (postures.data ?? []).forEach((r: { created_at: string }) =>
    items.push({ kind: "posture", title: "Postür analizi", created_at: r.created_at })
  );
  (meals.data ?? []).forEach((r: { title: string; created_at: string }) =>
    items.push({ kind: "meal_plan", title: `Diyet planı: ${r.title}`, created_at: r.created_at })
  );
  (workouts.data ?? []).forEach((r: { title: string; created_at: string }) =>
    items.push({ kind: "workout", title: `Antrenman: ${r.title}`, created_at: r.created_at })
  );

  return items
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 30);
}
