import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

import { serverEnv } from "@/lib/env/server";
import { safeJson } from "@/lib/ai/json";
import {
  AIError,
  type AIProvider,
  type ChatRequest,
  type ContentPart,
  type ObjectRequest,
  type StreamEvent,
  type TextRequest,
  type Usage,
} from "@/lib/ai/types";

/**
 * Provedor Anthropic (SDK oficial). Padrão do Grifo.
 * - Pensamento adaptativo é sempre ativo nos modelos atuais: controlamos a
 *   profundidade com `output_config.effort` (nunca desativamos o pensamento).
 * - `fallbacks: "default"` reenvia ao modelo recomendado quando o classificador
 *   de segurança recusa um pedido legítimo.
 * - O histórico salvo contém só texto: blocos de pensamento não são reenviados.
 */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!serverEnv.ai.anthropicApiKey) throw new AIError("not_configured");
  if (!client) {
    client = new Anthropic({
      apiKey: serverEnv.ai.anthropicApiKey,
      timeout: serverEnv.ai.timeoutMs,
      maxRetries: 2,
    });
  }
  return client;
}

function modelFor(tier: "main" | "light" | undefined): string {
  return tier === "light" ? serverEnv.ai.modelLight : serverEnv.ai.model;
}

function toBlocks(content: string | ContentPart[]): Anthropic.Beta.BetaContentBlockParam[] | string {
  if (typeof content === "string") return content;
  return content.map((part): Anthropic.Beta.BetaContentBlockParam => {
    if (part.type === "text") return { type: "text", text: part.text };
    if (part.type === "image") return { type: "image", source: { type: "base64", media_type: part.mediaType, data: part.base64 } };
    return { type: "document", source: { type: "base64", media_type: part.mediaType, data: part.base64 } };
  });
}

function usageOf(usage: Anthropic.Beta.BetaUsage | undefined): Usage {
  return {
    inputTokens: (usage?.input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0),
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
  };
}

export function mapAnthropicError(error: unknown): AIError {
  if (error instanceof AIError) return error;
  if (error instanceof Anthropic.APIUserAbortError) return new AIError("cancelled");
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new AIError("timeout");
  if (error instanceof Anthropic.RateLimitError) return new AIError("rate_limited");
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AIError("not_configured", "Credencial do provedor de IA inválida.");
  }
  if (error instanceof Anthropic.BadRequestError) {
    const message = error.message.toLowerCase();
    if (message.includes("too long") || message.includes("context")) return new AIError("context_too_long");
    return new AIError("bad_request");
  }
  if (error instanceof Anthropic.APIError) {
    if (error.status === 529) return new AIError("overloaded");
    return new AIError("provider_error");
  }
  if (error instanceof Anthropic.AnthropicError && error.message.includes("Failed to parse structured output")) {
    return new AIError("invalid_output");
  }
  if (error instanceof Error && error.name === "AbortError") return new AIError("cancelled");
  return new AIError("provider_error");
}

export const anthropicProvider: AIProvider = {
  id: "anthropic",
  supportsImages: true,
  supportsPdf: true,

  async *streamChat(request: ChatRequest): AsyncIterable<StreamEvent> {
    const anthropic = getClient();
    const model = modelFor(request.tier);
    let stream: ReturnType<typeof anthropic.beta.messages.stream>;
    try {
      stream = anthropic.beta.messages.stream(
        {
          model,
          max_tokens: request.maxTokens,
          // Prompt de sistema estável + cache automático do histórico.
          system: [{ type: "text", text: request.system }],
          cache_control: { type: "ephemeral" },
          messages: request.messages.map((message) => ({ role: message.role, content: toBlocks(message.content) })),
          output_config: { effort: request.effort },
          betas: [FALLBACK_BETA],
          fallbacks: "default",
        },
        { signal: request.signal },
      );
    } catch (error) {
      throw mapAnthropicError(error);
    }

    let announcedThinking = false;
    try {
      for await (const event of stream) {
        if (event.type === "content_block_start" && event.content_block.type === "thinking" && !announcedThinking) {
          announcedThinking = true;
          yield { type: "thinking" };
        } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text", text: event.delta.text };
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") throw new AIError("refused");
      yield { type: "done", usage: usageOf(final.usage), model: final.model, stopReason: final.stop_reason };
    } catch (error) {
      throw mapAnthropicError(error);
    }
  },

  async generateObject<T>(request: ObjectRequest<T>) {
    const anthropic = getClient();
    const model = modelFor(request.tier);
    const attempt = async (extraInstruction?: string) => {
      const prompt = typeof request.prompt === "string" ? request.prompt : request.prompt;
      const content = extraInstruction
        ? [...(typeof prompt === "string" ? [{ type: "text" as const, text: prompt }] : prompt), { type: "text" as const, text: extraInstruction }]
        : prompt;
      // `.stream()` + `finalMessage()` evita estouro de tempo em respostas longas.
      const stream = anthropic.beta.messages.stream(
        {
          model,
          max_tokens: request.maxTokens,
          system: [{ type: "text", text: request.system }],
          messages: [{ role: "user", content: toBlocks(content) }],
          output_config: { effort: request.effort, format: betaZodOutputFormat(request.schema) },
          betas: [FALLBACK_BETA],
          fallbacks: "default",
        },
        { signal: request.signal },
      );
      const message = await stream.finalMessage();
      if (message.stop_reason === "refusal") throw new AIError("refused");
      if (message.stop_reason === "max_tokens") throw new AIError("invalid_output", "Saída cortada pelo limite de tokens.");
      const text = message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
      return { text, usage: usageOf(message.usage), model: message.model };
    };

    try {
      const first = await attempt();
      const parsed = safeJson(first.text, request.schema);
      if (parsed.ok) return { data: parsed.data, usage: first.usage, model: first.model };
      // Uma nova tentativa com o erro de validação como orientação.
      const second = await attempt(
        `A resposta anterior não seguiu o formato exigido (${parsed.error}). Gere novamente seguindo exatamente o esquema.`,
      );
      const reparsed = safeJson(second.text, request.schema);
      if (!reparsed.ok) throw new AIError("invalid_output");
      return {
        data: reparsed.data,
        usage: { ...second.usage, inputTokens: second.usage.inputTokens + first.usage.inputTokens, outputTokens: second.usage.outputTokens + first.usage.outputTokens },
        model: second.model,
      };
    } catch (error) {
      throw mapAnthropicError(error);
    }
  },

  async generateText(request: TextRequest) {
    const anthropic = getClient();
    try {
      const stream = anthropic.beta.messages.stream(
        {
          model: modelFor(request.tier),
          max_tokens: request.maxTokens,
          system: [{ type: "text", text: request.system }],
          messages: [{ role: "user", content: toBlocks(request.prompt) }],
          output_config: { effort: request.effort },
          betas: [FALLBACK_BETA],
          fallbacks: "default",
        },
        { signal: request.signal },
      );
      const message = await stream.finalMessage();
      if (message.stop_reason === "refusal") throw new AIError("refused");
      const text = message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
      return { text, usage: usageOf(message.usage), model: message.model };
    } catch (error) {
      throw mapAnthropicError(error);
    }
  },
};
