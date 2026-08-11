import { z } from "zod";
import { ALL_MEMORY_LAYERS } from "@/lib/ai/agents/types";

// ============================================================================
// AI Yönetim Merkezi — doğrulama şemaları.
//
// Sınırlar migration'daki CHECK kısıtlarıyla AYNI. İki yerde tanımlı olması
// tekrar gibi görünüyor ama kasıtlı: zod kullanıcıya anlaşılır Türkçe hata
// veriyor, CHECK ise veritabanını doğrudan yazan her yola karşı son savunma.
// Biri diğerinin yerine geçmez.
// ============================================================================

const layerEnum = z.enum(ALL_MEMORY_LAYERS as [string, ...string[]]);

export const agentConfigSchema = z.object({
  name: z.string().trim().min(2, "Ad en az 2 karakter").max(80),
  description: z.string().trim().max(300).optional().transform((v) => (v ? v : null)),
  enabled: z.coerce.boolean().default(true),
  model: z.string().trim().max(80).optional().transform((v) => (v ? v : null)),
  temperature: z.coerce.number().min(0, "En az 0").max(2, "En fazla 2"),
  max_tokens: z.coerce.number().int().min(50, "En az 50").max(4000, "En fazla 4000"),
  memory_layers: z.array(layerEnum).max(8),
  allowed_tools: z.array(z.string().trim().max(60)).max(40),
  memory_limit: z.coerce.number().int().min(200, "En az 200").max(40000, "En fazla 40000"),
  sort_order: z.coerce.number().int().min(0).max(999).default(100),
});
export type AgentConfigValues = z.input<typeof agentConfigSchema>;

export const promptSchema = z.object({
  agent_key: z.string().trim().min(2).max(40),
  variant: z.enum(["a", "b"]).default("a"),
  content: z.string().trim().min(30, "Prompt en az 30 karakter olmalı").max(20000),
  note: z.string().trim().max(200).optional().transform((v) => (v ? v : null)),
});
export type PromptValues = z.input<typeof promptSchema>;

export const abTestSchema = z.object({
  agent_key: z.string().trim().min(2).max(40),
  name: z.string().trim().min(3, "Test adı en az 3 karakter").max(120),
  split_pct: z.coerce.number().int().min(0, "En az 0").max(100, "En fazla 100"),
  note: z.string().trim().max(300).optional().transform((v) => (v ? v : null)),
});
export type AbTestValues = z.input<typeof abTestSchema>;
