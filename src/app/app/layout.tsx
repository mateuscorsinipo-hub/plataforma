import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { MobileTabBar, SidebarNav } from "@/components/app-shell/sidebar-nav";
import { StudentGate } from "@/components/app-shell/student-gate";
import { TopbarWidgets, TopbarWidgetsSkeleton } from "@/components/app-shell/topbar-widgets";
import { Skeleton } from "@/components/ui/feedback";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-sidebar px-3 py-5 lg:flex print:hidden">
        <Link href="/app" className="mx-2 w-fit rounded-lg" aria-label="Grifo, início do app">
          <Logo size={30} />
        </Link>
        <SidebarNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6 lg:px-8 print:hidden">
          <Link href="/app" className="rounded-lg lg:hidden" aria-label="Grifo, início do app">
            <Logo size={28} wordmarkClassName="text-[1.35rem]" />
          </Link>
          <div className="hidden lg:block" />
          <Suspense fallback={<TopbarWidgetsSkeleton />}>
            <TopbarWidgets />
          </Suspense>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-12">
          <Suspense fallback={<PageSkeleton />}>
            <StudentGate>{children}</StudentGate>
          </Suspense>
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
