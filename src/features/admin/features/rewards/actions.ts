"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/features/users/guard";
import { rewardSchema, decisionSchema, type RewardFormValues } from "./schema";

export interface ActionResult<T = undefined> { ok: boolean; error?: string; data?: T }
const fail = (error: string): ActionResult<never> => ({ ok: false, error });

function rev(id?: string) {
  revalidatePath("/admin/rewards");
  revalidatePath("/rewards");
  if (id) revalidatePath(`/admin/rewards/${id}`);
}

/** Yeni ödül oluşturur. */
export async function createReward(input: RewardFormValues): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = rewardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reward_catalog")
    .insert({ ...parsed.data, updated_at: new Date().toISOString() })
    .select("id")
    .single();

  if (error) {
    // 23505 = benzersiz `key` ihlali
    if ((error as { code?: string }).code === "23505") return fail("Bu anahtar zaten kullanılıyor.");
    return fail(error.message);
  }
  rev();
  return { ok: true, data: { id: data.id as string } };
}

/** Mevcut ödülü günceller. */
export async function updateReward(id: string, input: RewardFormValues): Promise<ActionResult> {
  await requireAdmin();
  const parsed = rewardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("reward_catalog")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return fail(error.message);
  rev(id);
  return { ok: true };
}

/** Ödülü yayından kaldırır (silmez — geçmiş talepler bozulmasın). */
export async function toggleReward(id: string, enabled: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("reward_catalog")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(error.message);
  rev(id);
  return { ok: true };
}

/**
 * Talebi karara bağlar.
 *
 * İş kuralı `decide_reward_claim()` RPC'sinde: durum geçişi + olay günlüğü +
 * bildirim + (red/iptal ise) coin iadesi ve stok geri alımı, hepsi tek yerde.
 * RPC yetkiyi kendi içinde de doğrular (`has_admin_access`).
 */
export async function decideClaim(input: {
  claimId: string;
  status: "approved" | "rejected" | "delivered" | "cancelled" | "shipped";
  note?: string;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  // RPC `auth.uid()` kullandığı için oturumlu istemciyle çağrılır.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_reward_claim", {
    p_claim: parsed.data.claimId,
    p_status: parsed.data.status,
    p_note: parsed.data.note ?? null,
  });

  if (error) return fail(error.message);
  const r = (data ?? {}) as Record<string, unknown>;
  if (!r.ok) return fail((r.error as string) ?? "İşlem yapılamadı.");

  rev();
  return { ok: true };
}

/** Ödül görseli için imzalı yükleme yolu üretir (istemci doğrudan yükler). */
export async function rewardImagePath(key: string, ext: string): Promise<ActionResult<{ path: string }>> {
  await requireAdmin();
  const safeKey = key.replace(/[^a-z0-9_-]/gi, "").slice(0, 60) || "reward";
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "jpg";
  return { ok: true, data: { path: `${safeKey}/${crypto.randomUUID()}.${safeExt}` } };
}
