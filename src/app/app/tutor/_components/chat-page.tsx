import { Suspense } from "react";

import { Skeleton } from "@/components/ui/feedback";
import { getAIStatus } from "@/lib/ai/availability-notice";
import type { SessionUser } from "@/lib/auth/session";
import { getPlanForUser, getUsageSummary, getUserTimezone } from "@/lib/billing/entitlements";
import { listStudyFiles } from "@/lib/data/files";
import type { ChatMessageView } from "@/lib/data/tutor";
import type { FileSummary } from "@/lib/documents/summary";

import { ChatView } from "./chat-view";
import { ConversationSidebar } from "./conversation-sidebar";
import type { LocalMessage } from "./types";

function toLocal(message: ChatMessageView): LocalMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    status: message.status,
    attachments: message.attachments.map((a) => ({ fileId: a.fileId, name: a.name, url: a.url })),
    citations: message.citations,
    errorMessage: message.status === "error" ? "A resposta não foi concluída." : undefined,
  };
}

/** Carrega o necessário para o chat (estado da IA, consumo, biblioteca) e monta a tela. */
export async function ChatPage({
  user,
  conversation,
}: {
  user: SessionUser;
  conversation: { id: string; title: string; summary: string | null; messages: ChatMessageView[]; sources: FileSummary[] } | null;
}) {
  const [ai, plan, timezone] = await Promise.all([getAIStatus(), getPlanForUser(user.id), getUserTimezone(user.id)]);
  const [usage, files] = await Promise.all([
    getUsageSummary(user.id, plan, timezone),
    ai.available ? listStudyFiles({ limit: 80 }) : Promise.resolve([]),
  ]);
  const chat = usage.ai_chat_message;
  return (
    <ChatView
      key={conversation?.id ?? "nova"}
      conversationId={conversation?.id ?? null}
      title={conversation?.title ?? "Nova conversa"}
      summary={conversation?.summary ?? null}
      initialMessages={(conversation?.messages ?? []).map(toLocal)}
      initialSources={conversation?.sources ?? []}
      libraryFiles={files.filter((f) => f.status === "ready")}
      ai={ai}
      usage={{ remaining: chat.remaining, limit: chat.limit, window: chat.window }}
      maxSources={plan.maxSourcesPerSession}
      maxUploadBytes={plan.maxUploadBytes}
      mobileList={
        <Suspense fallback={<Skeleton className="m-4 h-40" />}>
          <ConversationSidebar mobile />
        </Suspense>
      }
    />
  );
}

export function ChatSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-busy="true" aria-label="Carregando conversa">
      <div className="border-b border-border p-4">
        <Skeleton className="h-7 w-56" />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="ml-auto h-12 w-2/3" />
        <Skeleton className="h-32 w-5/6" />
      </div>
      <div className="border-t border-border p-4">
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}
