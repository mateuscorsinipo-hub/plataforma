"use client";

import { CheckCircle2Icon, EyeIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { MarkdownView } from "@/components/ai/markdown";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/primitives";
import { previewIntervals, ratings, scheduleReview, type SrsFields } from "@/lib/domain/srs";
import { cn } from "@/lib/utils";

import { reviewCard } from "../actions";

export type ReviewCard = SrsFields & { id: string; front: string; back: string; explanation: string | null };

type Outcome = { cardId: string; rating: number };

const REQUEUE_WINDOW_MS = 20 * 60_000;
const MAX_REPEATS = 3;

const toneClasses: Record<(typeof ratings)[number]["tone"], string> = {
  danger: "border-[#f3c9c6] bg-destructive-soft text-destructive-text hover:bg-destructive-soft/70",
  warning: "border-[#f1dda8] bg-warning-soft text-warning-text hover:bg-warning-soft/70",
  primary: "border-[#c9d6fb] bg-secondary text-secondary-foreground hover:bg-secondary/70",
  success: "border-[#bfe5d2] bg-success-soft text-success-text hover:bg-success-soft/70",
};

export function ReviewSession({ initialQueue, backHref, label }: { initialQueue: ReviewCard[]; backHref: string; label: string }) {
  const [queue, setQueue] = useState(initialQueue);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [xp, setXp] = useState(0);
  const [intervals, setIntervals] = useState<Record<number, string> | null>(null);
  const shownAt = useRef(0);
  const repeats = useRef(new Map<string, number>());
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const card = queue[index];
  const finished = index >= queue.length;

  useEffect(() => {
    shownAt.current = performance.now();
  }, [index]);

  const reveal = useCallback(() => {
    if (!card || revealed) return;
    setIntervals(previewIntervals(card, new Date()));
    setRevealed(true);
  }, [card, revealed]);

  const rate = useCallback(
    (rating: number) => {
      if (!card || !revealed) return;
      const durationMs = Math.round(performance.now() - shownAt.current);
      const now = new Date();
      const local = scheduleReview(card, rating as Parameters<typeof scheduleReview>[1], now);
      const count = repeats.current.get(card.id) ?? 0;
      // Cartão em passo de aprendizagem volta ainda nesta sessão.
      if (new Date(local.due_at).getTime() - now.getTime() < REQUEUE_WINDOW_MS && count < MAX_REPEATS) {
        repeats.current.set(card.id, count + 1);
        setQueue((prev) => [...prev, { ...card, ...local, last_review_at: now.toISOString() }]);
      }
      setOutcomes((prev) => [...prev, { cardId: card.id, rating }]);
      setRevealed(false);
      setIntervals(null);
      setIndex((i) => i + 1);

      // Revisões do mesmo cartão são enviadas em ordem (o banco recusa revisões fora de sequência).
      chain.current = chain.current.then(async () => {
        const result = await reviewCard({ cardId: card.id, rating, durationMs });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (result.xp > 0) setXp((value) => value + result.xp);
        for (const title of result.unlocked) toast.success(`Conquista desbloqueada: ${title}`);
      });
    },
    [card, revealed],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      if (!revealed && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        reveal();
      } else if (revealed && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        rate(Number(event.key));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, reveal, rate]);

  if (!queue.length) {
    return (
      <div className="m-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <CheckCircle2Icon className="size-12 text-success-text" aria-hidden="true" />
        <h1 className="font-display text-2xl font-extrabold">Nada para revisar agora</h1>
        <p className="text-sm text-muted-foreground">Os cartões aparecem aqui quando chega a hora de revisar. Volte mais tarde ou adicione cartões novos.</p>
        <Button asChild>
          <Link href={backHref}>Voltar</Link>
        </Button>
      </div>
    );
  }

  if (finished) {
    const correct = outcomes.filter((o) => o.rating >= 3).length;
    const unique = new Set(outcomes.map((o) => o.cardId)).size;
    return (
      <div className="m-auto flex max-w-md flex-col items-center gap-5 py-12 text-center">
        <span className="flex size-16 items-center justify-center rounded-3xl bg-success-soft text-success-text">
          <TrophyIcon className="size-8" aria-hidden="true" />
        </span>
        <h1 className="font-display text-3xl font-extrabold">Sessão concluída</h1>
        <dl className="grid w-full grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border bg-card p-3">
            <dt className="text-xs text-muted-foreground">Cartões</dt>
            <dd className="font-display text-2xl font-extrabold">{unique}</dd>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <dt className="text-xs text-muted-foreground">Lembrou</dt>
            <dd className="font-display text-2xl font-extrabold">{outcomes.length ? Math.round((correct / outcomes.length) * 100) : 0}%</dd>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <dt className="text-xs text-muted-foreground">XP</dt>
            <dd className="font-display text-2xl font-extrabold">+{xp}</dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">O agendamento de cada cartão foi salvo. Os que você errou voltam antes.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href={backHref}>Concluir</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-sm font-semibold text-muted-foreground">
          {Math.min(index + 1, queue.length)} de {queue.length}
        </span>
        <Progress value={(index / queue.length) * 100} aria-label="Progresso da sessão" />
        <Link href={backHref} className="shrink-0 text-sm font-semibold text-muted-foreground hover:text-foreground">
          Sair
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>

      <div className="flex min-h-72 flex-col rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8" aria-live="polite">
        <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Frente</p>
        <MarkdownView content={card!.front} className="text-lg" />
        {revealed ? (
          <div className="mt-6 border-t border-border pt-6">
            <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Verso</p>
            <MarkdownView content={card!.back} className="text-lg" />
            {card!.explanation ? <MarkdownView content={card!.explanation} className="mt-4 text-sm text-ink-2" /> : null}
          </div>
        ) : null}
      </div>

      {revealed ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Como foi lembrar este cartão?">
          {ratings.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => rate(r.value)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-2xl border px-3 py-3 font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                toneClasses[r.tone],
              )}
            >
              <span>{r.label}</span>
              <span className="text-xs font-medium opacity-80">{intervals?.[r.value] ?? ""}</span>
              <kbd className="hidden text-[0.65rem] opacity-60 sm:block">{r.key}</kbd>
            </button>
          ))}
        </div>
      ) : (
        <Button size="lg" onClick={reveal} className="w-full">
          <EyeIcon /> Mostrar resposta <kbd className="ml-1 hidden text-xs opacity-70 sm:inline">espaço</kbd>
        </Button>
      )}
    </div>
  );
}
