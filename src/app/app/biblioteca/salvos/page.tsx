import type { Metadata } from "next";
import { Suspense } from "react";

import { ResultsSkeleton } from "@/components/library/library-explorer";
import { LibraryTabs } from "@/components/library/library-tabs";
import { SavedList } from "@/components/library/saved-list";
import { PageHeader } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Materiais salvos" };

export default function SavedPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Comunidade" title="Biblioteca" description="Materiais que você salvou para estudar depois." />
      <LibraryTabs active="salvos" />
      <Suspense fallback={<ResultsSkeleton />}>
        <SavedList kind="saved" />
      </Suspense>
    </div>
  );
}
