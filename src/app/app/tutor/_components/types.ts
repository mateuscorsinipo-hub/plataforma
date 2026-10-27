import type { Citation } from "@/lib/ai/sources";

export type LocalAttachment = { fileId: string; name: string; url: string | null };

export type LocalMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "error" | "cancelled" | "streaming";
  attachments: LocalAttachment[];
  citations: Citation[];
  errorMessage?: string;
  /** Erro definitivo (ex.: limite atingido): não oferece "tentar novamente". */
  retryable?: boolean;
};

export type AIState = { available: boolean; supportsImages: boolean; notice: string | null };

export type UsageState = { remaining: number; limit: number; window: "day" | "month" };
