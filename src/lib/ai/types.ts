import type { z } from "zod";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type ImageMediaType = "image/png" | "image/jpeg" | "image/webp";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: ImageMediaType; base64: string }
  /** PDF inteiro (lido como páginas de imagem pelo modelo). Só em provedores com `supportsPdf`. */
  | { type: "document"; mediaType: "application/pdf"; base64: string };

export type ChatMessage = {
  role: "user" | "assistant";
  content: string | ContentPart[];
};

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type StreamEvent =
  | { type: "thinking" }
  | { type: "text"; text: string }
  | { type: "done"; usage: Usage; model: string; stopReason: string | null };

export type AIErrorCode =
  | "not_configured"
  | "rate_limited"
  | "overloaded"
  | "refused"
  | "timeout"
  | "invalid_output"
  | "bad_request"
  | "context_too_long"
  | "cancelled"
  | "provider_error";

export class AIError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AIError";
  }
}

export type BaseRequest = {
  system: string;
  maxTokens: number;
  effort: Effort;
  signal?: AbortSignal;
  /** "main" (padrão) ou "light" para tarefas simples como títulos. */
  tier?: "main" | "light";
};

export type ChatRequest = BaseRequest & { messages: ChatMessage[] };

export type ObjectRequest<T> = BaseRequest & {
  prompt: string | ContentPart[];
  schema: z.ZodType<T>;
  schemaName: string;
};

export type TextRequest = BaseRequest & { prompt: string | ContentPart[] };

export interface AIProvider {
  readonly id: "anthropic" | "openai_compatible";
  readonly supportsImages: boolean;
  readonly supportsPdf: boolean;
  streamChat(request: ChatRequest): AsyncIterable<StreamEvent>;
  generateObject<T>(request: ObjectRequest<T>): Promise<{ data: T; usage: Usage; model: string }>;
  generateText(request: TextRequest): Promise<{ text: string; usage: Usage; model: string }>;
}

export const emptyUsage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

/** Mensagens exibidas ao estudante para cada falha (sem detalhes técnicos). */
export const aiErrorMessages: Record<AIErrorCode, string> = {
  not_configured: "Os recursos de IA ainda não foram configurados nesta instalação.",
  rate_limited: "Muitas pessoas usando a IA agora. Tente de novo em alguns segundos.",
  overloaded: "O serviço de IA está sobrecarregado. Tente novamente em instantes.",
  refused: "A IA não pôde responder a esse pedido. Reformule a pergunta com foco no conteúdo de estudo.",
  timeout: "A resposta demorou demais. Tente novamente com um pedido menor.",
  invalid_output: "A IA devolveu um resultado incompleto. Tente gerar de novo.",
  bad_request: "Não foi possível processar este pedido. Verifique o conteúdo enviado.",
  context_too_long: "O conteúdo é grande demais para uma só vez. Selecione menos arquivos ou um trecho menor.",
  cancelled: "Geração interrompida.",
  provider_error: "O serviço de IA falhou. Tente novamente em alguns minutos.",
};
