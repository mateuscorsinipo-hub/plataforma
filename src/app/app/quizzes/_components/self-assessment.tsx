"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { selfAssessAnswer } from "../actions";

export function SelfAssessment({ answerId }: { answerId: string }) {
  const [pending, startTransition] = useTransition();
  const assess = (level: "correct" | "partial" | "wrong") =>
    startTransition(async () => {
      const result = await selfAssessAnswer({ answerId, level });
      if (!result.ok) toast.error(result.error);
      else if (result.graded) toast.success(result.xp > 0 ? `Correção concluída. +${result.xp} XP` : "Correção concluída.");
    });
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Avalie sua resposta">
      <span className="text-sm font-semibold">Compare com a resposta esperada:</span>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => assess("correct")}>
        Acertei
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => assess("partial")}>
        Acertei em parte
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => assess("wrong")}>
        Errei
      </Button>
    </div>
  );
}
