"use client";

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, FlagIcon, LoaderCircleIcon, SendIcon, TimerIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { MarkdownView } from "@/components/ai/markdown";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { saveAnswer, saveAttemptState, submitAttempt } from "../actions";

export type RunnerQuestion = {
  id: string;
  type: "multiple_choice" | "true_false" | "open";
  prompt: string;
  options: { id: string; text: string }[];
};

type Answer = { selected: string | null; text: string };

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function AttemptRunner({
  attemptId,
  title,
  isMock,
  deadlineAt,
  serverNow,
  questions,
  initialAnswers,
  initialPosition,
  initialFlagged,
}: {
  attemptId: string;
  title: string;
  isMock: boolean;
  deadlineAt: string | null;
  serverNow: string;
  questions: RunnerQuestion[];
  initialAnswers: Record<string, Answer>;
  initialPosition: number;
  initialFlagged: string[];
}) {
  const router = useRouter();
  const [position, setPosition] = useState(Math.min(initialPosition, questions.length - 1));
  const [answers, setAnswers] = useState(initialAnswers);
  const [flagged, setFlagged] = useState(new Set(initialFlagged));
  const [saving, setSaving] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);
  const textTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const stateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Diferença entre o relógio do servidor e o do aparelho, medida ao montar.
  const skew = useRef(0);
  useEffect(() => {
    skew.current = new Date(serverNow).getTime() - Date.now();
  }, [serverNow]);

  const question = questions[position]!;
  const answeredCount = questions.filter((q) => {
    const a = answers[q.id];
    return a && (a.selected || a.text.trim());
  }).length;

  const persist = useCallback(
    async (questionId: string, answer: Answer) => {
      setSaving((n) => n + 1);
      const result = await saveAnswer({ attemptId, questionId, selectedOptionId: answer.selected, answerText: answer.text.trim() ? answer.text : null });
      setSaving((n) => n - 1);
      if (!result.ok) toast.error(result.error);
    },
    [attemptId],
  );

  const doSubmit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    // Envia textos ainda pendentes antes de entregar.
    for (const [questionId, timer] of textTimers.current) {
      clearTimeout(timer);
      await persist(questionId, answers[questionId] ?? { selected: null, text: "" });
    }
    textTimers.current.clear();
    const result = await submitAttempt(attemptId);
    if (!result.ok) {
      submitted.current = false;
      setSubmitting(false);
      toast.error(result.error);
      return;
    }
    if (result.xp > 0) toast.success(`+${result.xp} XP`);
    for (const t of result.unlocked) toast.success(`Conquista desbloqueada: ${t}`);
    if (result.notice) toast(result.notice);
    router.replace(`/app/quizzes/resultado/${attemptId}`);
  }, [answers, attemptId, persist, router]);

  // Cronômetro (só em simulados com prazo).
  useEffect(() => {
    if (!deadlineAt) return;
    const deadline = new Date(deadlineAt).getTime();
    const tick = () => {
      const left = deadline - (Date.now() + skew.current);
      setRemaining(left);
      if (left <= 0 && !submitted.current) {
        toast("Tempo esgotado. Entregando suas respostas…");
        void doSubmit();
      }
    };
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [deadlineAt, doSubmit]);

  // Posição e marcações são salvas com atraso (evita uma requisição por clique).
  useEffect(() => {
    if (stateTimer.current) clearTimeout(stateTimer.current);
    stateTimer.current = setTimeout(() => void saveAttemptState(attemptId, { position, flagged: [...flagged] }), 1200);
  }, [attemptId, position, flagged]);

  function choose(optionId: string) {
    const next = { selected: optionId, text: answers[question.id]?.text ?? "" };
    setAnswers((prev) => ({ ...prev, [question.id]: next }));
    void persist(question.id, next);
  }

  function write(text: string) {
    const next = { selected: null, text };
    setAnswers((prev) => ({ ...prev, [question.id]: next }));
    const id = question.id;
    const existing = textTimers.current.get(id);
    if (existing) clearTimeout(existing);
    textTimers.current.set(
      id,
      setTimeout(() => {
        textTimers.current.delete(id);
        void persist(id, next);
      }, 900),
    );
  }

  const unanswered = questions.length - answeredCount;
  const lowTime = remaining !== null && remaining < 5 * 60_000;

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-16 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {answeredCount} de {questions.length} respondidas · {saving > 0 ? "salvando…" : "salvo"}
          </p>
        </div>
        {deadlineAt ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-mono text-sm font-bold tabular-nums",
              lowTime ? "bg-destructive-soft text-destructive-text" : "bg-muted text-foreground",
            )}
            role="timer"
            aria-label="Tempo restante"
          >
            <TimerIcon className="size-4" aria-hidden="true" />
            {remaining === null ? "--:--" : formatClock(remaining)}
          </span>
        ) : null}
        <Button onClick={() => setConfirmOpen(true)} disabled={submitting}>
          {submitting ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon />} Entregar
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section className="flex flex-col gap-4" aria-labelledby="questao-atual">
          <div className="flex items-center justify-between gap-3">
            <h2 id="questao-atual" className="text-sm font-semibold text-muted-foreground">
              Questão {position + 1} de {questions.length}
            </h2>
            <Button
              variant={flagged.has(question.id) ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={flagged.has(question.id)}
              onClick={() =>
                setFlagged((prev) => {
                  const next = new Set(prev);
                  if (next.has(question.id)) next.delete(question.id);
                  else next.add(question.id);
                  return next;
                })
              }
            >
              <FlagIcon className="size-4" /> {flagged.has(question.id) ? "Marcada para revisar" : "Marcar para revisar"}
            </Button>
          </div>
          <div className="rounded-3xl border border-border bg-card p-5 shadow-card sm:p-7">
            <MarkdownView content={question.prompt} className="text-[1.0625rem]" />
            {question.type === "open" ? (
              <div className="mt-5">
                <label htmlFor={`resposta-${question.id}`} className="mb-1.5 block text-sm font-semibold">
                  Sua resposta
                </label>
                <Textarea
                  id={`resposta-${question.id}`}
                  value={answers[question.id]?.text ?? ""}
                  onChange={(e) => write(e.target.value)}
                  onBlur={() => {
                    const timer = textTimers.current.get(question.id);
                    if (timer) {
                      clearTimeout(timer);
                      textTimers.current.delete(question.id);
                      void persist(question.id, answers[question.id] ?? { selected: null, text: "" });
                    }
                  }}
                  rows={8}
                  maxLength={10_000}
                />
              </div>
            ) : (
              <fieldset className="mt-5 flex flex-col gap-2">
                <legend className="sr-only">Alternativas</legend>
                {question.options.map((option) => {
                  const selected = answers[question.id]?.selected === option.id;
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-2xl border border-border px-4 py-3 transition-colors hover:border-primary/40",
                        selected && "border-primary bg-secondary ring-1 ring-primary",
                      )}
                    >
                      <input
                        type="radio"
                        name={`questao-${question.id}`}
                        checked={selected}
                        onChange={() => choose(option.id)}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold uppercase",
                          selected ? "bg-primary text-primary-foreground" : "bg-muted",
                        )}
                        aria-hidden="true"
                      >
                        {question.type === "true_false" ? (option.id === "true" ? "V" : "F") : option.id}
                      </span>
                      <MarkdownView content={option.text} className="min-w-0 flex-1 text-[0.9375rem]" />
                    </label>
                  );
                })}
              </fieldset>
            )}
          </div>
          <div className="flex justify-between gap-2">
            <Button variant="outline" disabled={position === 0} onClick={() => setPosition((p) => Math.max(0, p - 1))}>
              <ArrowLeftIcon /> Anterior
            </Button>
            {position < questions.length - 1 ? (
              <Button variant="outline" onClick={() => setPosition((p) => Math.min(questions.length - 1, p + 1))}>
                Próxima <ArrowRightIcon />
              </Button>
            ) : (
              <Button onClick={() => setConfirmOpen(true)} disabled={submitting}>
                Revisar e entregar
              </Button>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-3" aria-label="Navegação entre questões">
          <p className="text-sm font-semibold">Questões</p>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10 lg:grid-cols-5">
            {questions.map((q, index) => {
              const a = answers[q.id];
              const done = Boolean(a && (a.selected || a.text.trim()));
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setPosition(index)}
                  aria-label={`Questão ${index + 1}${done ? ", respondida" : ""}${flagged.has(q.id) ? ", marcada" : ""}`}
                  aria-current={index === position ? "step" : undefined}
                  className={cn(
                    "relative flex h-10 items-center justify-center rounded-lg border text-sm font-semibold transition-colors",
                    done ? "border-primary/30 bg-secondary text-secondary-foreground" : "border-border bg-card",
                    index === position && "ring-2 ring-primary",
                  )}
                >
                  {index + 1}
                  {flagged.has(q.id) ? <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-warning-text" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            As respostas são salvas automaticamente. {isMock ? "Ao fim do tempo, a prova é entregue com o que estiver salvo." : ""}
          </p>
        </aside>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entregar {isMock ? "o simulado" : "o quiz"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {unanswered ? `${unanswered} ${unanswered === 1 ? "questão está sem resposta" : "questões estão sem resposta"}. ` : "Todas as questões foram respondidas. "}
              {flagged.size ? `${flagged.size} marcada(s) para revisar. ` : ""}
              Depois de entregar, não dá para mudar as respostas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar respondendo</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                setConfirmOpen(false);
                void doSubmit();
              }}
            >
              <CheckIcon className="size-4" /> Entregar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
