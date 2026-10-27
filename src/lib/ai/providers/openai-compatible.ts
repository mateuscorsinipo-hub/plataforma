import "server-only";

import OpenAI from "openai";
import { z } from "zod";

import { serverEnv } from "@/lib/env/server";
import { safeJson } from "@/lib/ai/json";
import {
  AIError,
  type AIProvider,
  type ChatMessage,
  type ContentPart,
  type ObjectRequest,
  type StreamEvent,
  type TextRequest,
  type Usage,
} from "@/lib/ai/types";

/**
 * Provedor para APIs no formato OpenAI Chat Completions (OpenAI, Maritaca, Groq,
 * Ollama, vLLM...). Recursos variam entre serviços, então só usamos o mínimo comum:
 * mensagens, streaming e saída em JSON validada aqui com Zod.
 */
let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!serverEnv.ai.openaiApiKey) throw new AIError("not_configured");
  if (!client) {
    client = new OpenAI({
      apiKey: serverEnv.ai.openaiApiKey,
      baseURL: serverEnv.ai.openaiBaseUrl,
      timeout: serverEnv.ai.timeoutMs,
      maxRetries: 2,
    });
  }
  return client;
}

const isOfficialOpenAI = () => !serverEnv.ai.openaiBaseUrl;

function modelFor(tier: "main" | "light" | undefined): string {
  return tier === "light" ? serverEnv.ai.modelLight : serverEnv.ai.model;
}

/** OpenAI exige `max_completion_tokens` nos modelos atuais; serviços compatíveis aceitam `max_tokens`. */
function tokenLimit(maxTokens: number) {
  return isOfficialOpenAI() ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens };
}

function toContent(content: string | ContentPart[]): string | OpenAI.Chat.ChatCompletionContentPart[] {
  if (typeof content === "string") return content;
  return content.map((part): OpenAI.Chat.ChatCompletionContentPart => {
    if (part.type === "text") return { type: "text", text: part.text };
    if (part.type === "image") return { type: "image_url", image_url: { url: `data:${part.mediaType};base64,${part.base64}` } };
    // PDFs como documento não fazem parte do formato comum entre serviços compatíveis.
    throw new AIError("bad_request", "Este provedor não lê PDFs diretamente.");
  });
}

function toMessages(system: string, messages: ChatMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  return [
    { role: "system", content: system },
    ...messages.map((message): OpenAI.Chat.ChatCompletionMessageParam =>
      message.role === "assistant"
        ? { role: "assistant", content: typeof message.content === "string" ? message.content : textOf(message.content) }
        : { role: "user", content: toContent(message.content) },
    ),
  ];
}

function textOf(parts: ContentPart[]): string {
  return parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
}

function usageOf(usage: OpenAI.CompletionUsage | null | undefined): Usage {
  const cached = usage?.prompt_tokens_details?.cached_tokens ?? 0;
  return {
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    cacheReadTokens: cached,
    cacheWriteTokens: 0,
  };
}

export function mapOpenAIError(error: unknown): AIError {
  if (error instanceof AIError) return error;
  if (error instanceof OpenAI.APIUserAbortError) return new AIError("cancelled");
  if (error instanceof OpenAI.APIConnectionTimeoutError) return new AIError("timeout");
  if (error instanceof OpenAI.RateLimitError) return new AIError("rate_limited");
  if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) {
    return new AIError("not_configured", "Credencial do provedor de IA inválida.");
  }
  if (error instanceof OpenAI.BadRequestError) {
    const message = error.message.toLowerCase();
    if (message.includes("context") || message.includes("too long") || message.includes("maximum")) {
      return new AIError("context_too_long");
    }
    return new AIError("bad_request");
  }
  if (error instanceof OpenAI.APIError) {
    if (error.status === 503 || error.status === 529) return new AIError("overloaded");
    return new AIError("provider_error");
  }
  if (error instanceof Error && error.name === "AbortError") return new AIError("cancelled");
  return new AIError("provider_error");
}

async function complete(request: TextRequest, extra: Partial<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming> = {}) {
  const openai = getClient();
  const response = await openai.chat.completions.create(
    {
      model: modelFor(request.tier),
      messages: toMessages(request.system, [{ role: "user", content: request.prompt }]),
      ...tokenLimit(request.maxTokens),
      ...extra,
    },
    { signal: request.signal },
  );
  const choice = response.choices[0];
  if (choice?.finish_reason === "content_filter") throw new AIError("refused");
  if (choice?.message.refusal) throw new AIError("refused");
  return { text: choice?.message.content ?? "", usage: usageOf(response.usage), model: response.model, finish: choice?.finish_reason };
}

export const openAICompatibleProvider: AIProvider = {
  id: "openai_compatible",
  get supportsImages() {
    return serverEnv.ai.openaiVision;
  },
  supportsPdf: false,

  async *streamChat(request): AsyncIterable<StreamEvent> {
    const openai = getClient();
    try {
      const stream = await openai.chat.completions.create(
        {
          model: modelFor(request.tier),
          messages: toMessages(request.system, request.messages),
          ...tokenLimit(request.maxTokens),
          stream: true,
          stream_options: { include_usage: true },
        },
        { signal: request.signal },
      );
      let usage: Usage | null = null;
      let model = modelFor(request.tier);
      let stopReason: string | null = null;
      for await (const chunk of stream) {
        model = chunk.model || model;
        if (chunk.usage) usage = usageOf(chunk.usage);
        const choice = chunk.choices[0];
        if (!choice) continue;
        if (choice.finish_reason) stopReason = choice.finish_reason;
        const text = choice.delta?.content;
        if (text) yield { type: "text", text };
      }
      if (stopReason === "content_filter") throw new AIError("refused");
      yield {
        type: "done",
        usage: usage ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        model,
        stopReason,
      };
    } catch (error) {
      throw mapOpenAIError(error);
    }
  },

  async generateObject<T>(request: ObjectRequest<T>) {
    const jsonSchema = z.toJSONSchema(request.schema);
    const schemaInstruction = `Responda somente com um objeto JSON válido que siga este JSON Schema:\n${JSON.stringify(jsonSchema)}`;
    const responseFormat: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming["response_format"] = isOfficialOpenAI()
      ? { type: "json_schema", json_schema: { name: request.schemaName, schema: jsonSchema as Record<string, unknown>, strict: false } }
      : { type: "json_object" };
    const base: TextRequest = { ...request, system: `${request.system}\n\n${schemaInstruction}` };

    try {
      const first = await complete(base, { response_format: responseFormat });
      if (first.finish === "length") throw new AIError("invalid_output", "Saída cortada pelo limite de tokens.");
      const parsed = safeJson(first.text, request.schema);
      if (parsed.ok) return { data: parsed.data, usage: first.usage, model: first.model };
      const retryPrompt: ContentPart[] = [
        ...(typeof request.prompt === "string" ? [{ type: "text" as const, text: request.prompt }] : request.prompt),
        { type: "text", text: `A resposta anterior não seguiu o formato exigido (${parsed.error}). Gere novamente seguindo exatamente o esquema.` },
      ];
      const second = await complete({ ...base, prompt: retryPrompt }, { response_format: responseFormat });
      const reparsed = safeJson(second.text, request.schema);
      if (!reparsed.ok) throw new AIError("invalid_output");
      return {
        data: reparsed.data,
        usage: {
          ...second.usage,
          inputTokens: first.usage.inputTokens + second.usage.inputTokens,
          outputTokens: first.usage.outputTokens + second.usage.outputTokens,
        },
        model: second.model,
      };
    } catch (error) {
      throw mapOpenAIError(error);
    }
  },

  async generateText(request) {
    try {
      const result = await complete(request);
      return { text: result.text, usage: result.usage, model: result.model };
    } catch (error) {
      throw mapOpenAIError(error);
    }
  },
};
