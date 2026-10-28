import { CalendarClockIcon, FolderIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { UrlToast } from "@/components/app-shell/url-toast";
import { SubjectChip } from "@/components/brand/subject-chip";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { getUserTimezone } from "@/lib/billing/entitlements";
import { subjectColorClass } from "@/lib/config/subjects";
import { listFolders, type FolderSummary } from "@/lib/data/folders";
import { getSubjects } from "@/lib/data/subjects";
import { localDateString } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

import { NewFolderButton } from "./_components/folder-dialog";
import { examCountdown, itemCountLabels } from "./_components/labels";

export const metadata: Metadata = { title: "Pastas" };

export default function FoldersPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense>
        <UrlToast />
      </Suspense>
      <Suspense
        fallback={
          <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando pastas">
            <Skeleton className="h-12 w-72" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Skeleton className="h-36 rounded-2xl" />
              <Skeleton className="h-36 rounded-2xl" />
              <Skeleton className="h-36 rounded-2xl" />
            </div>
          </div>
        }
      >
        <Folders />
      </Suspense>
    </div>
  );
}

function summaryOf(folder: FolderSummary): string {
  const parts = (Object.keys(itemCountLabels) as (keyof typeof itemCountLabels)[])
    .filter((kind) => folder.counts[kind] > 0)
    .map((kind) => {
      const n = folder.counts[kind];
      const [one, many] = itemCountLabels[kind];
      return `${n} ${n === 1 ? one : many}`;
    });
  return parts.length ? parts.join(" · ") : "Vazia";
}

async function Folders() {
  const { user } = await requireStudent("/app/pastas");
  const [folders, subjects, timezone] = await Promise.all([listFolders(), getSubjects(), getUserTimezone(user.id)]);
  const today = localDateString(timezone);
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const subjectOptions = subjects.map((s) => ({ id: s.id, name: s.name }));

  return (
    <>
      <PageHeader
        eyebrow="Organizar"
        title="Pastas"
        description="Separe por matéria ou por prova. Cada pasta junta arquivos, resumos do Estúdio, baralhos, quizzes, conversas e materiais salvos."
        actions={<NewFolderButton subjects={subjectOptions} />}
      />
      {folders.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {folders.map((folder) => {
            const subject = folder.subjectId ? subjectById.get(folder.subjectId) : undefined;
            const exam = examCountdown(folder.examDate, today);
            return (
              <li key={folder.id}>
                <Link
                  href={`/app/pastas/${folder.id}`}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-[0_6px_24px_-12px_rgb(14_27_51/0.25)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                  <div className="flex items-start gap-3">
                    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", subjectColorClass(folder.color))}>
                      <FolderIcon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-display text-lg font-bold">{folder.name}</h2>
                      <p className="text-sm text-muted-foreground">{summaryOf(folder)}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    {subject ? <SubjectChip subject={subject} size="sm" /> : null}
                    {exam ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          exam.urgent ? "bg-warning-soft text-warning-text" : "bg-muted text-ink-2",
                        )}
                      >
                        <CalendarClockIcon className="size-3.5" aria-hidden="true" />
                        {exam.text}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={FolderIcon}
          title="Nenhuma pasta ainda"
          description="Crie uma pasta para cada matéria ou prova e junte nela tudo o que você usa para estudar."
          action={<NewFolderButton subjects={subjectOptions} label="Criar primeira pasta" />}
        />
      )}
    </>
  );
}
