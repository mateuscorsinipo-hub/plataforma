import { BookOpenIcon, ChevronLeftIcon, ChevronRightIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";

import { MaterialCard, MaterialGrid } from "@/components/library/material-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { filtersToSearch, PAGE_SIZE, searchLibrary, type LibraryFilters } from "@/lib/data/library";
import { getSubjects } from "@/lib/data/subjects";
import { cn } from "@/lib/utils";

/** Atalhos por matéria: trocam só a matéria e voltam para a primeira página. */
export async function SubjectShortcuts({ filters, basePath }: { filters: LibraryFilters; basePath: string }) {
  const subjects = await getSubjects();
  const chip = (slug: string | null, label: string) => {
    const active = filters.subjectSlug === slug;
    return (
      <li key={slug ?? "todas"} className="shrink-0">
        <Link
          href={`${basePath}${filtersToSearch({ ...filters, subjectSlug: slug, page: 1 })}`}
          aria-current={active ? "page" : undefined}
          scroll={false}
          className={cn(
            "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors",
            active ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-card text-ink-2 hover:bg-muted",
          )}
        >
          {label}
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label="Matérias">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {chip(null, "Todas")}
        {subjects.map((s) => chip(s.slug, s.name))}
      </ul>
    </nav>
  );
}

export async function LibraryResults({
  filters,
  basePath,
  itemBasePath,
  publishHref,
}: {
  filters: LibraryFilters;
  basePath: string;
  itemBasePath: string;
  publishHref: string;
}) {
  const [{ items, total }, subjects] = await Promise.all([searchLibrary(filters), getSubjects()]);
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const hasFilters = Boolean(filters.q || filters.subjectSlug || filters.stage || filters.grade || filters.type || filters.topic);

  if (!items.length) {
    if (filters.page > 1) {
      return (
        <EmptyState
          icon={SearchXIcon}
          title="Esta página não existe"
          description="A busca tem menos páginas agora. Volte para o começo da lista."
          action={
            <Button asChild variant="outline">
              <Link href={`${basePath}${filtersToSearch({ ...filters, page: 1 })}`}>Ir para a primeira página</Link>
            </Button>
          }
        />
      );
    }
    return hasFilters ? (
      <EmptyState
        icon={SearchXIcon}
        title="Nenhum material encontrado"
        description="Tente outras palavras, tire algum filtro ou procure pelo tema em vez do título."
        action={
          <Button asChild variant="outline">
            <Link href={basePath}>Limpar filtros</Link>
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={BookOpenIcon}
        title="A biblioteca ainda está vazia"
        description="Os materiais publicados pela comunidade aparecem aqui. Que tal ser a primeira pessoa a compartilhar um resumo?"
        action={
          <Button asChild>
            <Link href={publishHref}>Publicar um material</Link>
          </Button>
        }
      />
    );
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (filters.page - 1) * PAGE_SIZE + 1;
  const end = start + items.length - 1;

  return (
    <section aria-label="Resultados" className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground" role="status">
        {total === 1 ? "1 material" : `${total.toLocaleString("pt-BR")} materiais`}
        {pages > 1 ? ` · mostrando ${start}–${end}` : ""}
      </p>
      <MaterialGrid>
        {items.map((m) => (
          <MaterialCard key={m.id} material={m} subject={subjectById.get(m.subjectId)} href={`${itemBasePath}/${m.slug}`} />
        ))}
      </MaterialGrid>
      {pages > 1 ? (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-3 pt-2">
          {filters.page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`${basePath}${filtersToSearch({ ...filters, page: filters.page - 1 })}`} rel="prev">
                <ChevronLeftIcon className="size-4" /> Anterior
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground tabular-nums">
            Página {filters.page} de {pages}
          </span>
          {filters.page < pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`${basePath}${filtersToSearch({ ...filters, page: filters.page + 1 })}`} rel="next">
                Próxima <ChevronRightIcon className="size-4" />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
