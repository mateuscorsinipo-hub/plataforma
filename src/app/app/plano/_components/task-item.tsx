"use client";

import { CheckIcon, EllipsisVerticalIcon, RotateCcwIcon, SkipForwardIcon, CalendarClockIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { completeTask, postponeTask, setTaskStatus } from "../actions";

export type TaskView = {
  id: string;
  title: string;
  description: string | null;
  typeLabel: string;
  minutes: number;
  status: "pending" | "done" | "skipped";
  subjectName: string | null;
  href: string | null;
  overdueLabel?: string | null;
};

export function TaskItem({ task }: { task: TaskView }) {
  const [pending, startTransition] = useTransition();
  const done = task.status === "done";
  const skipped = task.status === "skipped";
  return (
    <li className={cn("flex items-start gap-3 rounded-2xl border border-border bg-card p-4", (done || skipped) && "bg-muted/40")}>
      <button
        type="button"
        disabled={pending || skipped}
        aria-label={done ? `Desmarcar ${task.title}` : `Concluir ${task.title}`}
        aria-pressed={done}
        onClick={() =>
          startTransition(async () => {
            if (done) {
              const result = await setTaskStatus(task.id, "pending");
              if (!result.ok) toast.error(result.error);
              return;
            }
            const result = await completeTask(task.id);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(result.xp > 0 ? `Tarefa concluída! +${result.xp} XP` : "Tarefa concluída!");
            for (const t of result.unlocked) toast.success(`Conquista desbloqueada: ${t}`);
          })
        }
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          done ? "border-success-text bg-success-text text-white" : "border-input hover:border-primary",
        )}
      >
        {done ? <CheckIcon className="size-4" strokeWidth={3} /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("font-semibold leading-snug", (done || skipped) && "text-muted-foreground line-through")}>
          {task.href && !done && !skipped ? (
            <Link href={task.href} className="hover:text-primary">
              {task.title}
            </Link>
          ) : (
            task.title
          )}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {task.typeLabel} · {task.minutes} min{task.subjectName ? ` · ${task.subjectName}` : ""}
          {task.overdueLabel ? <span className="font-semibold text-warning-text"> · {task.overdueLabel}</span> : null}
          {skipped ? " · pulada" : ""}
        </p>
        {task.description && !done && !skipped ? <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{task.description}</p> : null}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Opções da tarefa ${task.title}`} disabled={pending}>
            <EllipsisVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!done ? (
            <DropdownMenuItem
              onSelect={() =>
                startTransition(async () => {
                  const result = await postponeTask(task.id);
                  if (result.ok) toast.success("Tarefa adiada para o próximo dia de estudo.");
                  else toast.error(result.error);
                })
              }
            >
              <CalendarClockIcon /> Adiar
            </DropdownMenuItem>
          ) : null}
          {task.status === "pending" ? (
            <DropdownMenuItem
              onSelect={() =>
                startTransition(async () => {
                  const result = await setTaskStatus(task.id, "skipped");
                  if (!result.ok) toast.error(result.error);
                })
              }
            >
              <SkipForwardIcon /> Pular
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() =>
                startTransition(async () => {
                  const result = await setTaskStatus(task.id, "pending");
                  if (!result.ok) toast.error(result.error);
                })
              }
            >
              <RotateCcwIcon /> Reabrir
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
