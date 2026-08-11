import OpenAI from "openai";
import type {
  AIProvider, ChatMessage, AgentTurnInput, ToolDefinition, ToolTurn,
} from "./provider";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export function createOpenAIProvider(): AIProvider {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  return {
    name: "openai",

    async *streamChat(messages: ChatMessage[], opts) {
      const stream = await client.chat.completions.create({
        model: MODEL,
        temperature: opts?.temperature ?? 0.7,
        max_tokens: opts?.maxTokens ?? 700,
        stream: true,
        messages,
      });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
    },

    async complete(messages: ChatMessage[], opts) {
      const res = await client.chat.completions.create({
        model: MODEL,
        temperature: opts?.temperature ?? 0.7,
        max_tokens: opts?.maxTokens ?? 900,
        messages,
      });
      return res.choices[0]?.message?.content?.trim() ?? "";
    },

    /**
     * Araç destekli tek tur (OpenAI function calling).
     *
     * Konuşma geçmişi `AgentTurnInput` dizisi olarak gelir; burada OpenAI'ın
     * beklediği mesaj biçimine çevrilir. Modelin döndürdüğü asistan mesajı
     * `raw` olarak geri verilir ve bir sonraki turda AYNEN geçirilir — aksi
     * halde `tool_call_id` eşleşmez ve API hata verir.
     */
    async chatWithTools(turns: AgentTurnInput[], tools: ToolDefinition[], opts): Promise<ToolTurn> {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      for (const t of turns) {
        if (t.kind === "message") {
          messages.push({ role: t.message.role, content: t.message.content } as OpenAI.Chat.ChatCompletionMessageParam);
        } else if (t.kind === "assistant_tool_use") {
          messages.push(t.raw as OpenAI.Chat.ChatCompletionMessageParam);
        } else {
          for (const r of t.results) {
            messages.push({ role: "tool", tool_call_id: r.id, content: r.content });
          }
        }
      }

      const res = await client.chat.completions.create({
        model: MODEL,
        temperature: opts?.temperature ?? 0.4,
        max_tokens: opts?.maxTokens ?? 900,
        messages,
        tools: tools.map((t) => ({
          type: "function" as const,
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
        tool_choice: "auto",
      });

      const msg = res.choices[0]?.message;
      const calls = (msg?.tool_calls ?? []).flatMap((c) => {
        if (c.type !== "function") return [];
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(c.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          // Model bozuk JSON üretebilir; aracı boş argümanla çağırmak yerine
          // atlıyoruz — self-check katmanı eksik veriyi kullanıcıya söyler.
          return [];
        }
        return [{ id: c.id, name: c.function.name, arguments: args }];
      });

      return { text: msg?.content?.trim() ?? "", toolCalls: calls, raw: msg };
    },

    async analyzeImage(imageUrl, prompt, opts) {
      const res = await client.chat.completions.create({
        model: MODEL, // gpt-4o-mini vision destekler
        max_tokens: opts?.maxTokens ?? 500,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      });
      return res.choices[0]?.message?.content?.trim() ?? "";
    },
  };
}
