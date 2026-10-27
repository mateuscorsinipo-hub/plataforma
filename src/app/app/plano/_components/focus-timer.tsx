"use client";

import { PauseIcon, PlayIcon, TimerIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { SubjectSelect } from "@/components/learning/subject-select";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { startFocus, stopFocus } from "../actions";

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

/** Cronômetro de foco: o início é gravado no servidor, que calcula a duração ao parar. */
export function FocusTimer({ startedAt, subjects }: { startedAt: string | null; subjects: { id: string; name: string }[] }) {
  const [subjectId, setSubjectId] = useState("");
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Date.now() - start);
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [startedAt]);

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TimerIcon className="size-4 text-primary" aria-hidden="true" /> Cronômetro de foco
        </CardTitle>
        <CardDescription>O tempo entra no seu desempenho e na meta do dia (a partir de 1 minuto, até 4 horas).</CardDescription>
      </CardHeader>
      {startedAt ? (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-4xl font-bold tabular-nums" role="timer" aria-label="Tempo de foco">
            {elapsed === null ? "--:--" : clock(elapsed)}
          </p>
          <Button
            variant="dark"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await stopFocus();
                if (!result.ok) toast.error(result.error);
                else if (result.minutes === 0) toast("Sessão com menos de 1 minuto não é registrada.");
                else toast.success(`${result.minutes} min registrados${result.xp ? ` · +${result.xp} XP` : ""}`);
              })
            }
          >
            <PauseIcon /> Parar e registrar
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label htmlFor="foco-materia" className="sr-only">
            Matéria
          </label>
          <SubjectSelect id="foco-materia" subjects={subjects} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} emptyLabel="Matéria (opcional)" />
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await startFocus({ subjectId: subjectId || null });
                if (!result.ok) toast.error(result.error);
              })
            }
          >
            <PlayIcon /> Iniciar foco
          </Button>
        </div>
      )}
    </Card>
  );
}
