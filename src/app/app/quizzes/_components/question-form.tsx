"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { QuestionInput } from "@/lib/validation/quizzes";

export type EditableQuestion = {
  type: "multiple_choice" | "true_false" | "open";
  prompt: string;
  options: string[];
  correctIndex: number;
  correctBoolean: boolean;
  referenceAnswer: string;
  explanation: string;
  topic: string;
  points: number;
};

export const emptyQuestion: EditableQuestion = {
  type: "multiple_choice",
  prompt: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  correctBoolean: true,
  referenceAnswer: "",
  explanation: "",
  topic: "",
  points: 1,
};

function toInput(q: EditableQuestion): QuestionInput {
  const common = { prompt: q.prompt, explanation: q.explanation, topic: q.topic, points: q.points };
  if (q.type === "multiple_choice") {
    const options = q.options.map((o) => o.trim());
    return { type: "multiple_choice", ...common, options, correctIndex: q.correctIndex };
  }
  if (q.type === "true_false") return { type: "true_false", ...common, correct: q.correctBoolean };
  return { type: "open", ...common, referenceAnswer: q.referenceAnswer };
}

const typeLabels = { multiple_choice: "Múltipla escolha", true_false: "Verdadeiro ou falso", open: "Aberta" } as const;

export function QuestionForm({
  idPrefix,
  initial = emptyQuestion,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  initial?: EditableQuestion;
  submitLabel: string;
  onSubmit: (input: QuestionInput) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [q, setQ] = useState<EditableQuestion>(initial);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<EditableQuestion>) => setQ((prev) => ({ ...prev, ...patch }));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const ok = await onSubmit(toInput(q));
          if (ok && !onCancel) setQ({ ...emptyQuestion, type: q.type, topic: q.topic });
        });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Tipo</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(typeLabels) as EditableQuestion["type"][]).map((type) => (
            <ChoiceChip key={type} type="radio" name={`${idPrefix}-tipo`} label={typeLabels[type]} checked={q.type === type} onChange={() => set({ type })} />
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-enunciado`}>Enunciado</Label>
        <Textarea id={`${idPrefix}-enunciado`} value={q.prompt} onChange={(e) => set({ prompt: e.target.value })} rows={3} maxLength={5000} required />
        <p className="text-xs text-muted-foreground">Aceita Markdown e fórmulas entre $...$.</p>
      </div>

      {q.type === "multiple_choice" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Alternativas (marque a correta)</legend>
          {q.options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="radio"
                name={`${idPrefix}-correta`}
                checked={q.correctIndex === index}
                onChange={() => set({ correctIndex: index })}
                aria-label={`Alternativa ${String.fromCharCode(65 + index)} é a correta`}
                className="size-5 shrink-0 accent-[var(--primary)]"
              />
              <span className="w-5 text-sm font-bold text-muted-foreground">{String.fromCharCode(65 + index)}</span>
              <Input
                value={option}
                onChange={(e) => set({ options: q.options.map((o, i) => (i === index ? e.target.value : o)) })}
                maxLength={2000}
                required
                aria-label={`Texto da alternativa ${String.fromCharCode(65 + index)}`}
              />
              {q.options.length > 2 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover alternativa ${String.fromCharCode(65 + index)}`}
                  onClick={() =>
                    set({
                      options: q.options.filter((_, i) => i !== index),
                      correctIndex: q.correctIndex === index ? 0 : q.correctIndex > index ? q.correctIndex - 1 : q.correctIndex,
                    })
                  }
                >
                  <XIcon className="size-4" />
                </Button>
              ) : null}
            </div>
          ))}
          {q.options.length < 6 ? (
            <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => set({ options: [...q.options, ""] })}>
              <PlusIcon className="size-4" /> Alternativa
            </Button>
          ) : null}
        </fieldset>
      ) : null}

      {q.type === "true_false" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Resposta correta</legend>
          <div className="flex gap-2">
            <ChoiceChip type="radio" name={`${idPrefix}-vf`} label="Verdadeiro" checked={q.correctBoolean} onChange={() => set({ correctBoolean: true })} />
            <ChoiceChip type="radio" name={`${idPrefix}-vf`} label="Falso" checked={!q.correctBoolean} onChange={() => set({ correctBoolean: false })} />
          </div>
        </fieldset>
      ) : null}

      {q.type === "open" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-esperada`}>Resposta esperada</Label>
          <Textarea id={`${idPrefix}-esperada`} value={q.referenceAnswer} onChange={(e) => set({ referenceAnswer: e.target.value })} rows={3} maxLength={5000} required />
          <p className="text-xs text-muted-foreground">Usada na correção automática e mostrada para comparar depois de responder.</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-explicacao`}>
          Explicação do gabarito <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea id={`${idPrefix}-explicacao`} value={q.explanation} onChange={(e) => set({ explanation: e.target.value })} rows={2} maxLength={5000} />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-tema`}>
            Tema <span className="font-normal text-muted-foreground">(para o relatório de desempenho)</span>
          </Label>
          <Input id={`${idPrefix}-tema`} value={q.topic} onChange={(e) => set({ topic: e.target.value })} maxLength={120} placeholder="Ex.: Função do 2º grau" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-pontos`}>Pontos</Label>
          <Input id={`${idPrefix}-pontos`} type="number" min={0.5} max={100} step={0.5} value={q.points} onChange={(e) => set({ points: Number(e.target.value) || 1 })} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
