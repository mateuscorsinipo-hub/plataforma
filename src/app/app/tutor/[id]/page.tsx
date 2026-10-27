import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { requireStudent } from "@/lib/auth/session";
import { getConversation } from "@/lib/data/tutor";
import { uuidSchema } from "@/lib/validation/common";

import { ChatPage, ChatSkeleton } from "../_components/chat-page";

export const metadata: Metadata = { title: "Tutor de IA" };

export default function ConversationPage({ params }: PageProps<"/app/tutor/[id]">) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <Conversation params={params} />
    </Suspense>
  );
}

async function Conversation({ params }: { params: PageProps<"/app/tutor/[id]">["params"] }) {
  const { id } = await params;
  const { user } = await requireStudent(`/app/tutor/${id}`);
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) notFound();
  const data = await getConversation(parsed.data);
  if (!data) notFound();
  return (
    <ChatPage
      user={user}
      conversation={{
        id: data.conversation.id,
        title: data.conversation.title,
        summary: data.conversation.summary,
        messages: data.messages,
        sources: data.sources,
      }}
    />
  );
}
