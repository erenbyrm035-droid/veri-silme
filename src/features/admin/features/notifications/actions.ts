"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/features/users/guard";

export interface ActionResult { ok: boolean; error?: string; sent?: number; }

const schema = z.object({
  title: z.string().trim().min(2, "Başlık en az 2 karakter").max(120),
  body: z.string().trim().max(500).optional(),
  href: z.string().trim().max(300).optional(),
  type: z.enum(["info", "workout", "nutrition", "achievement", "coach"]).default("info"),
  segment: z.enum(["all", "premium", "free", "admins"]).default("all"),
});

/** Seçili segmentteki tüm kullanıcılara bildirim gönderir (broadcast). */
export async function broadcastNotification(input: z.input<typeof schema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = createAdminClient();

  let q = supabase.from("profiles").select("id");
  if (parsed.data.segment === "premium") q = q.eq("is_premium", true);
  else if (parsed.data.segment === "free") q = q.eq("is_premium", false);
  else if (parsed.data.segment === "admins") q = q.not("admin_role", "is", null);
  const { data: users, error: uErr } = await q.limit(50000);
  if (uErr) return { ok: false, error: uErr.message };

  const ids = (users ?? []).map((u: { id: string }) => u.id);
  if (ids.length === 0) return { ok: true, sent: 0 };

  const rows = ids.map((id: string) => ({
    user_id: id, type: parsed.data.type, title: parsed.data.title,
    body: parsed.data.body || null, href: parsed.data.href || null,
  }));
  // Toplu ekleme (1000'lik parçalar).
  let sent = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    const { error } = await supabase.from("notifications").insert(chunk);
    if (!error) sent += chunk.length;
  }
  revalidatePath("/admin/notifications");
  return { ok: true, sent };
}
