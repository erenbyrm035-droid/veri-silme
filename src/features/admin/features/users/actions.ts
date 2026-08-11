"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { AdminRole } from "@/lib/database.types";
import { requireAdmin, type AdminContext } from "./guard";
import { canActOnTarget, type AdminAction } from "./permissions";
import {
  premiumSchema,
  roleSchema,
  banSchema,
  idSchema,
  noteSchema,
  noteIdSchema,
  profileSchema,
  avatarSchema,
  bulkSchema,
} from "./schema";

export interface ActionResult {
  ok: boolean;
  error?: string;
  skipped?: number;
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}
const ok = (skipped = 0): ActionResult => ({ ok: true, skipped });

function revalidateUser(id?: string) {
  revalidatePath("/admin/users");
  if (id) revalidatePath(`/admin/users/${id}`);
}

/** Tek hedef için yetki + varlık kontrolü. */
async function authorizeTarget(
  ctx: AdminContext,
  userId: string,
  action: AdminAction
): Promise<{ id: string; admin_role: AdminRole | null } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, admin_role")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  const target = { id: data.id as string, admin_role: (data.admin_role as AdminRole) ?? null };
  if (!canActOnTarget(ctx.role, ctx.id, target, action)) return null;
  return target;
}

// ---------------------------------------------------------------------------
// PREMIUM
// ---------------------------------------------------------------------------
export async function setPremium(input: z.infer<typeof premiumSchema>): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = premiumSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const t = await authorizeTarget(ctx, parsed.data.userId, "premium");
  if (!t) return fail("Bu işlem için yetkiniz yok.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      is_premium: true,
      premium_until: parsed.data.until ?? null,
      membership_type: parsed.data.membership ?? "premium",
    })
    .eq("id", parsed.data.userId);
  if (error) return fail(error.message);
  revalidateUser(parsed.data.userId);
  return ok();
}

export async function removePremium(input: z.infer<typeof idSchema>): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const t = await authorizeTarget(ctx, parsed.data.userId, "premium");
  if (!t) return fail("Bu işlem için yetkiniz yok.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_premium: false, premium_until: null, membership_type: "free" })
    .eq("id", parsed.data.userId);
  if (error) return fail(error.message);
  revalidateUser(parsed.data.userId);
  return ok();
}

// ---------------------------------------------------------------------------
// ROL (yalnızca super_admin)
// ---------------------------------------------------------------------------
export async function setRole(input: z.infer<typeof roleSchema>): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz rol.");
  const t = await authorizeTarget(ctx, parsed.data.userId, "role");
  if (!t) return fail("Yalnızca Super Admin rol değiştirebilir.");

  const role = parsed.data.role === "" ? null : parsed.data.role;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ admin_role: role, is_admin: role !== null })
    .eq("id", parsed.data.userId);
  if (error) return fail(error.message);
  revalidateUser(parsed.data.userId);
  return ok();
}

// ---------------------------------------------------------------------------
// BAN / AKTİFLİK
// ---------------------------------------------------------------------------
export async function banUser(input: z.infer<typeof banSchema>): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = banSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const t = await authorizeTarget(ctx, parsed.data.userId, "ban");
  if (!t) return fail("Bu işlem için yetkiniz yok.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_banned: true, banned_at: new Date().toISOString(), ban_reason: parsed.data.reason ?? null })
    .eq("id", parsed.data.userId);
  if (error) return fail(error.message);
  revalidateUser(parsed.data.userId);
  return ok();
}

export async function unbanUser(input: z.infer<typeof idSchema>): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const t = await authorizeTarget(ctx, parsed.data.userId, "ban");
  if (!t) return fail("Bu işlem için yetkiniz yok.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_banned: false, banned_at: null, ban_reason: null })
    .eq("id", parsed.data.userId);
  if (error) return fail(error.message);
  revalidateUser(parsed.data.userId);
  return ok();
}

export async function setActive(
  input: z.infer<typeof idSchema> & { active: boolean }
): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const t = await authorizeTarget(ctx, parsed.data.userId, "active");
  if (!t) return fail("Bu işlem için yetkiniz yok.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: Boolean(input.active) })
    .eq("id", parsed.data.userId);
  if (error) return fail(error.message);
  revalidateUser(parsed.data.userId);
  return ok();
}

// ---------------------------------------------------------------------------
// SİLME (editor yapamaz)
// ---------------------------------------------------------------------------
export async function deleteUser(input: z.infer<typeof idSchema>): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const t = await authorizeTarget(ctx, parsed.data.userId, "delete");
  if (!t) return fail("Bu işlem için yetkiniz yok.");

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(parsed.data.userId);
  if (error) return fail(error.message);
  revalidateUser();
  return ok();
}

// ---------------------------------------------------------------------------
// ŞİFRE SIFIRLAMA MAİLİ
// ---------------------------------------------------------------------------
export async function sendPasswordReset(input: z.infer<typeof idSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");

  const admin = createAdminClient();
  const { data } = await admin.from("admin_users").select("email").eq("id", parsed.data.userId).maybeSingle();
  const email = (data as { email: string | null } | null)?.email;
  if (!email) return fail("Kullanıcının e-postası bulunamadı.");

  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: site ? `${site}/reset-password` : undefined,
  });
  if (error) return fail(error.message);
  return ok();
}

// ---------------------------------------------------------------------------
// NOTLAR
// ---------------------------------------------------------------------------
export async function addNote(input: z.infer<typeof noteSchema>): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = createAdminClient();
  const { error } = await supabase.from("admin_user_notes").insert({
    user_id: parsed.data.userId,
    author_id: ctx.id,
    author_name: ctx.fullName ?? ctx.email,
    note: parsed.data.note,
  });
  if (error) return fail(error.message);
  revalidateUser(parsed.data.userId);
  return ok();
}

export async function deleteNote(input: z.infer<typeof noteIdSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = noteIdSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("admin_user_notes").delete().eq("id", parsed.data.noteId);
  if (error) return fail(error.message);
  revalidateUser(parsed.data.userId);
  return ok();
}

// ---------------------------------------------------------------------------
// PROFİL / AVATAR
// ---------------------------------------------------------------------------
export async function updateUserProfile(input: z.infer<typeof profileSchema>): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const t = await authorizeTarget(ctx, parsed.data.userId, "view");
  if (!t) return fail("Bu işlem için yetkiniz yok.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name ?? null, phone: parsed.data.phone ?? null })
    .eq("id", parsed.data.userId);
  if (error) return fail(error.message);
  revalidateUser(parsed.data.userId);
  return ok();
}

export async function updateUserAvatar(input: z.infer<typeof avatarSchema>): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = avatarSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz görsel adresi.");
  const t = await authorizeTarget(ctx, parsed.data.userId, "view");
  if (!t) return fail("Bu işlem için yetkiniz yok.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: parsed.data.avatarUrl })
    .eq("id", parsed.data.userId);
  if (error) return fail(error.message);
  revalidateUser(parsed.data.userId);
  return ok();
}

// ---------------------------------------------------------------------------
// TOPLU İŞLEMLER
// ---------------------------------------------------------------------------
type BulkKind = "premium_on" | "premium_off" | "ban" | "unban" | "delete";

async function runBulk(
  ctx: AdminContext,
  userIds: string[],
  action: AdminAction,
  apply: (supabase: ReturnType<typeof createAdminClient>, id: string) => Promise<{ error: { message: string } | null }>
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("profiles").select("id, admin_role").in("id", userIds);
  const map = new Map((data ?? []).map((r: { id: string; admin_role: AdminRole | null }) => [r.id, r.admin_role]));

  let skipped = 0;
  for (const id of userIds) {
    const target = { id, admin_role: (map.get(id) as AdminRole) ?? null };
    if (!canActOnTarget(ctx.role, ctx.id, target, action)) {
      skipped++;
      continue;
    }
    const { error } = await apply(supabase, id);
    if (error) skipped++;
  }
  revalidateUser();
  return ok(skipped);
}

export async function bulkAction(
  input: z.infer<typeof bulkSchema> & { kind: BulkKind }
): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const ids = parsed.data.userIds;

  switch (input.kind) {
    case "premium_on":
      return runBulk(ctx, ids, "premium", (s, id) =>
        s.from("profiles").update({ is_premium: true, membership_type: "premium" }).eq("id", id)
      );
    case "premium_off":
      return runBulk(ctx, ids, "premium", (s, id) =>
        s.from("profiles").update({ is_premium: false, premium_until: null, membership_type: "free" }).eq("id", id)
      );
    case "ban":
      return runBulk(ctx, ids, "ban", (s, id) =>
        s.from("profiles").update({ is_banned: true, banned_at: new Date().toISOString() }).eq("id", id)
      );
    case "unban":
      return runBulk(ctx, ids, "ban", (s, id) =>
        s.from("profiles").update({ is_banned: false, banned_at: null, ban_reason: null }).eq("id", id)
      );
    case "delete":
      return runBulk(ctx, ids, "delete", async (s, id) => {
        const { error } = await s.auth.admin.deleteUser(id);
        return { error: error ? { message: error.message } : null };
      });
    default:
      return fail("Bilinmeyen işlem.");
  }
}
