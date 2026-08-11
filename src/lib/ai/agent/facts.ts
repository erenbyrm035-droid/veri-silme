import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AgentFact } from "./types";

// ============================================================================
// Yapılandırılmış kalıcı hafıza.
//
// SORUN: Eski hafıza (`ai_memory.summary`) tek bir metin yığınıydı ve her
// mesajda `.slice(-800)` ile kırpılıyordu. Yani kullanıcının 3 ay önce
// söylediği "dizim sakat" bilgisi sessizce SİLİNİYORDU. Kırpılan şeyin ne
// olduğu da bilinmiyordu.
//
// ÇÖZÜM: Her bilgi ayrı satır (`ai_facts`), kanonik anahtarla. Aynı bilgi
// tekrar gelirse güncellenir ve güveni artar; kırpılma yok, kaybolma yok.
// Geçici bilgiler (`expires_at`) kendiliğinden düşer.
//
// ESKİ SİSTEM KORUNUYOR: `ai_memory` tablosu ve `memoryToPrompt` olduğu gibi
// duruyor. Bu katman onun yerine geçmiyor, üstüne biniyor.
// ============================================================================

export type FactCategory =
  | "profile" | "goal" | "preference" | "injury"
  | "schedule" | "nutrition" | "social" | "other";

const CATEGORIES: FactCategory[] = [
  "profile", "goal", "preference", "injury",
  "schedule", "nutrition", "social", "other",
];

/** Anahtarı kanonik hale getirir: `Injury.Knee ` → `injury.knee`. */
export function canonicalKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

/** Kategori doğrulaması — model uydurursa "other"a düşer. */
export function safeCategory(v: unknown): FactCategory {
  const c = String(v ?? "").toLowerCase() as FactCategory;
  return CATEGORIES.includes(c) ? c : "other";
}

/** Süresi dolmamış tüm bilgileri güven sırasına göre getirir. */
export async function getFacts(userId: string, limit = 60): Promise<AgentFact[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_facts")
    .select("key, value, category, confidence, source")
    .eq("user_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("confidence", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as AgentFact[]).map((f) => ({ ...f, confidence: Number(f.confidence) }));
}

export interface RememberInput {
  key: string;
  value: string;
  category?: string;
  source?: "conversation" | "derived" | "profile" | "admin";
  confidence?: number;
  /** Kaç gün sonra unutulsun (geçici bilgiler için). */
  expiresInDays?: number;
}

/**
 * Bir bilgiyi kalıcı hafızaya yazar.
 *
 * RPC üzerinden yazıyoruz çünkü "tekrar teyit → güven artışı" mantığı orada
 * ve iki taraflı yazımda tutarsızlık olmasın. Dönüş: kayıt id'si ya da null.
 */
export async function rememberFact(
  userId: string,
  input: RememberInput
): Promise<string | null> {
  const key = canonicalKey(input.key);
  const value = String(input.value ?? "").trim().slice(0, 500);
  if (!key || !value) return null;

  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
      : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_ai_fact", {
    p_user: userId,
    p_key: key,
    p_value: value,
    p_category: safeCategory(input.category),
    p_source: input.source ?? "conversation",
    p_confidence: Math.min(1, Math.max(0, input.confidence ?? 0.8)),
    p_expires_at: expiresAt,
  });
  if (error) return null;
  return (data as string) ?? null;
}

/** Bir bilgiyi siler (kullanıcı "artık öyle değil" dediğinde). */
export async function forgetFact(userId: string, key: string): Promise<boolean> {
  const k = canonicalKey(key);
  if (!k) return false;
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_facts")
    .delete()
    .eq("user_id", userId)
    .eq("key", k);
  return !error;
}

/**
 * Profil verisinden türetilebilen bilgileri hafızaya yazar.
 *
 * NEDEN: Kullanıcı sakatlığını onboarding'de girdiyse, koça ayrıca söylemesi
 * beklenmemeli. `source='profile'` ile işaretleniyor ki agent bunun konuşmadan
 * değil veriden geldiğini bilsin — kullanıcıya "bana söylemiştin" demesin.
 *
 * Idempotent: aynı bilgi tekrar yazılırsa sadece `hit_count` artar.
 */
export async function syncFactsFromProfile(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("injuries, allergies, health_conditions, available_equipment, goal, experience")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return 0;
  const p = profile as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);

  const writes: RememberInput[] = [];
  const injuries = list(p.injuries);
  if (injuries.length) {
    writes.push({
      key: "injury.list", value: injuries.join(", "),
      category: "injury", source: "profile", confidence: 0.95,
    });
  }
  const allergies = list(p.allergies);
  if (allergies.length) {
    writes.push({
      key: "nutrition.allergies", value: allergies.join(", "),
      category: "nutrition", source: "profile", confidence: 0.95,
    });
  }
  const conditions = list(p.health_conditions);
  if (conditions.length) {
    writes.push({
      key: "profile.health_conditions", value: conditions.join(", "),
      category: "profile", source: "profile", confidence: 0.95,
    });
  }
  const equipment = list(p.available_equipment);
  if (equipment.length) {
    writes.push({
      key: "preference.equipment", value: equipment.join(", "),
      category: "preference", source: "profile", confidence: 0.9,
    });
  }

  let ok = 0;
  for (const w of writes) {
    if (await rememberFact(userId, w)) ok += 1;
  }
  return ok;
}
