import { z } from "zod";
import { QUEST_METRIC_LABEL, EVENT_KIND_LABEL } from "./types";

// Enum listeleri types.ts'teki etiket haritalarından TÜRETİLİYOR — burada
// elle kopyalansaydı yeni bir metrik/etkinlik türü eklendiğinde şema sessizce
// geride kalır ve geçerli girdi reddedilirdi.
const questMetrics = Object.keys(QUEST_METRIC_LABEL) as [string, ...string[]];
const eventKinds = Object.keys(EVENT_KIND_LABEL) as [string, ...string[]];

// ============================================================================
// Takım girdilerinin doğrulaması.
//
// NEDEN: bu action'lardaki metin alanlarının hiçbirinde ÜST SINIR yoktu.
// İlgili kolonlar Postgres `text` — yani sınırsız. Server action'lar dışarıdan
// doğrudan POST edilebildiği için arayüzdeki `maxlength` koruma sayılmaz:
// bir betik tek istekte megabaytlarca metin yazabilir, bu da hem depolama hem
// de akışı çeken her sorgu için sorun olur.
//
// Sınırlar arayüzdeki alanların gerçek kullanımına göre seçildi; mevcut
// içeriği geçersiz kılacak kadar dar değil.
//
// Desen `features/admin/**/schema.ts` ile aynı.
// ============================================================================

/** Boşluğu kırpılmış, boşsa null'a dönen isteğe bağlı metin. */
const metin = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const createTeamSchema = z.object({
  name: z.string().trim().min(3, "Takım adı en az 3 karakter olmalı").max(60),
  description: metin(1000),
  city: metin(80),
  country: metin(80),
  joinPolicy: z.enum(["open", "request", "invite"]).optional(),
  // Renk arayüzde bir palet seçiciden geliyor; yine de biçim doğrulanıyor
  // çünkü değer doğrudan style'a giriyor.
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Renk #RRGGBB olmalı").optional(),
});

export const updateTeamSchema = z.object({
  name: z.string().trim().min(3, "Takım adı en az 3 karakter olmalı").max(60).optional(),
  description: metin(1000),
  rules: metin(4000),
  city: metin(80),
  country: metin(80),
  logo_url: z.string().trim().url().max(500).nullable().optional(),
  cover_url: z.string().trim().url().max(500).nullable().optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Renk #RRGGBB olmalı").optional(),
  join_policy: z.enum(["open", "request", "invite"]).optional(),
  visibility: z.enum(["public", "private"]).optional(),
});

/** Akış gönderisi — sosyal taraftaki 1000 karakter sınırıyla aynı. */
export const postBodySchema = z.string().trim().min(1, "Boş gönderi paylaşılamaz.").max(1000);

/** Yorum — gönderiden kısa. */
export const commentBodySchema = z.string().trim().min(1, "Yorum boş olamaz.").max(600);

export const messageSchema = z.object({
  body: z.string().trim().max(2000).optional(),
  kind: z.enum(["text", "image", "gif", "file", "voice", "workout", "meal"]).optional(),
  attachment: z.record(z.string(), z.unknown()).optional(),
  replyTo: z.string().uuid().nullable().optional(),
  // Bahsetme listesi: bildirim üretiyor, bu yüzden adet sınırı spam koruması.
  mentions: z.array(z.string().uuid()).max(50).optional(),
});

export const questSchema = z.object({
  title: z.string().trim().min(1, "Görev başlığı gerekli.").max(120),
  description: metin(1000),
  metric: z.enum(questMetrics),
  target: z.coerce.number().positive("Hedef 0'dan büyük olmalı.").max(1_000_000),
  rewardXp: z.coerce.number().int().min(0).max(10_000).optional(),
  endsOn: z.string().trim().nullable().optional(),
});

export const eventSchema = z.object({
  title: z.string().trim().min(1, "Etkinlik başlığı gerekli.").max(120),
  description: metin(1000),
  kind: z.enum(eventKinds),
  startsAt: z.string().trim().min(1, "Başlangıç zamanı gerekli."),
  endsAt: z.string().trim().nullable().optional(),
  location: metin(200),
});

/** Zod hatasını kullanıcıya gösterilecek tek satıra indirger. */
export function ilkHata(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Geçersiz giriş.";
}
