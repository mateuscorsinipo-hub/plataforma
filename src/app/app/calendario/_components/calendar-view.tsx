"use client";

import { ChevronLeftIcon, ChevronRightIcon, ListChecksIcon, PencilIcon, PlusIcon, RepeatIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { DayEvent, DayTask, EventEditData } from "@/lib/data/calendar";
import { cn } from "@/lib/utils";
import { eventTypeLabels } from "@/lib/validation/calendar";

import { deleteEvent } from "../actions";
import { emptyDraft, EventDialog, type EventDraft } from "./event-dialog";

const typeColors: Record<string, string> = {
  exam: "bg-destructive-soft text-destructive-text",
  class: "bg-secondary text-secondary-foreground",
  study: "bg-success-soft text-success-text",
  task: "bg-warning-soft text-warning-text",
  reminder: "bg-[#efe7ff] text-[#5b3aa8]",
  other: "bg-muted text-ink-2",
};

type Day = { date: string; label: number; inMonth: boolean; isToday: boolean; events: DayEvent[]; tasks: DayTask[] };

export function CalendarView({
  monthLabel,
  prevHref,
  nextHref,
  todayHref,
  weeks,
  initialSelected,
  selectedLabels,
  events,
  subjects,
  emailReminders,
}: {
  monthLabel: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  weeks: Day[][];
  initialSelected: string;
  selectedLabels: Record<string, string>;
  events: Record<string, EventEditData>;
  subjects: { id: string; name: string }[];
  emailReminders: boolean;
}) {
  const [selected, setSelected] = useState(initialSelected);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [pending, startTransition] = useTransition();
  const day = weeks.flat().find((d) => d.date === selected);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="flex flex-col gap-3" aria-label="Mês">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">{monthLabel}</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" asChild>
              <Link href={prevHref} aria-label="Mês anterior">
                <ChevronLeftIcon />
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={todayHref}>Hoje</Link>
            </Button>
            <Button variant="outline" size="icon-sm" asChild>
              <Link href={nextHref} aria-label="Próximo mês">
                <ChevronRightIcon />
              </Link>
            </Button>
            <Button size="sm" onClick={() => setDraft(emptyDraft(selected))}>
              <PlusIcon className="size-4" /> Evento
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-center text-xs font-semibold text-muted-foreground">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div role="grid" aria-label={monthLabel}>
            {weeks.map((week, i) => (
              <div key={i} role="row" className="grid grid-cols-7 border-b border-border last:border-b-0">
                {week.map((d) => {
                  const hasExam = d.events.some((e) => e.type === "exam");
                  return (
                    <button
                      key={d.date}
                      type="button"
                      role="gridcell"
                      aria-selected={d.date === selected}
                      onClick={() => setSelected(d.date)}
                      className={cn(
                        "flex min-h-16 flex-col items-stretch gap-1 border-r border-border p-1.5 text-left transition-colors last:border-r-0 hover:bg-muted/60 sm:min-h-24",
                        !d.inMonth && "bg-muted/30 text-muted-foreground",
                        d.date === selected && "bg-secondary/60",
                      )}
                    >
                      {/* Data completa e totais só para leitores de tela; o texto visível fica no meio do nome. */}
                      <span className="sr-only">{selectedLabels[d.date]}: </span>
                      <span
                        className={cn(
                          "flex size-7 items-center justify-center self-start rounded-full text-sm font-semibold",
                          d.isToday && "bg-primary text-primary-foreground",
                        )}
                      >
                        {d.label}
                      </span>
                      <span className="hidden flex-col gap-0.5 sm:flex">
                        {d.events.slice(0, 2).map((e) => (
                          <span key={e.key} className={cn("truncate rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold", typeColors[e.type] ?? typeColors.other)}>
                            {e.time !== "Dia inteiro" ? `${e.time.slice(0, 5)} ` : ""}
                            {e.title}
                          </span>
                        ))}
                        {d.events.length > 2 ? <span className="text-[0.7rem] text-muted-foreground">+{d.events.length - 2}</span> : null}
                        {d.tasks.length ? (
                          <span className="text-[0.7rem] text-muted-foreground">
                            {d.tasks.length} {d.tasks.length === 1 ? "tarefa" : "tarefas"}
                          </span>
                        ) : null}
                      </span>
                      <span className="sr-only">
                        , {d.events.length} {d.events.length === 1 ? "evento" : "eventos"}, {d.tasks.length} {d.tasks.length === 1 ? "tarefa" : "tarefas"}
                      </span>
                      <span className="flex gap-0.5 sm:hidden" aria-hidden="true">
                        {hasExam ? <span className="size-1.5 rounded-full bg-destructive" /> : null}
                        {d.events.length && !hasExam ? <span className="size-1.5 rounded-full bg-primary" /> : null}
                        {d.tasks.length ? <span className="size-1.5 rounded-full bg-success-text" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="flex flex-col gap-4" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="min-w-0 text-lg font-bold">{selectedLabels[selected] ?? selected}</h2>
          <Button variant="ghost" size="sm" onClick={() => setDraft(emptyDraft(selected))}>
            <PlusIcon className="size-4" /> Adicionar
          </Button>
        </div>
        {day?.events.length ? (
          <ul className="flex flex-col gap-2">
            {day.events.map((e) => {
              const data = events[e.eventId];
              return (
                <li key={e.key} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5">
                  <span className={cn("mt-0.5 rounded-lg px-2 py-0.5 text-xs font-bold", typeColors[e.type] ?? typeColors.other)}>
                    {eventTypeLabels[e.type as keyof typeof eventTypeLabels] ?? "Evento"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{e.title}</p>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      {e.time}
                      {e.recurring ? <RepeatIcon className="size-3.5" aria-label="Repete" /> : null}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </div>
                  {data ? (
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon-sm" aria-label={`Editar ${e.title}`} onClick={() => setDraft({ ...data, id: data.id })}>
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Excluir ${e.title}`}
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            if (data.recurrence !== "none" && !window.confirm("Excluir todas as repetições deste evento?")) return;
                            const result = await deleteEvent(data.id);
                            if (result.ok) toast.success("Evento excluído.");
                            else toast.error(result.error);
                          })
                        }
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl bg-muted/60 px-4 py-4 text-sm text-muted-foreground">Nenhum evento neste dia.</p>
        )}
        {day?.tasks.length ? (
          <div className="flex flex-col gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <ListChecksIcon className="size-4 text-primary" aria-hidden="true" /> Plano de estudos
            </h3>
            <ul className="flex flex-col gap-1.5">
              {day.tasks.map((t) => (
                <li key={t.id} className={cn("text-sm", t.status !== "pending" && "text-muted-foreground line-through")}>
                  {t.title}
                </li>
              ))}
            </ul>
            <Link href="/app/plano" className="text-sm font-semibold text-primary hover:underline">
              Abrir o plano
            </Link>
          </div>
        ) : null}
      </aside>

      {draft ? <EventDialog key={draft.id ?? `novo-${draft.date}`} draft={draft} onClose={() => setDraft(null)} subjects={subjects} emailReminders={emailReminders} /> : null}
    </div>
  );
}
