import { ChevronRightIcon, CircleAlertIcon, LoaderCircleIcon, SparklesIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { UrlToast } from "@/components/app-shell/url-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader, Skeleton } from "@/components/ui/feedback";
import { getAIStatus } from "@/lib/ai/availability-notice";
import { generationKinds, kindByName, maxCountFor, type GenerationKind } from "@/lib/ai/studio/kinds";
import { requireStudent } from "@/lib/auth/session";
import { getPlanForUser, getUsageSummary, getUserTimezone } from "@/lib/billing/entitlements";
import { listStudyFiles } from "@/lib/data/files";
import { listGenerations } from "@/lib/data/studio";
import { formatDateBR, localDateString } from "@/lib/domain/dates";

import { kindIcons } from "./_components/kind-icons";
import { StudioWorkspace } from "./_components/studio-workspace";

export const metadata: Metadata = { title: "Estúdio de IA" };

export default function StudioPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense>
        <UrlToast />
      </Suspense>
      <PageHeader
        eyebrow="Estúdio de IA"
        title="Transforme seu material em estudo"
        description="Envie arquivos ou fotos e gere resumos, guias, flashcards, quizzes e simulados a partir do seu próprio conteúdo."
      />
      <Suspense fallback={<StudioSkeleton />}>
        <Studio />
      </Suspense>
    </div>
  );
}

async function Studio() {
  const { user } = await requireStudent("/app/estudio");
  const [ai, plan, timezone, files, generations] = await Promise.all([
    getAIStatus(),
    getPlanForUser(user.id),
    getUserTimezone(user.id),
    listStudyFiles({ limit: 80 }),
    listGenerations(40),
  ]);
  const usage = await getUsageSummary(user.id, plan, timezone);
  const maxCounts = Object.fromEntries(generationKinds.map((k) => [k.kind, maxCountFor(k.kind, plan)])) as Record<GenerationKind, number>;
  const gen = usage.ai_generation;
  const proc = usage.file_processing;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        {!ai.available ? (
          <Alert tone="warning" title="Geração com IA indisponível">
            {ai.notice}
          </Alert>
        ) : null}
        <StudioWorkspace
          initialFiles={files}
          aiAvailable={ai.available}
          supportsImages={ai.supportsImages}
          maxSources={plan.maxSourcesPerSession}
          maxUploadBytes={plan.maxUploadBytes}
          maxCounts={maxCounts}
          generationsRemaining={gen.remaining}
        />
      </div>

      <aside className="flex flex-col gap-6">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="text-base">Seu uso ({plan.name})</CardTitle>
          </CardHeader>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Gerações {gen.window === "day" ? "hoje" : "no mês"}</dt>
              <dd className="font-semibold">
                {gen.used} de {gen.limit}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Arquivos processados {proc.window === "day" ? "hoje" : "no mês"}</dt>
              <dd className="font-semibold">
                {proc.used} de {proc.limit}
              </dd>
            </div>
          </dl>
          <p className="text-xs leading-relaxed text-muted-foreground">Texto colado não conta como arquivo processado.</p>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="text-base">Gerados recentemente</CardTitle>
          </CardHeader>
          {generations.length ? (
            <ul className="-mx-2 flex flex-col">
              {generations.map((g) => {
                const Icon = kindIcons[g.kind];
                return (
                  <li key={g.id}>
                    <Link href={`/app/estudio/${g.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-muted">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{g.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {kindByName[g.kind].label} · {formatDateBR(localDateString(timezone, new Date(g.createdAt)))}
                        </span>
                      </span>
                      {g.status === "failed" ? (
                        <Badge variant="danger">
                          <CircleAlertIcon /> Falhou
                        </Badge>
                      ) : g.status === "pending" ? (
                        <Badge variant="neutral">
                          <LoaderCircleIcon className="animate-spin" /> Gerando
                        </Badge>
                      ) : (
                        <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={SparklesIcon}
              title="Nada gerado ainda"
              description="Os materiais que você criar aparecem aqui."
              className="border-none bg-transparent px-0 py-6"
            />
          )}
        </Card>
      </aside>
    </div>
  );
}

function StudioSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]" aria-busy="true" aria-label="Carregando estúdio">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-72" />
        <Skeleton className="h-96" />
      </div>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
