import type { Metadata } from "next";
import { Suspense } from "react";

import { UrlToast } from "@/components/app-shell/url-toast";
import { requireStudent } from "@/lib/auth/session";

import { ChatPage, ChatSkeleton } from "./_components/chat-page";

export const metadata: Metadata = { title: "Tutor de IA" };

export default function TutorPage() {
  return (
    <>
      <Suspense>
        <UrlToast />
      </Suspense>
      <Suspense fallback={<ChatSkeleton />}>
        <NewConversation />
      </Suspense>
    </>
  );
}

async function NewConversation() {
  const { user } = await requireStudent("/app/tutor");
  return <ChatPage user={user} conversation={null} />;
}
