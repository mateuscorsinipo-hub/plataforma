import { NotebookPenIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ExplorerSkeleton, LibraryExplorer } from "@/components/library/library-explorer";
import { LibraryTabs } from "@/components/library/library-tabs";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Biblioteca" };

export default function AppLibraryPage({ searchParams }: PageProps<"/app/biblioteca">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Comunidade"
        title="Biblioteca"
        description="Materiais publicados por estudantes. Salve os que quiser revisar e guarde em pastas."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/biblioteca/pessoas">
                <UsersIcon className="size-4" /> Pessoas
              </Link>
            </Button>
            <Button asChild>
              <Link href="/app/materiais/novo">
                <NotebookPenIcon className="size-4" /> Publicar
              </Link>
            </Button>
          </>
        }
      />
      <LibraryTabs active="explorar" />
      <Suspense fallback={<ExplorerSkeleton />}>
        <Explorer searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Explorer({ searchParams }: { searchParams: PageProps<"/app/biblioteca">["searchParams"] }) {
  await requireStudent("/app/biblioteca");
  return <LibraryExplorer searchParams={searchParams} basePath="/app/biblioteca" itemBasePath="/app/biblioteca" publishHref="/app/materiais/novo" />;
}
