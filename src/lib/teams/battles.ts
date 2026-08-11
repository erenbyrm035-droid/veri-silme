import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { BattleMetric, BattleSide, BattleStatus, BattleView, Opponent } from "./types";

export type { BattleMetric, BattleStatus, BattleView, Opponent } from "./types";
export { BATTLE_METRIC_LABEL } from "./types";

// ============================================================================
// Takım savaşları — sunucu katmanı.
//
// Skor hesabı ve süresi dolan savaşın kapatılması `battle_state()` RPC'sinde
// (migration 0045). Kapanış "lazy finalize": sayfa her açıldığında durum
// kendini düzeltir. Sebebi Vercel Hobby'de günde tek cron hakkı olması ve onun
// etkinlik hatırlatıcısında kullanılıyor olması.
// ============================================================================

type Row = Record<string, unknown>;
type TeamRow = Opponent;

/**
 * Bir takımın savaşları — aktif/bekleyen önce, sonra geçmiş.
 *
 * Skorlar `battle_state()` ile tazelenir; N savaş için N RPC çağrısı olur ama
 * pratikte bu sayı tek haneli (aktif + son birkaç geçmiş).
 */
export async function getTeamBattles(teamId: string, limit = 10): Promise<BattleView[]> {
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("team_battles")
    .select("id, team_a, team_b, metric, status, starts_at, ends_at, score_a, score_b, winner_id")
    .or(`team_a.eq.${teamId},team_b.eq.${teamId}`)
    .order("ends_at", { ascending: false })
    .limit(limit);

  const battles = (rows as Row[]) ?? [];
  if (battles.length === 0) return [];

  // Devam eden savaşların skorlarını tazele (bitmişlerde kayıtlı skor yeterli).
  const live = battles.filter((b) => b.status === "active" || b.status === "pending");
  const refreshed = new Map<string, Row>();
  if (live.length) {
    const results = await Promise.all(
      live.map((b) => admin.rpc("battle_state", { p_battle: b.id as string }))
    );
    results.forEach((r, i) => {
      const d = r.data as Row | null;
      if (d?.ok) refreshed.set(live[i].id as string, d);
    });
  }

  const teamIds = [...new Set(battles.flatMap((b) => [b.team_a as string, b.team_b as string]))];
  const { data: teamRows } = await admin
    .from("teams").select("id, name, slug, logo_url, color, badge").in("id", teamIds);
  const teams = new Map(((teamRows as TeamRow[]) ?? []).map((t) => [t.id, t]));

  const side = (id: string, score: number): BattleSide => {
    const t = teams.get(id);
    return {
      id,
      name: t?.name ?? "Takım",
      slug: t?.slug ?? "",
      logo_url: t?.logo_url ?? null,
      color: t?.color ?? null,
      badge: t?.badge ?? null,
      score,
    };
  };

  return battles.map((b) => {
    const fresh = refreshed.get(b.id as string) ?? b;
    const aIsUs = b.team_a === teamId;
    const scoreA = Number(fresh.score_a) || 0;
    const scoreB = Number(fresh.score_b) || 0;
    const status = ((fresh.status as BattleStatus) ?? "pending");
    const winner = (fresh.winner_id as string) ?? null;

    return {
      id: b.id as string,
      metric: ((b.metric as BattleMetric) ?? "xp"),
      status,
      starts_at: b.starts_at as string,
      ends_at: b.ends_at as string,
      us: side(teamId, aIsUs ? scoreA : scoreB),
      them: side((aIsUs ? b.team_b : b.team_a) as string, aIsUs ? scoreB : scoreA),
      winner_id: winner,
      we_won: status === "finished" ? (winner ? winner === teamId : null) : null,
      is_challenger: aIsUs,
    };
  });
}

/** Savaş açılabilecek takımlar (kendisi hariç, üyesi olan takımlar). */
export async function listBattleOpponents(teamId: string, limit = 30): Promise<TeamRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("teams")
    .select("id, name, slug, logo_url, color, badge")
    .neq("id", teamId)
    .order("level", { ascending: false })
    .limit(limit);
  return (data as TeamRow[]) ?? [];
}
