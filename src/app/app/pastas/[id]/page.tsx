import {
  ArrowLeftIcon,
  CalendarClockIcon,
  CircleHelpIcon,
  FileTextIcon,
  FolderIcon,
  LayersIcon,
  MessageCircleIcon,
  SparklesIcon,
  TimerIcon,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SubjectChip } from "@/components/brand/subject-chip";
import { MaterialCard, MaterialGrid } from "@/components/library/material-card";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { kindByName } from "@/lib/ai/studio/kinds";
import { requireStudent } from "@/lib/auth/session";
import { getUserTimezone } from "@/lib/billing/entitlements";
import { formatBytes } from "@/lib/config/uploads";
import { subjectColorClass } from "@/lib/config/subjects";
import { getFolder, listFolderItems, type FolderItems } from "@/lib/data/folders";
import { getSubjects } from "@/lib/data/subjects";
import { formatDateBR, localDateString } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";
import type { FolderItemKind } from "@/lib/validation/materials";

import { FolderControls, RemoveFromFolderButton, type Candidate } from "../_components/folder-controls";
import { examCountdown } from "../_components/labels";

export const metadata: Metadata = { title: "Pasta" };

export default function FolderPage({ params }: PageProps<"/app/pastas/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando pasta">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-12 w-80" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      }
    >
      <Folder params={params} />
    </Suspense>
  );
}

type Row = { kind: FolderItemKind; id: string; title: string; meta: string; href: string; icon: LucideIcon };

function shortDate(iso: string) {
  return formatDateBR(iso.slice(0, 10), { day: "2-digit", month: "short", year: "numeric" });
}

function rowsOf(items: FolderItems): Record<Exclude<FolderItemKind, "material">, Row[]> {
  return {
    file: items.files.map((f) => ({
      kind: "file",
      id: f.id,
      title: f.name,
      meta: [formatBytes(f.sizeBytes), f.status === "ready" ? "pronto" : f.status === "failed" ? "falhou" : "processando"].join(" · "),
      href: `/app/estudio?arquivos=${f.id}`,
      icon: FileTextIcon,
    })),
    generation: items.generations.map((g) => ({
      kind: "generation",
      id: g.id,
      title: g.title,
      meta: `${kindByName[g.kind]?.label ?? "Gerado"} · ${shortDate(g.createdAt)}`,
      href: `/app/estudio/${g.id}`,
      icon: SparklesIcon,
    })),
    deck: items.decks.map((d) => ({
      kind: "deck",
      id: d.id,
      title: d.title,
      meta: `${d.cardsCount} ${d.cardsCount === 1 ? "cartão" : "cartões"}`,
      href: `/app/flashcards/${d.id}`,
      icon: LayersIcon,
    })),
    quiz: items.quizzes.map((q) => ({
      kind: "quiz",
      id: q.id,
      title: q.title,
      meta: `${q.kind === "mock_exam" ? "Simulado" : "Quiz"} · ${q.questionsCount} ${q.questionsCount === 1 ? "questão" : "questões"}`,
      href: `/app/quizzes/${q.id}`,
      icon: q.kind === "mock_exam" ? TimerIcon : CircleHelpIcon,
    })),
    conversation: items.conversations.map((c) => ({
      kind: "conversation",
      id: c.id,
      title: c.title,
      meta: `Última mensagem em ${shortDate(c.lastMessageAt)}`,
      href: `/app/tutor/${c.id}`,
      icon: MessageCircleIcon,
    })),
  };
}

const sectionTitles: Record<Exclude<FolderItemKind, "material">, string> = {
  file: "Arquivos",
  generation: "Do Estúdio",
  deck: "Baralhos",
  quiz: "Quizzes e simulados",
  conversation: "Conversas do tutor",
};

async function Folder({ params }: { params: PageProps<"/app/pastas/[id]">["params"] }) {
  const { id } = await params;
  const { user } = await requireStudent(`/app/pastas/${id}`);
  const folder = await getFolder(id);
  if (!folder) notFound();
  const [items, unfiled, subjects, timezone] = await Promise.all([
    listFolderItems(folder.id),
    listFolderItems(null, 60),
    getSubjects(),
    getUserTimezone(user.id),
  ]);
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const subject = folder.subject_id ? subjectById.get(folder.subject_id) : undefined;
  const exam = examCountdown(folder.exam_date, localDateString(timezone));
  const rows = rowsOf(items);
  const candidateRows = rowsOf(unfiled);
  const candidates: Candidate[] = [
    ...Object.values(candidateRows).flat().map(({ kind, id: itemId, title, meta }) => ({ kind, id: itemId, title, meta })),
    ...unfiled.materials.map((m) => ({ kind: "material" as const, id: m.id, title: m.title, meta: m.author ? `@${m.author.username}` : "Material da biblioteca" })),
  ];
  const isEmpty = !Object.values(rows).some((r) => r.length) && !items.materials.length;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/app/pastas" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden="true" /> Pastas
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl", subjectColorClass(folder.color))}>
            <FolderIcon className="size-7" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="font-display text-[1.75rem] leading-tight font-extrabold break-words sm:text-[2.125rem]">{folder.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </div>
        <FolderControls
          folder={{ id: folder.id, name: folder.name, color: folder.color, subjectId: folder.subject_id ?? "", examDate: folder.exam_date ?? "" }}
          subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
          candidates={candidates}
        />
      </div>

      {isEmpty ? (
        <EmptyState
          icon={FolderIcon}
          title="Pasta vazia"
          description="Use “Adicionar itens” para trazer arquivos, baralhos, quizzes, conversas e materiais salvos que ainda não estão em nenhuma pasta."
          action={
            <Button asChild variant="outline">
              <Link href="/app/biblioteca">Procurar materiais na biblioteca</Link>
            </Button>
          }
        />
      ) : (
        <>
          {(Object.keys(sectionTitles) as (keyof typeof sectionTitles)[]).map((kind) =>
            rows[kind].length ? (
              <section key={kind} aria-labelledby={`secao-${kind}`} className="flex flex-col gap-2">
                <h2 id={`secao-${kind}`} className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
                  {sectionTitles[kind]} <span className="font-semibold">({rows[kind].length})</span>
                </h2>
                <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
                  {rows[kind].map((row) => (
                    <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                      <row.icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                      <Link href={row.href} className="min-w-0 flex-1 rounded-md hover:underline">
                        <span className="block truncate text-sm font-semibold">{row.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{row.meta}</span>
                      </Link>
                      <RemoveFromFolderButton kind={row.kind} id={row.id} title={row.title} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null,
          )}
          {items.materials.length ? (
            <section aria-labelledby="secao-materiais" className="flex flex-col gap-2">
              <h2 id="secao-materiais" className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
                Materiais salvos <span className="font-semibold">({items.materials.length})</span>
              </h2>
              <MaterialGrid>
                {items.materials.map((m) => (
                  <MaterialCard
                    key={m.id}
                    material={m}
                    subject={subjectById.get(m.subjectId)}
                    href={`/app/biblioteca/${m.slug}`}
                    actions={<RemoveFromFolderButton kind="material" id={m.id} title={m.title} />}
                  />
                ))}
              </MaterialGrid>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
