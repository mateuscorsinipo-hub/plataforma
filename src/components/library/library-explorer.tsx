import { Suspense } from "react";

import { LibraryFilters } from "@/components/library/library-filters";
import { LibraryResults, SubjectShortcuts } from "@/components/library/library-results";
import { Skeleton } from "@/components/ui/feedback";
import { defaultSortFor, filterFormValues, filtersToSearch, parseLibraryFilters, sortSelectOptions } from "@/lib/data/library";
import { getSubjects } from "@/lib/data/subjects";

export function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando materiais">
      <Skeleton className="h-5 w-32" />
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function ExplorerSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Carregando biblioteca">
      <Skeleton className="h-11" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
      <ResultsSkeleton />
    </div>
  );
}

/** Busca, filtros, atalhos por matéria e resultados: igual no site público e dentro do app. */
export async function LibraryExplorer({
  searchParams,
  basePath,
  itemBasePath,
  publishHref,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  basePath: string;
  itemBasePath: string;
  publishHref: string;
}) {
  const filters = parseLibraryFilters(await searchParams);
  const subjects = await getSubjects();
  return (
    <div className="flex flex-col gap-5">
      <LibraryFilters
        key={`filtros${filtersToSearch(filters)}`}
        basePath={basePath}
        values={filterFormValues(filters)}
        subjects={subjects.map((s) => ({ slug: s.slug, name: s.name }))}
        sortOptions={sortSelectOptions}
        defaultSort={defaultSortFor(filters)}
      />
      <SubjectShortcuts filters={filters} basePath={basePath} />
      <Suspense key={`resultados${filtersToSearch(filters)}`} fallback={<ResultsSkeleton />}>
        <LibraryResults filters={filters} basePath={basePath} itemBasePath={itemBasePath} publishHref={publishHref} />
      </Suspense>
    </div>
  );
}
