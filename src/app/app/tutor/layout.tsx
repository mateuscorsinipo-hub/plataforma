import { Suspense } from "react";

import { ConversationSidebar, ListSkeleton } from "./_components/conversation-sidebar";

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mt-2 flex h-[calc(100dvh-12rem)] min-h-[30rem] gap-4 lg:h-[calc(100dvh-8rem)]">
      <aside className="hidden w-72 shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:block">
        <Suspense fallback={<ListSkeleton />}>
          <ConversationSidebar />
        </Suspense>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">{children}</section>
    </div>
  );
}
