import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getTool, parseArgs } from "./tools";
import type { AgentAction } from "./types";

// ============================================================================
// ÖNERİ ONAY AKIŞI
//
// `sensitive` araçlar agent döngüsünde ÇALIŞTIRILMAZ; `ai_actions`'a
// 'proposed' olarak yazılır. Kullanıcı onaylayınca gerçek yazma BURADA olur.
//
// KRİTİK: Argümanlar çalıştırma anında ZOD İLE TEKRAR DOĞRULANIR. Öneri
// kaydedildiğinde de doğrulanmıştı ama arada şema değişmiş olabilir ya da
// kayıt elle düzenlenmiş olabilir. Yazma işleminden hemen önceki doğrulama,
// güvenilebilecek tek doğrulamadır.
//
// RLS: `createClient()` (kullanıcının kendi oturumu) kullanılıyor. Bir kullanıcı
// başkasının önerisini onaylayamaz — sorgu `user_id` eşleşmesi arıyor ve RLS
// zaten satırı göstermiyor.
// ============================================================================

/** Onay bekleyen işlemler (UI'da kart olarak gösterilir). */
export async function getPendingActions(userId: string, limit = 5): Promise<AgentAction[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_actions")
    .select("id, tool, args, result, status, summary, error, created_at")
    .eq("user_id", userId)
    .eq("status", "proposed")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AgentAction[];
}

/** Son işlem geçmişi — "kalorimi kim değiştirdi" sorusunun cevabı. */
export async function getRecentActions(userId: string, limit = 20): Promise<AgentAction[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_actions")
    .select("id, tool, args, result, status, summary, error, created_at")
    .eq("user_id", userId)
    .neq("status", "proposed")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AgentAction[];
}

export interface DecisionResult {
  ok: boolean;
  message: string;
}

/** Öneriyi uygular. */
export async function approveAction(userId: string, actionId: string): Promise<DecisionResult> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("ai_actions")
    .select("id, tool, args, status")
    .eq("id", actionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !row) return { ok: false, message: "Öneri bulunamadı." };
  const action = row as { id: string; tool: string; args: Record<string, unknown>; status: string };

  // Zaten karara bağlanmışsa tekrar çalıştırma — çift onay çift yazma yapmasın.
  if (action.status !== "proposed") {
    return { ok: false, message: "Bu öneri zaten karara bağlanmış." };
  }

  const tool = getTool(action.tool);
  if (!tool) {
    await fail(supabase, actionId, "Araç artık mevcut değil.");
    return { ok: false, message: "Bu öneriye ait araç artık mevcut değil." };
  }

  const parsed = parseArgs(tool, action.args ?? {});
  if (!parsed.ok) {
    await fail(supabase, actionId, `Argümanlar geçersiz: ${parsed.error}`);
    return { ok: false, message: "Önerinin verileri artık geçerli değil, koçtan yeniden önermesini iste." };
  }

  try {
    const out = await tool.run({ userId }, parsed.args as Record<string, unknown>);
    await supabase
      .from("ai_actions")
      .update({
        status: out.ok ? "approved" : "failed",
        result: out.result ?? {},
        error: out.ok ? null : out.content,
        decided_at: new Date().toISOString(),
      })
      .eq("id", actionId)
      .eq("user_id", userId);

    return { ok: out.ok, message: out.ok ? out.summary ?? out.content : out.content };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await fail(supabase, actionId, msg);
    return { ok: false, message: `Uygulanamadı: ${msg}` };
  }
}

/** Öneriyi reddeder — hiçbir veri değişmez. */
export async function rejectAction(userId: string, actionId: string): Promise<DecisionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_actions")
    .update({ status: "rejected", decided_at: new Date().toISOString() })
    .eq("id", actionId)
    .eq("user_id", userId)
    .eq("status", "proposed");

  if (error) return { ok: false, message: "Reddedilemedi." };
  return { ok: true, message: "Öneri reddedildi, hiçbir şey değişmedi." };
}

async function fail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actionId: string,
  message: string
): Promise<void> {
  await supabase
    .from("ai_actions")
    .update({ status: "failed", error: message, decided_at: new Date().toISOString() })
    .eq("id", actionId);
}
