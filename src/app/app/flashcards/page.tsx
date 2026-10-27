import { LayersIcon, PlayIcon, SparklesIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { UrlToast } from "@/components/app-shell/url-toast";
import { SubjectChip } from "@/components/brand/subject-chip";
import { SubjectSelect } from "@/components/learning/subject-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { listDecks } from "@/lib/data/flashcards";
import { getSubjectMap, getSubjects } from "@/lib/data/subjects";

import { NewDeckDialog } from "./_components/new-deck-dialog";

export const metadata: Metadata = { title: "Flashcards" };

export default function FlashcardsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense>
        <UrlToast />
      </Suspense>
      <Suspense fallback={<DecksSkeleton />}>
        <Decks />
      </Suspense>
    </div>
  );
}

async function Decks() {
  await requireStudent("/app/flashcards");
  const [decks, subjects, subjectMap] = await Promise.all([listDecks(), getSubjects(), getSubjectMap()]);
  const due = decks.reduce((sum, d) => sum + d.dueCount, 0);
  const fresh = decks.reduce((sum, d) => sum + d.newCount, 0);
  const subjectOptions = subjects.filter((s) => decks.some((d) => d.subjectId === s.id));

  return (
    <>
      <PageHeader
        eyebrow="Praticar"
        title="Flashcards"
        description="Revisão espaçada: cada cartão volta no momento certo para você não esquecer."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/app/estudio">
                <SparklesIcon /> Gerar com IA
              </Link>
            </Button>
            <NewDeckDialog subjects={subjects} />
          </>
        }
      />

      {decks.length ? (
        <Card className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardHeader>
            <CardTitle>{due + fresh > 0 ? `${due} para revisar e ${fresh} novos` : "Tudo em dia por hoje"}</CardTitle>
            <CardDescription>
              {due + fresh > 0 ? "A revisão rápida leva poucos minutos." : "Volte amanhã ou estude um baralho específico."}
            </CardDescription>
          </CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            {due + fresh > 0 ? (
              <Button asChild>
                <Link href="/app/flashcards/revisar?modo=rapida">
                  <PlayIcon /> Revisão rápida
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link href="/app/flashcards/revisar?modo=completa">Revisão completa</Link>
            </Button>
            {subjectOptions.length ? (
              <form action="/app/flashcards/revisar" className="flex items-center gap-2">
                <input type="hidden" name="modo" value="completa" />
                <label htmlFor="revisar-materia" className="sr-only">
                  Revisar por matéria
                </label>
                <SubjectSelect id="revisar-materia" name="materia" subjects={subjectOptions} emptyLabel="Por matéria…" required className="h-11 w-44" />
                <Button type="submit" variant="outline">
                  Revisar
                </Button>
              </form>
            ) : null}
          </div>
        </Card>
      ) : null}

      {decks.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {decks.map((deck) => {
            const subject = deck.subjectId ? subjectMap.get(deck.subjectId) : null;
            const pending = deck.dueCount + deck.newCount;
            return (
              <li key={deck.id}>
                <Card className="h-full gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/app/flashcards/${deck.id}`} className="min-w-0 font-display text-lg leading-snug font-bold hover:text-primary">
                      {deck.title}
                    </Link>
                    {pending ? <Badge variant="default">{pending} hoje</Badge> : <Badge variant="success">Em dia</Badge>}
                  </div>
                  {subject ? <SubjectChip subject={subject} size="sm" /> : null}
                  <p className="text-sm text-muted-foreground">
                    {deck.cardsCount} {deck.cardsCount === 1 ? "cartão" : "cartões"} · {deck.dueCount} para revisar · {deck.newCount} novos
                  </p>
                  <div className="mt-auto flex gap-2 pt-1">
                    {pending ? (
                      <Button size="sm" asChild>
                        <Link href={`/app/flashcards/revisar?baralho=${deck.id}&modo=completa`}>Revisar</Link>
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/app/flashcards/${deck.id}`}>Abrir</Link>
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={LayersIcon}
          title="Nenhum baralho ainda"
          description="Crie um baralho e escreva seus cartões, importe uma lista (frente;verso) ou gere cartões com IA a partir do seu material."
          action={
            <>
              <NewDeckDialog subjects={subjects} label="Criar baralho" />
              <Button variant="outline" asChild>
                <Link href="/app/estudio">
                  <SparklesIcon /> Gerar com IA
                </Link>
              </Button>
            </>
          }
        />
      )}
    </>
  );
}

function DecksSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando baralhos">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-28" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    </div>
  );
}
