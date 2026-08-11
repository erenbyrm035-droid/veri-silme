"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/features/users/guard";

export interface ActionResult<T = undefined> { ok: boolean; error?: string; data?: T; }
const fail = (e: string): ActionResult<never> => ({ ok: false, error: e });

// Tablo → izinli kolonlar + primary key. Yalnızca bu tablolar yönetilebilir.
const TABLES: Record<string, { pk: string; cols: string[]; numeric?: string[]; bool?: string[]; json?: string[] }> = {
  xp_rules: { pk: "event_key", cols: ["event_key", "label", "xp", "category", "cooldown", "enabled", "sort_order"], numeric: ["xp", "sort_order"], bool: ["enabled"] },
  levels: { pk: "level", cols: ["level", "title", "min_xp", "color", "icon", "sort_order"], numeric: ["level", "min_xp", "sort_order"] },
  badges: { pk: "id", cols: ["id", "key", "name", "tier", "description", "icon", "color", "sort_order", "enabled"], numeric: ["sort_order"], bool: ["enabled"] },
  achievements: { pk: "id", cols: ["id", "key", "name", "description", "category", "metric", "target", "icon", "badge_id", "xp_reward", "enabled", "sort_order"], numeric: ["target", "xp_reward", "sort_order"], bool: ["enabled"] },
  weekly_challenges: { pk: "id", cols: ["id", "week_start", "key", "title", "description", "metric", "target", "xp_reward", "icon", "active"], numeric: ["target", "xp_reward"], bool: ["active"] },
  seasons: { pk: "id", cols: ["id", "number", "name", "theme", "starts_on", "ends_on", "active"], numeric: ["number"], bool: ["active"] },
  season_tracks: { pk: "id", cols: ["id", "season_id", "tier", "req_xp", "free_reward", "premium_reward"], numeric: ["tier", "req_xp"], json: ["free_reward", "premium_reward"] },
  reward_catalog: { pk: "id", cols: ["id", "key", "name", "description", "type", "value", "cost_coins", "icon", "enabled", "sort_order"], numeric: ["cost_coins", "sort_order"], bool: ["enabled"], json: ["value"] },
  leaderboards: { pk: "id", cols: ["id", "key", "name", "period", "scope", "metric", "enabled", "sort_order"], numeric: ["sort_order"], bool: ["enabled"] },
  teams: { pk: "id", cols: ["id", "name", "description", "badge", "color", "points"], numeric: ["points"] },
};

function sanitize(table: string, input: Record<string, unknown>): Record<string, unknown> {
  const def = TABLES[table];
  const row: Record<string, unknown> = {};
  for (const c of def.cols) {
    if (!(c in input)) continue;
    let v = input[c];
    if (def.numeric?.includes(c)) v = v === "" || v == null ? 0 : Number(v);
    else if (def.bool?.includes(c)) v = !!v;
    else if (def.json?.includes(c)) { try { v = typeof v === "string" ? JSON.parse(v || "{}") : v; } catch { v = {}; } }
    else if (typeof v === "string" && v.trim() === "" && c !== def.pk) v = null;
    row[c] = v;
  }
  return row;
}

/** Bir gamification yapılandırma satırını ekler/günceller. */
export async function upsertGamRow(table: string, input: Record<string, unknown>): Promise<ActionResult> {
  await requireAdmin();
  const def = TABLES[table];
  if (!def) return fail("Geçersiz tablo.");
  const row = sanitize(table, input);
  if (!row[def.pk] && def.pk !== "id") return fail("Anahtar alanı zorunlu.");
  // id boşsa insert (yeni satır)
  const isNew = def.pk === "id" && !row.id;
  if (isNew) delete row.id;

  const supabase = createAdminClient();
  const { error } = isNew
    ? await supabase.from(table).insert(row)
    : await supabase.from(table).upsert(row, { onConflict: def.pk });
  if (error) return fail(error.message);
  revalidatePath("/admin/gamification");
  return { ok: true };
}

export async function deleteGamRow(table: string, id: string | number): Promise<ActionResult> {
  await requireAdmin();
  const def = TABLES[table];
  if (!def) return fail("Geçersiz tablo.");
  const supabase = createAdminClient();
  const { error } = await supabase.from(table).delete().eq(def.pk, id);
  if (error) return fail(error.message);
  revalidatePath("/admin/gamification");
  return { ok: true };
}

/** Tüm oyuncuların oyunlaştırma durumunu yeniden hesaplar (bakım aracı). */
export async function resyncAllPlayers(): Promise<ActionResult<{ count: number }>> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data } = await supabase.from("user_gamification").select("user_id");
  const ids = ((data as { user_id: string }[]) ?? []).map((r) => r.user_id);
  let count = 0;
  for (const id of ids) {
    const { error } = await supabase.rpc("sync_gamification", { p_user: id });
    if (!error) count++;
  }
  revalidatePath("/admin/gamification");
  return { ok: true, data: { count } };
}
