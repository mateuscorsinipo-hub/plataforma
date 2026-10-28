import { UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ExplorerSkeleton, LibraryExplorer } from "@/components/library/library-explorer";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Biblioteca de resumos e materiais de estudo",
  description:
    "Resumos, mapas mentais, listas de exercícios e anotações compartilhados por estudantes, organizados por matéria, etapa e série.",
  alternates: { canonical: "/biblioteca" },
};

export default function LibraryPage({ searchParams }: PageProps<"/biblioteca">) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-2">
          <p className="text-sm font-semibold text-primary">Biblioteca da comunidade</p>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Materiais feitos por estudantes</h1>
          <p className="text-[0.9375rem] leading-relaxed text-ink-2">
            Resumos, mapas mentais, listas de exercícios e anotações. Quem publica declara ser autor do conteúdo; se algo estiver errado
            ou violar direitos, denuncie na página do material.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/biblioteca/pessoas">
              <UsersIcon className="size-4" /> Encontrar pessoas
            </Link>
          </Button>
          <Button asChild>
            <Link href="/app/materiais/novo">Publicar material</Link>
          </Button>
        </div>
      </header>
      <Suspense fallback={<ExplorerSkeleton />}>
        <LibraryExplorer searchParams={searchParams} basePath="/biblioteca" itemBasePath="/biblioteca" publishHref="/app/materiais/novo" />
      </Suspense>
    </div>
  );
}
