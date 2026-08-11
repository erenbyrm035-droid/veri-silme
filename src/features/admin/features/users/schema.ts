import { z } from "zod";

export const membershipSchema = z.enum(["free", "premium", "trial", "lifetime"]);
export const adminRoleSchema = z.enum(["super_admin", "admin", "editor"]);

/** Premium ver / süre değiştir. */
export const premiumSchema = z.object({
  userId: z.string().uuid(),
  // ISO datetime veya boş (süresiz).
  until: z.string().datetime().nullable().optional(),
  membership: membershipSchema.optional(),
});

/** Rol değiştir. Boş string = rolü kaldır (normal kullanıcı). */
export const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.union([adminRoleSchema, z.literal("")]),
});

export const banSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export const idSchema = z.object({ userId: z.string().uuid() });

export const noteSchema = z.object({
  userId: z.string().uuid(),
  note: z.string().trim().min(1, "Not boş olamaz").max(2000),
});

export const noteIdSchema = z.object({
  noteId: z.string().uuid(),
  userId: z.string().uuid(),
});

/** Profil düzenleme (detay sayfası). */
export const profileSchema = z.object({
  userId: z.string().uuid(),
  full_name: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
});

export const avatarSchema = z.object({
  userId: z.string().uuid(),
  avatarUrl: z.string().url().nullable(),
});

/** Toplu işlemler. */
export const bulkSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, "En az bir kullanıcı seçin"),
});

export type PremiumInput = z.infer<typeof premiumSchema>;
export type RoleInput = z.infer<typeof roleSchema>;
export type BulkInput = z.infer<typeof bulkSchema>;
