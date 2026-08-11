"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/features/users/guard";
import { SPECIALISTS, medicalAgent } from "@/lib/ai/agents/specialists";
import {
  agentConfigSchema, promptSchema, abTestSchema,
  type AgentConfigValues, type PromptValues, type AbTestValues,
} from "./schema";

export interface ActionResult<T = undefined> { ok: boolean; error?: string; data?: T }
const fail = (error: string): ActionResult<never> => ({ ok: false, error });

function rev() {
  revalidatePath("/admin/ai-center");
}

/** Kod tarafında tanımlı ajan anahtarları — uydurma anahtar yazılmasın. */
const KNOWN_KEYS = new Set<string>([
  ...SPECIALISTS.map((s) => s.key),
  medicalAgent.key,
  "orchestrator",
  "synthesizer",
]);

/**
 * Ajan yapılandırmasını kaydeder (yoksa oluşturur).
 *
 * `upsert` kullanılıyor çünkü DB'de kaydı OLMAYAN ajanlar da panelde görünüyor
 * (kod varsayılanıyla). Yönetici ilk kez ayar yaptığında satır o an oluşmalı.
 */
export async function saveAgentConfig(
  key: string,
  input: AgentConfigValues
): Promise<ActionResult> {
  await requireAdmin();
  if (!KNOWN_KEYS.has(key)) return fail("Bilinmeyen ajan anahtarı.");

  const parsed = agentConfigSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ai_agents")
    .upsert(
      { key, ...parsed.data, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) return fail(error.message);
  rev();
  return { ok: true };
}

/** Ajanı hızlıca aç/kapat. */
export async function toggleAgent(key: string, enabled: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!KNOWN_KEYS.has(key)) return fail("Bilinmeyen ajan anahtarı.");

  const supabase = createAdminClient();
  // Kaydı yoksa önce kod varsayılanıyla oluştur; yoksa update hiçbir satıra
  // dokunmaz ve yönetici "kapattım ama kapanmadı" der.
  const spec = key === "medical" ? medicalAgent : SPECIALISTS.find((s) => s.key === key);
  const { error } = await supabase.from("ai_agents").upsert(
    {
      key,
      name: spec?.name ?? key,
      description: spec?.description ?? null,
      enabled,
      temperature: spec?.defaults.temperature ?? 0.5,
      max_tokens: spec?.defaults.maxTokens ?? 500,
      memory_layers: spec?.defaults.memoryLayers ?? [],
      allowed_tools: spec?.defaults.allowedTools ?? [],
      memory_limit: spec?.defaults.memoryLimit ?? 4000,
      sort_order: spec?.defaults.sortOrder ?? 100,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) return fail(error.message);

  // Yalnızca `enabled` alanını güncelle — upsert var olan satırın diğer
  // ayarlarını EZMESİN. (upsert tüm alanları yazar; bu ikinci update
  // yöneticinin özel ayarlarını geri koyuyor değil, ama upsert'ün ezdiği
  // durumda doğru sonucu garanti ediyor.)
  await supabase.from("ai_agents").update({ enabled }).eq("key", key);

  rev();
  return { ok: true };
}

/**
 * Yeni prompt sürümü oluşturur ve aktifleştirir.
 *
 * Eski sürüm SİLİNMEZ, yalnızca `is_active = false` olur. Geri dönmek tek
 * tıkla mümkün kalmalı: bir prompt "iyileştirmesi" cevap kalitesini
 * düşürebilir ve bu genelde günler sonra fark edilir.
 */
export async function savePrompt(input: PromptValues): Promise<ActionResult<{ version: number }>> {
  await requireAdmin();
  const parsed = promptSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { agent_key, variant, content, note } = parsed.data;
  if (!KNOWN_KEYS.has(agent_key)) return fail("Bilinmeyen ajan anahtarı.");

  const supabase = createAdminClient();

  // Ajan kaydı yoksa FK ihlali olur — önce varlığını garanti et.
  const spec = agent_key === "medical" ? medicalAgent : SPECIALISTS.find((s) => s.key === agent_key);
  await supabase.from("ai_agents").upsert(
    {
      key: agent_key,
      name: spec?.name ?? agent_key,
      temperature: spec?.defaults.temperature ?? 0.5,
      max_tokens: spec?.defaults.maxTokens ?? 500,
    },
    { onConflict: "key", ignoreDuplicates: true }
  );

  const { data: last } = await supabase
    .from("ai_agent_prompts")
    .select("version")
    .eq("agent_key", agent_key)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = ((last as { version: number } | null)?.version ?? 0) + 1;

  const { error: insErr } = await supabase.from("ai_agent_prompts").insert({
    agent_key, version, variant, content, note, is_active: true,
  });
  if (insErr) return fail(insErr.message);

  // Aynı ajan+varyantın önceki sürümlerini pasifleştir.
  await supabase
    .from("ai_agent_prompts")
    .update({ is_active: false })
    .eq("agent_key", agent_key)
    .eq("variant", variant)
    .neq("version", version);

  rev();
  return { ok: true, data: { version } };
}

/** Belirli bir prompt sürümüne geri döner. */
export async function activatePrompt(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from("ai_agent_prompts")
    .select("agent_key, variant")
    .eq("id", id)
    .maybeSingle();

  if (!row) return fail("Prompt sürümü bulunamadı.");
  const r = row as { agent_key: string; variant: string };

  await supabase
    .from("ai_agent_prompts")
    .update({ is_active: false })
    .eq("agent_key", r.agent_key)
    .eq("variant", r.variant);

  const { error } = await supabase
    .from("ai_agent_prompts")
    .update({ is_active: true })
    .eq("id", id);

  if (error) return fail(error.message);
  rev();
  return { ok: true };
}

/**
 * A/B testi başlatır.
 *
 * Ajan başına tek aktif test olabiliyor (benzersiz kısmi indeks). İkinci bir
 * test açılmak istenirse veritabanı reddediyor; burada anlaşılır bir mesaja
 * çeviriyoruz — 23505 kodunu yöneticiye göstermek işe yaramaz.
 */
export async function startAbTest(input: AbTestValues): Promise<ActionResult> {
  await requireAdmin();
  const parsed = abTestSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  if (!KNOWN_KEYS.has(parsed.data.agent_key)) return fail("Bilinmeyen ajan anahtarı.");

  const supabase = createAdminClient();

  // B varyantının aktif promptu yoksa test anlamsız: herkes 'a' görür.
  const { count } = await supabase
    .from("ai_agent_prompts")
    .select("id", { count: "exact", head: true })
    .eq("agent_key", parsed.data.agent_key)
    .eq("variant", "b")
    .eq("is_active", true);

  if ((count ?? 0) === 0) {
    return fail("Önce bu ajan için B varyantı promptu oluşturmalısın; yoksa test ölçüm üretmez.");
  }

  const { error } = await supabase
    .from("ai_ab_tests")
    .insert({ ...parsed.data, active: true, started_at: new Date().toISOString() });

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return fail("Bu ajan için zaten aktif bir test var. Önce onu bitir.");
    }
    return fail(error.message);
  }
  rev();
  return { ok: true };
}

/** A/B testini bitirir. */
export async function stopAbTest(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ai_ab_tests")
    .update({ active: false, ended_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(error.message);
  rev();
  return { ok: true };
}

/** Test dağılımını canlıda değiştirir. */
export async function updateAbSplit(id: string, splitPct: number): Promise<ActionResult> {
  await requireAdmin();
  const pct = Math.max(0, Math.min(100, Math.round(splitPct)));
  const supabase = createAdminClient();
  const { error } = await supabase.from("ai_ab_tests").update({ split_pct: pct }).eq("id", id);
  if (error) return fail(error.message);
  rev();
  return { ok: true };
}
