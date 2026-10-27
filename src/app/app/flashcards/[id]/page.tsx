import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SubjectChip } from "@/components/brand/subject-chip";
import { PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { getUserTimezone } from "@/lib/billing/entitlements";
import { getDeck } from "@/lib/data/flashcards";
import { getSubjectMap, getSubjects } from "@/lib/data/subjects";
import { daysBetween, formatDateBR, localDateString } from "@/lib/domain/dates";
import { uuidSchema } from "@/lib/validation/common";

import { DeckEditor, type EditorCard } from "../_components/deck-editor";

export const metadata: Metadata = { title: "Baralho" };

export default function DeckPage({ params }: PageProps<"/app/flashcards/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando baralho">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-20" />
          <Skeleton className="h-64" />
        </div>
      }
    >
      <Deck params={params} />
    </Suspense>
  );
}

function dueLabel(dueAt: string, now: Date, timezone: string): string {
  const due = new Date(dueAt);
  if (due <= now) return "revisar agora";
  const days = daysBetween(localDateString(timezone, now), localDateString(timezone, due));
  if (days <= 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days < 30) return `em ${days} dias`;
  return formatDateBR(localDateString(timezone, due), { day: "2-digit", month: "short", year: "numeric" });
}

async function Deck({ params }: { params: PageProps<"/app/flashcards/[id]">["params"] }) {
  const { id } = await params;
  const { user } = await requireStudent(`/app/flashcards/${id}`);
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) notFound();
  const [data, subjects, subjectMap, timezone] = await Promise.all([getDeck(parsed.data), getSubjects(), getSubjectMap(), getUserTimezone(user.id)]);
  if (!data) notFound();
  const now = new Date();
  const cards: EditorCard[] = data.cards.map((card) => ({
    id: card.id,
    front: card.front,
    back: card.back,
    explanation: card.explanation,
    state: card.state,
    suspended: card.suspended,
    dueLabel: dueLabel(card.due_at, now, timezone),
  }));
  const dueCount = data.cards.filter((c) => !c.suspended && new Date(c.due_at) <= now).length;
  const subject = data.deck.subject_id ? subjectMap.get(data.deck.subject_id) : null;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/app/flashcards" className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Flashcards
      </Link>
      <PageHeader
        title={data.deck.title}
        description={data.deck.description ?? undefined}
        eyebrow={subject ? <SubjectChip subject={subject} size="sm" /> : "Baralho"}
      />
      <DeckEditor
        key={data.deck.id}
        deck={{ id: data.deck.id, title: data.deck.title, description: data.deck.description, subjectId: data.deck.subject_id }}
        cards={cards}
        subjects={subjects}
        dueCount={dueCount}
      />
    </div>
  );
}
