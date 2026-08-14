// ============================================================================
// AI sağlayıcı soyutlaması.
// Coach ve diğer AI özellikleri bu ortak arayüzü kullanır; sağlayıcı
// env `AI_PROVIDER` (openai | anthropic) ile seçilir. Anahtar yoksa null döner.
// ============================================================================

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// ---------------------------------------------------------------------------
// Araç çağırma (tool calling) — agent katmanı için.
//
// Sağlayıcılar farklı isimlendirme kullanıyor (OpenAI "function calling",
// Anthropic "tool use") ama sözleşme aynı: modele araç tanımları verilir,
// model çağrılacak aracı ve argümanlarını döndürür, sonuç geri beslenir.
// Bu tipler o ortak sözleşmedir; agent runtime sağlayıcıyı bilmez.
// ---------------------------------------------------------------------------

/** Modele sunulan araç tanımı. `parameters` düz JSON Schema'dır. */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** Modelin çağırmak istediği araç. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Bir araç çağrısının sonucu — modele geri beslenir. */
export interface ToolResult {
  id: string;
  name: string;
  content: string;
}

/**
 * Araç turunun çıktısı.
 * `toolCalls` doluysa model araç istiyor; boşsa `text` nihai yanıttır.
 */
export interface ToolTurn {
  text: string;
  toolCalls: ToolCall[];
  /** Modelin döndürdüğü ham asistan mesajı — bir sonraki tura aynen aktarılır. */
  raw?: unknown;
}

/** Araç turunda modele verilen konuşma öğesi. */
export type AgentTurnInput =
  | { kind: "message"; message: ChatMessage }
  | { kind: "assistant_tool_use"; raw: unknown; text: string; toolCalls: ToolCall[] }
  | { kind: "tool_results"; results: ToolResult[] };

export interface AIProvider {
  name: "openai" | "anthropic";
  /** Token token akış üretir. */
  streamChat(messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }): AsyncIterable<string>;
  /** Tek seferde tam yanıt döndürür (streaming olmayan işler için). */
  complete(messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<string>;
  /** Görsel (yemek fotoğrafı) analizi — vision destekli modeller. imageUrl erişilebilir olmalı. */
  analyzeImage?(imageUrl: string, prompt: string, opts?: { maxTokens?: number }): Promise<string>;
  /**
   * Araç destekli tek tur. Sağlayıcı bunu uygulamıyorsa agent runtime
   * araçsız akışa döner — yani eski davranış korunur.
   */
  chatWithTools?(
    turns: AgentTurnInput[],
    tools: ToolDefinition[],
    opts?: { temperature?: number; maxTokens?: number }
  ): Promise<ToolTurn>;
}

/**
 * Yapılandırılmış sağlayıcıyı döndürür. Uygun anahtar yoksa null.
 * Varsayılan: OpenAI. `AI_PROVIDER=anthropic` ile Claude'a geçilir.
 */
export function getAIProvider(): AIProvider | null {
  const preferred = (process.env.AI_PROVIDER || "openai").toLowerCase();

  if (preferred === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    // Lazy import — SDK sadece gerektiğinde yüklenir.
    // getAIProvider senkron; await import() imzayı değiştirip tüm çağrı
    // zincirini async yapardı. SDK yalnızca seçilen sağlayıcı için yüklensin.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createAnthropicProvider } = require("./anthropic");
    return createAnthropicProvider();
  }

  if (process.env.OPENAI_API_KEY) {
    // getAIProvider senkron; await import() imzayı değiştirip tüm çağrı
    // zincirini async yapardı. SDK yalnızca seçilen sağlayıcı için yüklensin.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createOpenAIProvider } = require("./openai");
    return createOpenAIProvider();
  }

  // Tercih anthropic ama openai anahtarı da yoksa, anthropic'i dene.
  if (process.env.ANTHROPIC_API_KEY) {
    // getAIProvider senkron; await import() imzayı değiştirip tüm çağrı
    // zincirini async yapardı. SDK yalnızca seçilen sağlayıcı için yüklensin.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createAnthropicProvider } = require("./anthropic");
    return createAnthropicProvider();
  }

  return null;
}
