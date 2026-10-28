import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaff } from "@/lib/auth/session";

import { AdminNav } from "./_components/admin-nav";

export const metadata: Metadata = { title: { template: "%s · Administração", default: "Administração" }, robots: { index: false, follow: false } };

async function StaffNav() {
  const { isAdmin } = await requireStaff();
  return <AdminNav isAdmin={isAdmin} />;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="rounded-lg" aria-label="Administração do Grifo">
              <Logo size={28} />
            </Link>
            <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-bold text-background">Administração</span>
          </div>
          <Link href="/app" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="size-4" aria-hidden="true" /> Voltar ao app
          </Link>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8">
        <aside className="lg:sticky lg:top-24 lg:w-56 lg:shrink-0 lg:self-start">
          <Suspense fallback={<Skeleton className="h-10 lg:h-80" />}>
            <StaffNav />
          </Suspense>
        </aside>
        <main id="conteudo" className="min-w-0 flex-1 pb-16">
          <Suspense
            fallback={
              <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-64 rounded-2xl" />
              </div>
            }
          >
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
