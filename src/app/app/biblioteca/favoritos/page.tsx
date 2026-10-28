import type { Metadata } from "next";
import { Suspense } from "react";

import { ResultsSkeleton } from "@/components/library/library-explorer";
import { LibraryTabs } from "@/components/library/library-tabs";
import { SavedList } from "@/components/library/saved-list";
import { PageHeader } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Favoritos" };

export default function FavoritesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Comunidade" title="Biblioteca" description="Seus materiais favoritos da comunidade." />
      <LibraryTabs active="favoritos" />
      <Suspense fallback={<ResultsSkeleton />}>
        <SavedList kind="favorite" />
      </Suspense>
    </div>
  );
}
