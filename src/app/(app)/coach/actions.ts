"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { approveAction, rejectAction, getPendingActions } from "@/lib/ai/agent/actions";
import { guardAction, LIMITS } from "@/lib/security/action-guard";
import type { AgentAction } from "@/lib/ai/agent/types";

// ============================================================================
// Koç öneri onayı — server action'lar.
//
// Agent'ın `sensitive` araçları (kalori/makro hedefi, program yoğunluğu)
// çalıştırılmadan `ai_actions`'a 'proposed' yazılır. Gerçek yazma ancak
// kullanıcı BURADAN onaylayınca olur.
//
// Her action `guardAction` ile hız sınırına tabi: bir hata ya da kötü niyetli
// istemci onay uç noktasını döngüye sokamasın.
// ============================================================================

async function requireUser(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function listProposals(): Promise<AgentAction[]> {
  const userId = await requireUser();
  if (!userId) return [];
  return getPendingActions(userId);
}

export interface DecisionState {
  ok: boolean;
  message: string;
}

export async function approveProposal(actionId: string): Promise<DecisionState> {
  const userId = await requireUser();
  if (!userId) return { ok: false, message: "Oturum bulunamadı." };

  const guard = await guardAction("agent:decide", userId, LIMITS.sensitive);
  if (!guard.ok) return { ok: false, message: guard.error ?? "Çok fazla istek." };

  const res = await approveAction(userId, actionId);
  if (res.ok) {
    // Onaylanan işlem profil/program verisini değiştirmiş olabilir.
    revalidatePath("/coach");
    revalidatePath("/dashboard");
    revalidatePath("/nutrition");
  }
  return res;
}

export async function rejectProposal(actionId: string): Promise<DecisionState> {
  const userId = await requireUser();
  if (!userId) return { ok: false, message: "Oturum bulunamadı." };

  const guard = await guardAction("agent:decide", userId, LIMITS.sensitive);
  if (!guard.ok) return { ok: false, message: guard.error ?? "Çok fazla istek." };

  const res = await rejectAction(userId, actionId);
  if (res.ok) revalidatePath("/coach");
  return res;
}
