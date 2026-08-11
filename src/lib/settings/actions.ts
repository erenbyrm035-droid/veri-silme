"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { reportError } from "@/lib/observability/report-server";

export interface SettingsResult<T = undefined> { ok: boolean; error?: string; data?: T; }
const fail = (e: string): SettingsResult<never> => ({ ok: false, error: e });

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * GÜVENLİK: Şema `.strict()` — bilinmeyen anahtar REDDEDİLİR.
 *
 * Önceden gövde `{ user_id: user.id, ...payload }` şeklinde yazılıyordu.
 * TypeScript tipi çalışma zamanında silindiği için, hazırlanmış bir server
 * action çağrısı `payload.user_id` göndererek pinlenen değeri EZEBİLİYORDU —
 * yani başka bir kullanıcının ayar satırına yazılabiliyordu. Artık yalnızca
 * doğrulanmış alanlar geçiyor ve `user_id` spread'den SONRA yazılıyor.
 */
const settingsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).optional(),
  locale: z.enum(["tr", "en"]).optional(),
  units: z.enum(["metric", "imperial"]).optional(),
  notif_prefs: z.record(z.string(), z.boolean()).optional(),
  privacy: z.record(z.string(), z.boolean()).optional(),
}).strict();

export type SettingsPayload = z.infer<typeof settingsSchema>;

/** Kullanıcı ayarlarını kaydeder (upsert). */
export async function saveUserSettings(payload: SettingsPayload): Promise<SettingsResult> {
  const user = await requireUser();
  if (!user) return fail("Oturum bulunamadı.");

  const parsed = settingsSchema.safeParse(payload);
  if (!parsed.success) return fail("Geçersiz ayar verisi.");

  const admin = createAdminClient();
  const { error } = await admin.from("user_settings").upsert(
    { ...parsed.data, user_id: user.id, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) return fail(error.message);
  revalidatePath("/settings");
  return { ok: true };
}

/** KVKK/GDPR: kullanıcının tüm verisini JSON olarak toplar. */
export async function exportMyData(): Promise<SettingsResult<string>> {
  const user = await requireUser();
  if (!user) return fail("Oturum bulunamadı.");
  const admin = createAdminClient();

  const uid = user.id;
  const ownTables = [
    "profiles", "workouts", "nutrition_logs", "water_logs", "body_measurements",
    "posture_analyses", "personal_records", "ai_conversations", "user_gamification",
    "achievement_progress", "xp_logs", "user_settings", "reward_claims",
  ];
  const bundle: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: { id: uid, email: user.email },
  };
  try {
    for (const t of ownTables) {
      const col = t === "profiles" ? "id" : "user_id";
      const { data } = await admin.from(t).select("*").eq(col, uid);
      bundle[t] = data ?? [];
    }
    return { ok: true, data: JSON.stringify(bundle, null, 2) };
  } catch (err) {
    await reportError(err, { where: "settings/exportMyData", userId: uid });
    return fail("Veri dışa aktarılamadı.");
  }
}

/** KVKK/GDPR: hesabı ve tüm verileri kalıcı olarak siler (geri alınamaz). */
export async function deleteMyAccount(reason?: string): Promise<SettingsResult> {
  const user = await requireUser();
  if (!user) return fail("Oturum bulunamadı.");
  const admin = createAdminClient();
  try {
    // Denetim kaydı (auth kullanıcısı silinince cascade ile bu da gider; yine de deneriz)
    await admin.from("account_deletion_requests").insert({ user_id: user.id, reason: reason ?? null, status: "processed", processed_at: new Date().toISOString() });
    // auth kullanıcısını sil → tüm FK'ler on delete cascade ile temizlenir.
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return fail(error.message);
    // Oturumu düşür.
    const supabase = await createClient();
    await supabase.auth.signOut();
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "settings/deleteMyAccount", userId: user.id, severity: "error" });
    return fail("Hesap silinemedi. Lütfen destek ile iletişime geç.");
  }
}
