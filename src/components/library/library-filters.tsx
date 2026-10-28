"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/feedback";
import { Input, NativeSelect } from "@/components/ui/input";
import { gradeOptions, materialTypeLabels, schoolStageLabels, type SchoolStage } from "@/lib/config/subjects";

type SortOption = { key: string; label: string };

export type FilterValues = {
  q: string;
  materia: string;
  etapa: string;
  serie: string;
  tipo: string;
  tema: string;
  ordem: string;
};

/**
 * Filtros da biblioteca na URL (dá para compartilhar e voltar). Funciona como um
 * formulário GET comum sem JavaScript; com JavaScript, as listas aplicam na hora.
 */
export function LibraryFilters({
  basePath,
  values,
  subjects,
  sortOptions,
  defaultSort,
}: {
  basePath: string;
  values: FilterValues;
  subjects: { slug: string; name: string }[];
  sortOptions: SortOption[];
  defaultSort: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState(values.etapa);
  const grades = stage ? (gradeOptions[stage as SchoolStage] ?? []) : [];

  function apply(form: HTMLFormElement, changed?: string) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value !== "string" || !value.trim()) continue;
      if (key === "ordem" && value === defaultSort) continue;
      // Trocar a etapa invalida o ano escolhido antes.
      if (key === "serie" && changed === "etapa") continue;
      params.set(key, value.trim());
    }
    const query = params.toString();
    startTransition(() => router.push(`${basePath}${query ? `?${query}` : ""}`, { scroll: false }));
  }

  const hasFilters = Boolean(values.q || values.materia || values.etapa || values.serie || values.tipo || values.tema);

  return (
    <form
      role="search"
      action={basePath}
      method="get"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        apply(event.currentTarget);
      }}
      onChange={(event) => {
        const target = event.target as HTMLElement;
        if (target instanceof HTMLSelectElement) apply(event.currentTarget, target.name);
      }}
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="busca-biblioteca" className="sr-only">
            Buscar materiais
          </label>
          <Input
            id="busca-biblioteca"
            name="q"
            type="search"
            defaultValue={values.q}
            placeholder="Busque por tema, conteúdo ou título (ex.: função afim)"
            maxLength={120}
            className="pl-10"
            enterKeyHint="search"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner className="size-4" label="Buscando" /> : null}
          Buscar
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <label className="sr-only" htmlFor="filtro-materia">
          Matéria
        </label>
        <NativeSelect id="filtro-materia" name="materia" defaultValue={values.materia} className="h-10 text-sm">
          <option value="">Todas as matérias</option>
          {subjects.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <label className="sr-only" htmlFor="filtro-etapa">
          Etapa
        </label>
        <NativeSelect
          id="filtro-etapa"
          name="etapa"
          value={stage}
          onChange={(event) => setStage(event.target.value)}
          className="h-10 text-sm"
        >
          <option value="">Todas as etapas</option>
          {Object.entries(schoolStageLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <label className="sr-only" htmlFor="filtro-serie">
          Ano ou série
        </label>
        <NativeSelect
          id="filtro-serie"
          name="serie"
          key={stage}
          defaultValue={stage === values.etapa ? values.serie : ""}
          disabled={!grades.length}
          className="h-10 text-sm"
        >
          <option value="">{grades.length ? "Todos os anos" : "Ano ou série"}</option>
          {grades.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </NativeSelect>
        <label className="sr-only" htmlFor="filtro-tipo">
          Tipo de material
        </label>
        <NativeSelect id="filtro-tipo" name="tipo" defaultValue={values.tipo} className="h-10 text-sm">
          <option value="">Todos os tipos</option>
          {Object.entries(materialTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <label className="sr-only" htmlFor="filtro-tema">
          Tema
        </label>
        <Input id="filtro-tema" name="tema" defaultValue={values.tema} placeholder="Tema (opcional)" maxLength={80} className="h-10 text-sm" />
        <label className="sr-only" htmlFor="filtro-ordem">
          Ordenar por
        </label>
        <NativeSelect id="filtro-ordem" name="ordem" defaultValue={values.ordem || defaultSort} className="h-10 text-sm">
          {sortOptions.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => startTransition(() => router.push(basePath, { scroll: false }))}
        >
          <XIcon className="size-4" /> Limpar filtros
        </Button>
      ) : null}
    </form>
  );
}
