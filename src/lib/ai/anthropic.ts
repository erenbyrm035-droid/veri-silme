import Anthropic from "@anthropic-ai/sdk";
import type {
  AIProvider, ChatMessage, AgentTurnInput, ToolDefinition, ToolTurn,
} from "./provider";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";

/** system rolünü ayırır (Anthropic system'i ayrı parametre alır). */
function split(messages: ChatMessage[]) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  return { system, rest };
}

export function createAnthropicProvider(): AIProvider {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  return {
    name: "anthropic",

    async *streamChat(messages: ChatMessage[], opts) {
      const { system, rest } = split(messages);
      const stream = client.messages.stream({
        model: MODEL,
        system,
        max_tokens: opts?.maxTokens ?? 700,
        temperature: opts?.temperature ?? 0.7,
        messages: rest,
      });
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield event.delta.text;
        }
      }
    },

    async complete(messages: ChatMessage[], opts) {
      const { system, rest } = split(messages);
      const res = await client.messages.create({
        model: MODEL,
        system,
        max_tokens: opts?.maxTokens ?? 900,
        temperature: opts?.temperature ?? 0.7,
        messages: rest,
      });
      const block = res.content.find((b) => b.type === "text");
      return block && block.type === "text" ? block.text.trim() : "";
    },

    /**
     * Araç destekli tek tur (Anthropic tool use).
     *
     * OpenAI'dan farkı: system ayrı parametre, araç sonucu `user` rolünde
     * `tool_result` bloğu olarak gönderilir ve asistanın `tool_use` bloğu
     * içerik dizisi biçiminde geri verilir.
     */
    async chatWithTools(turns: AgentTurnInput[], tools: ToolDefinition[], opts): Promise<ToolTurn> {
      let system = "";
      const messages: Anthropic.MessageParam[] = [];

      for (const t of turns) {
        if (t.kind === "message") {
          if (t.message.role === "system") {
            system = system ? `${system}\n\n${t.message.content}` : t.message.content;
          } else {
            messages.push({ role: t.message.role, content: t.message.content });
          }
        } else if (t.kind === "assistant_tool_use") {
          // SDK'da birleşik "ContentBlockParam" adı yok; asistan içeriği
          // metin + tool_use bloklarından oluşur.
          messages.push({
            role: "assistant",
            content: t.raw as Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam>,
          });
        } else {
          messages.push({
            role: "user",
            content: t.results.map((r) => ({
              type: "tool_result" as const,
              tool_use_id: r.id,
              content: r.content,
            })),
          });
        }
      }

      const res = await client.messages.create({
        model: MODEL,
        system: system || undefined,
        max_tokens: opts?.maxTokens ?? 900,
        temperature: opts?.temperature ?? 0.4,
        messages,
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters as Anthropic.Tool.InputSchema,
        })),
      });

      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

      const toolCalls = res.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
        .map((b) => ({
          id: b.id,
          name: b.name,
          arguments: (b.input ?? {}) as Record<string, unknown>,
        }));

      // `raw` olarak içerik bloklarını döndürüyoruz; bir sonraki turda
      // asistan mesajı olarak aynen geri verilir (tool_use_id eşleşmesi için).
      return { text, toolCalls, raw: res.content };
    },

    async analyzeImage(imageUrl, prompt, opts) {
      // SDK yalnızca base64 kaynak desteklediğinden görseli indir.
      const resp = await fetch(imageUrl);
      const buf = Buffer.from(await resp.arrayBuffer());
      const ct = resp.headers.get("content-type") || "image/jpeg";
      const mediaType = (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(ct) ? ct : "image/jpeg") as
        "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: opts?.maxTokens ?? 500,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: buf.toString("base64") } },
              { type: "text", text: prompt },
            ],
          },
        ],
      });
      const block = res.content.find((b) => b.type === "text");
      return block && block.type === "text" ? block.text.trim() : "";
    },
  };
}
