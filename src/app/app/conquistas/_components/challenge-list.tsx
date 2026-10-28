"use client";

import { CheckIcon, GiftIcon, LoaderCircleIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

import { claimWeeklyChallenge } from "../actions";

export type ChallengeItem = {
  code: string;
  title: string;
  description: string;
  target: number;
  reward: number;
  value: number;
  percent: number;
  done: boolean;
  claimed: boolean;
};

export function ChallengeList({ challenges }: { challenges: ChallengeItem[] }) {
  const [claimed, setClaimed] = useState<Set<string>>(() => new Set(challenges.filter((c) => c.claimed).map((c) => c.code)));
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function claim(code: string) {
    setBusy(code);
    startTransition(async () => {
      const result = await claimWeeklyChallenge(code);
      setBusy(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setClaimed((prev) => new Set(prev).add(code));
      toast.success(`Desafio concluído! +${result.xp} XP`);
      for (const title of result.achievements) toast.success(`Conquista desbloqueada: ${title}`);
    });
  }

  return (
    <ul className="grid gap-3 md:grid-cols-3">
      {challenges.map((c) => {
        const isClaimed = claimed.has(c.code);
        return (
          <li
            key={c.code}
            className={cn(
              "flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5",
              isClaimed ? "border-success/40" : c.done ? "border-primary/50" : "border-border",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-display text-base leading-snug font-bold">{c.title}</p>
              <Badge variant={isClaimed ? "success" : "default"} className="shrink-0">
                {isClaimed ? <CheckIcon /> : <GiftIcon />} {c.reward} XP
              </Badge>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{c.description}</p>
            <div className="mt-auto flex flex-col gap-1.5">
              <Progress
                value={c.percent}
                aria-label={`${c.title}: ${Math.min(c.value, c.target)} de ${c.target}`}
                indicatorClassName={c.done ? "bg-success" : undefined}
              />
              <p className="text-xs font-semibold text-ink-2 tabular-nums">
                {Math.min(c.value, c.target).toLocaleString("pt-BR")} de {c.target.toLocaleString("pt-BR")}
              </p>
            </div>
            {isClaimed ? (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-success-text">
                <CheckIcon className="size-4" aria-hidden="true" /> Recompensa resgatada
              </p>
            ) : c.done ? (
              <Button size="sm" onClick={() => claim(c.code)} disabled={busy === c.code}>
                {busy === c.code ? <LoaderCircleIcon className="size-4 animate-spin" /> : <GiftIcon className="size-4" />} Resgatar {c.reward} XP
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
