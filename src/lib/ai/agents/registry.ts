import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { SPECIALISTS, medicalAgent } from "./specialists";
import type { AgentConfig, AgentKey, MemoryLayer } from "./types";
import { ALL_MEMORY_LAYERS } from "./types";

// ============================================================================
// AJAN YAPILANDIRMA KAYIT DEFTERİ
//
// İki kaynak birleşir:
//   1. KOD (specialists/*.ts)  → güvenli varsayılanlar, her zaman vardır
//   2. VERİTABANI (ai_agents)  → admin panelinden yapılan ayarlar, üstün gelir
//
// NEDEN İKİ KAYNAK: Sadece kod olsaydı her prompt denemesi dağıtım gerektirirdi.
// Sadece veritabanı olsaydı, migration çalışmamış ya da tablo boş bir ortamda
// sistem hiç çalışmazdı. Bu birleşim ikisinin de zayıf yanını kapatıyor:
// veritabanı erişilemese bile koç çalışmaya devam eder.
//
// `createAdminClient` kullanılıyor çünkü `ai_agents` RLS'i yalnızca admin'e
// açık; yapılandırmayı normal kullanıcı isteği sırasında da okumamız gerekiyor.
// Bu tablo kullanıcı verisi DEĞİL, ürün yapılandırması — okuma güvenli.
// ============================================================================

interface AgentRow {
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  model: string | null;
  temperature: number | string;
  max_tokens: number;
  memory_layers: string[] | null;
  allowed_tools: string[] | null;
  memory_limit: number;
  sort_order: number;
}

/** Kod varsayılanlarından bir yapılandırma üretir. */
function fromCode(key: AgentKey): AgentConfig | null {
  const spec = key === "medical" ? medicalAgent : SPECIALISTS.find((s) => s.key === key);
  if (!spec) return null;
  return {
    key,
    name: spec.name,
    description: spec.description,
    enabled: true,
    model: null,
    temperature: spec.defaults.temperature,
    maxTokens: spec.defaults.maxTokens,
    memoryLayers: spec.defaults.memoryLayers,
    allowedTools: spec.defaults.allowedTools,
    memoryLimit: spec.defaults.memoryLimit,
    sortOrder: spec.defaults.sortOrder,
    prompt: spec.prompt,
    variant: "a",
  };
}

const isLayer = (v: string): v is MemoryLayer =>
  (ALL_MEMORY_LAYERS as string[]).includes(v);

/** Veritabanı satırını kod varsayılanının üzerine bindirir. */
function merge(base: AgentConfig, row: AgentRow): AgentConfig {
  const layers = (row.memory_layers ?? []).filter(isLayer);
  return {
    ...base,
    name: row.name || base.name,
    description: row.description ?? base.description,
    enabled: row.enabled,
    model: row.model,
    temperature: Number(row.temperature),
    maxTokens: row.max_tokens,
    // Boş dizi "hiç katman/araç yok" anlamına GELİR ve geçerlidir; bu yüzden
    // `||` ile varsayılana düşmüyoruz — admin bilerek boşaltmış olabilir.
    memoryLayers: row.memory_layers ? layers : base.memoryLayers,
    allowedTools: row.allowed_tools ?? base.allowedTools,
    memoryLimit: row.memory_limit,
    sortOrder: row.sort_order,
  };
}

export interface LoadOptions {
  /** A/B varyantı seçimi için — verilmezse herkes 'a'. */
  userId?: string;
}

/**
 * Tüm ajanların çalıştırılabilir yapılandırmasını yükler.
 *
 * Veritabanı okunamazsa (migration yüklenmemiş, ağ hatası) sessizce kod
 * varsayılanlarına düşer. Koç çalışmaya devam eder — bu kasıtlı: bir
 * yapılandırma tablosunun erişilemez olması ürünü durdurmamalı.
 */
export async function loadAgentConfigs(opts: LoadOptions = {}): Promise<Map<AgentKey, AgentConfig>> {
  const out = new Map<AgentKey, AgentConfig>();

  // Önce kod varsayılanları — her koşulda dolu bir harita garanti.
  for (const spec of SPECIALISTS) {
    const cfg = fromCode(spec.key);
    if (cfg) out.set(spec.key, cfg);
  }

  try {
    const admin = createAdminClient();
    const [{ data: rows }, { data: prompts }] = await Promise.all([
      admin.from("ai_agents").select("*"),
      admin
        .from("ai_agent_prompts")
        .select("agent_key, variant, content, version")
        .eq("is_active", true),
    ]);

    for (const row of ((rows ?? []) as AgentRow[])) {
      const base = out.get(row.key as AgentKey) ?? fromCode(row.key as AgentKey);
      if (!base) continue; // DB'de kodda karşılığı olmayan ajan varsa yok say
      out.set(row.key as AgentKey, merge(base, row));
    }

    // A/B varyantı: kullanıcı başına kararlı atama (RPC'de hash ile).
    const variantByAgent = new Map<string, "a" | "b">();
    if (opts.userId) {
      const keys = [...out.keys()];
      const picks = await Promise.all(
        keys.map(async (k) => {
          const { data } = await admin.rpc("pick_prompt_variant", { p_agent: k, p_user: opts.userId });
          return [k, (data === "b" ? "b" : "a") as "a" | "b"] as const;
        })
      );
      for (const [k, v] of picks) variantByAgent.set(k, v);
    }

    type PromptRow = { agent_key: string; variant: string; content: string; version: number };
    const byKeyVariant = new Map<string, PromptRow>();
    for (const p of ((prompts ?? []) as PromptRow[])) {
      const k = `${p.agent_key}:${p.variant}`;
      const prev = byKeyVariant.get(k);
      if (!prev || p.version > prev.version) byKeyVariant.set(k, p);
    }

    for (const [key, cfg] of out) {
      const variant = variantByAgent.get(key) ?? "a";
      // İstenen varyantın aktif promptu yoksa 'a'ya, o da yoksa koda düş.
      const chosen = byKeyVariant.get(`${key}:${variant}`) ?? byKeyVariant.get(`${key}:a`);
      out.set(key, {
        ...cfg,
        variant: chosen?.variant === "b" ? "b" : "a",
        prompt: chosen?.content || cfg.prompt,
      });
    }
  } catch {
    // Kod varsayılanlarıyla devam.
  }

  return out;
}

/** Tek bir ajanın yapılandırması. */
export async function loadAgentConfig(
  key: AgentKey,
  opts: LoadOptions = {}
): Promise<AgentConfig | null> {
  const all = await loadAgentConfigs(opts);
  return all.get(key) ?? fromCode(key);
}

export { fromCode as codeDefaults };
