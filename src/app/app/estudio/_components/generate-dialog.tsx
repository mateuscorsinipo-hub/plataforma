"use client";

import { CheckIcon, LoaderCircleIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/primitives";
import {
  difficultyLabels,
  examStyleLabels,
  lengthLabels,
  type ExamStyle,
  type GenerationDifficulty,
  type GenerationLength,
  type KindDefinition,
} from "@/lib/ai/studio/kinds";
import type { GenerateStreamEvent, GenerationStage } from "@/lib/ai/studio/events";
import { errorMessageOf, readNdjson } from "@/lib/client/ndjson";

const stageOrder = ["reading", "condensing", "generating", "saving"] as const;

function toStage(event: Extract<GenerateStreamEvent, { type: "stage" }>): GenerationStage {
  return event.stage === "condensing" ? { stage: "condensing", done: event.done, total: event.total } : { stage: event.stage };
}

function stageText(stage: GenerationStage): string {
  switch (stage.stage) {
    case "reading":
      return "Lendo o material";
    case "condensing":
      return `Condensando o material em partes (${stage.done} de ${stage.total})`;
    case "generating":
      return "Gerando com a IA";
    case "saving":
      return "Conferindo e salvando";
  }
}

export function GenerateDialog({
  definition,
  fileIds,
  maxCount,
  open,
  onOpenChange,
}: {
  definition: KindDefinition | null;
  fileIds: string[];
  maxCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<GenerationDifficulty>("medium");
  const [length, setLength] = useState<GenerationLength>("medium");
  const [count, setCount] = useState<number | null>(null);
  const [examStyle, setExamStyle] = useState<ExamStyle>("enem");
  const [allowOpen, setAllowOpen] = useState(true);
  const [focus, setFocus] = useState("");
  const [title, setTitle] = useState("");
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<GenerationStage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  if (!definition) return null;
  const effectiveCount = definition.count ? Math.min(maxCount, Math.max(definition.count.min, count ?? definition.count.default)) : 0;
  const showAllowOpen = definition.kind === "quiz" || (definition.kind === "mock_exam" && examStyle === "school");
  const current = stages[stages.length - 1];

  async function generate() {
    if (!definition) return;
    setRunning(true);
    setError(null);
    setStages([]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: definition.kind,
          fileIds,
          difficulty,
          length,
          count: definition.count ? effectiveCount : undefined,
          examStyle,
          allowOpen,
          focus: focus.trim() || undefined,
          title: title.trim() || undefined,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        setError(await errorMessageOf(response));
        return;
      }
      for await (const event of readNdjson<GenerateStreamEvent>(response)) {
        if (event.type === "stage") {
          const stage = toStage(event);
          setStages((prev) => [...prev.filter((s) => s.stage !== stage.stage), stage]);
        } else if (event.type === "done") {
          router.push(`/app/estudio/${event.id}`);
          return;
        } else {
          setError(event.message);
          router.refresh();
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setError("A conexão caiu durante a geração. Tente novamente.");
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (running) return;
        onOpenChange(next);
        if (!next) {
          setError(null);
          setStages([]);
        }
      }}
    >
      <DialogContent showClose={!running}>
        <DialogHeader>
          <DialogTitle>{definition.label}</DialogTitle>
          <DialogDescription>
            {definition.description} Usando {fileIds.length} {fileIds.length === 1 ? "arquivo" : "arquivos"}.
          </DialogDescription>
        </DialogHeader>

        {running ? (
          <div className="flex flex-col gap-3" role="status" aria-live="polite">
            <ol className="flex flex-col gap-2.5">
              {stageOrder
                .filter((name) => name !== "condensing" || stages.some((s) => s.stage === "condensing"))
                .map((name) => {
                  const reached = stages.find((s) => s.stage === name);
                  const isCurrent = current?.stage === name;
                  const done = reached && !isCurrent;
                  return (
                    <li key={name} className="flex items-center gap-3 text-sm">
                      <span
                        className={
                          done
                            ? "flex size-6 items-center justify-center rounded-full bg-success-soft text-success-text"
                            : isCurrent
                              ? "flex size-6 items-center justify-center rounded-full bg-secondary text-primary"
                              : "flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground"
                        }
                      >
                        {done ? <CheckIcon className="size-3.5" /> : isCurrent ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : null}
                      </span>
                      <span className={reached ? "font-medium" : "text-muted-foreground"}>
                        {reached ? stageText(reached) : stageText({ stage: name, done: 0, total: 0 } as GenerationStage)}
                      </span>
                    </li>
                  );
                })}
            </ol>
            <p className="text-xs text-muted-foreground">Materiais longos podem levar alguns minutos. Mantenha esta janela aberta.</p>
          </div>
        ) : (
          <form
            id="gerar-form"
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              void generate();
            }}
          >
            {definition.usesDifficulty ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-semibold">Dificuldade</legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(difficultyLabels) as GenerationDifficulty[]).map((value) => (
                    <ChoiceChip
                      key={value}
                      type="radio"
                      name="dificuldade"
                      label={difficultyLabels[value]}
                      checked={difficulty === value}
                      onChange={() => setDifficulty(value)}
                    />
                  ))}
                </div>
              </fieldset>
            ) : null}

            {definition.usesLength ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-semibold">Tamanho</legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(lengthLabels) as GenerationLength[]).map((value) => (
                    <ChoiceChip
                      key={value}
                      type="radio"
                      name="tamanho"
                      label={lengthLabels[value]}
                      checked={length === value}
                      onChange={() => setLength(value)}
                    />
                  ))}
                </div>
              </fieldset>
            ) : null}

            {definition.kind === "mock_exam" ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-semibold">Estilo da prova</legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(examStyleLabels) as ExamStyle[]).map((value) => (
                    <ChoiceChip
                      key={value}
                      type="radio"
                      name="estilo"
                      label={examStyleLabels[value]}
                      checked={examStyle === value}
                      onChange={() => setExamStyle(value)}
                    />
                  ))}
                </div>
              </fieldset>
            ) : null}

            {definition.count ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quantidade">
                  {definition.count.label} (de {definition.count.min} a {maxCount})
                </Label>
                <Input
                  id="quantidade"
                  type="number"
                  inputMode="numeric"
                  min={definition.count.min}
                  max={maxCount}
                  value={count ?? Math.min(maxCount, definition.count.default)}
                  onChange={(event) => setCount(event.target.value ? Number(event.target.value) : null)}
                  className="w-32"
                />
              </div>
            ) : null}

            {showAllowOpen ? (
              <label className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3 text-sm">
                <span>
                  <span className="block font-semibold">Incluir questões abertas</span>
                  <span className="text-muted-foreground">Respostas escritas, com resposta esperada para comparar.</span>
                </span>
                <Switch checked={allowOpen} onCheckedChange={setAllowOpen} />
              </label>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="foco">
                Foco <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea
                id="foco"
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Ex.: só o capítulo 3; priorize fórmulas; questões no estilo da FUVEST"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="titulo">
                Título <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="titulo" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="A IA sugere um título" />
            </div>
          </form>
        )}

        {error ? (
          <Alert tone="danger" title="Não foi possível gerar">
            {error}
          </Alert>
        ) : null}

        <DialogFooter>
          {running ? (
            <Button variant="outline" onClick={() => abortRef.current?.abort()}>
              Cancelar geração
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button type="submit" form="gerar-form" disabled={!fileIds.length}>
                <SparklesIcon /> Gerar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
