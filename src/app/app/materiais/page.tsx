import { BookmarkIcon, EyeIcon, NotebookPenIcon, PlusIcon, StarIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { UrlToast } from "@/components/app-shell/url-toast";
import { SubjectChip } from "@/components/brand/subject-chip";
import { formatCount, formatRating } from "@/components/library/material-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { getPublishEligibility, listMyMaterials } from "@/lib/data/library";
import { getSubjectMap } from "@/lib/data/subjects";
import { formatDateBR } from "@/lib/domain/dates";
import { materialStatusLabels, visibilityLabels } from "@/lib/validation/materials";

import { MaterialRowActions } from "./_components/material-row-actions";
import { MaterialsTabs } from "./_components/materials-tabs";

export const metadata: Metadata = { title: "Meus materiais" };

const statusVariant = {
  draft: "neutral",
  pending_review: "warning",
  published: "success",
  rejected: "warning",
  removed: "danger",
} as const;

export default function MyMaterialsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense>
        <UrlToast />
      </Suspense>
      <PageHeader
        eyebrow="Comunidade"
        title="Meus materiais"
        description="Escreva resumos e listas, anexe arquivos e publique na biblioteca para ajudar outros estudantes."
        actions={
          <Button asChild>
            <Link href="/app/materiais/novo">
              <PlusIcon className="size-4" /> Novo material
            </Link>
          </Button>
        }
      />
      <MaterialsTabs active="materiais" />
      <Suspense
        fallback={
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando materiais">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        }
      >
        <MaterialsList />
      </Suspense>
    </div>
  );
}

async function MaterialsList() {
  const { user, profile } = await requireStudent("/app/materiais");
  const [materials, subjects, eligibility] = await Promise.all([listMyMaterials(user.id), getSubjectMap(), getPublishEligibility(profile)]);

  return (
    <>
      {!eligibility.allowed ? (
        <Alert
          tone="info"
          title="Publicar exige autorização"
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/app/configuracoes#privacidade">Pedir autorização</Link>
            </Button>
          }
        >
          Para publicar na biblioteca é preciso ter {eligibility.settings.minAgeWithoutGuardian} anos ou o consentimento de um responsável. Você
          pode escrever rascunhos e guardá-los como privados enquanto isso.
        </Alert>
      ) : null}
      {materials.length ? (
        <ul className="flex flex-col gap-3">
          {materials.map((m) => {
            const subject = subjects.get(m.subject_id);
            const rating = m.rating_count ? m.rating_sum / m.rating_count : null;
            return (
              <li key={m.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant[m.status]}>{materialStatusLabels[m.status]}</Badge>
                    <Badge variant="outline">{visibilityLabels[m.visibility]}</Badge>
                    {subject ? <SubjectChip subject={subject} size="sm" /> : null}
                  </div>
                  <Link
                    href={m.status === "removed" ? `/app/biblioteca/${m.slug}` : `/app/materiais/${m.id}/editar`}
                    className="font-display text-lg leading-snug font-bold hover:text-primary"
                  >
                    {m.title}
                  </Link>
                  {m.moderation_note && (m.status === "rejected" || m.status === "removed" || m.status === "pending_review") ? (
                    <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-text">
                      <span className="font-semibold">Moderação:</span> {m.moderation_note}
                    </p>
                  ) : null}
                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                    <span>Atualizado em {formatDateBR(m.updated_at.slice(0, 10), { day: "2-digit", month: "short", year: "numeric" })}</span>
                    {m.status === "published" ? (
                      <>
                        <span className="flex items-center gap-1">
                          <EyeIcon className="size-3.5" aria-hidden="true" /> {formatCount(m.views_count)} visualizações
                        </span>
                        <span className="flex items-center gap-1">
                          <BookmarkIcon className="size-3.5" aria-hidden="true" /> {formatCount(m.saves_count + m.favorites_count)} salvamentos
                        </span>
                        <span className="flex items-center gap-1">
                          <StarIcon className="size-3.5" aria-hidden="true" />
                          {rating !== null ? `${formatRating(rating)} (${m.rating_count})` : "sem avaliações"}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <MaterialRowActions id={m.id} slug={m.slug} title={m.title} status={m.status} visibility={m.visibility} />
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={NotebookPenIcon}
          title="Você ainda não publicou nada"
          description="Compartilhe um resumo, mapa mental ou lista de exercícios que você mesmo fez. Cada material publicado ajuda outros estudantes."
          action={
            <Button asChild>
              <Link href="/app/materiais/novo">Escrever o primeiro material</Link>
            </Button>
          }
        />
      )}
    </>
  );
}
