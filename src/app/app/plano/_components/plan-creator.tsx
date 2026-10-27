"use client";

import { LoaderCircleIcon, SparklesIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { Alert } from "@/components/ui/feedback";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { weekdayLabel } from "@/lib/domain/dates";
import { parseTopics } from "@/lib/validation/plans";

import { createPlan, suggestTopics } from "../actions";

type SubjectOption = { id: string; name: string };
type ExamType = "enem" | "vestibular" | "school" | "concurso" | "other";

const examTypes: { value: ExamType; label: string }[] = [
  { value: "enem", label: "ENEM" },
  { value: "vestibular", label: "Vestibular" },
  { value: "school", label: "Prova da escola" },
  { value: "concurso", label: "Concurso" },
  { value: "other", label: "Outra" },
];

const levels = [
  { value: "beginner", label: "Começando agora" },
  { value: "intermediate", label: "Já estudei parte" },
  { value: "advanced", label: "Revisando" },
] as const;

const weights = [
  { value: 1, label: "Tranquila" },
  { value: 2, label: "Normal" },
  { value: 3, label: "Difícil" },
] as const;

export function PlanCreator({
  subjects,
  preselected,
  defaultMinutes,
  defaultWeekdays,
  minDate,
  aiAvailable,
}: {
  subjects: SubjectOption[];
  preselected: string[];
  defaultMinutes: number;
  defaultWeekdays: number[];
  minDate: string;
  aiAvailable: boolean;
}) {
  const [title, setTitle] = useState("Meu plano de estudos");
  const [examType, setExamType] = useState<ExamType>("enem");
  const [examDate, setExamDate] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState(defaultMinutes);
  const [weekdays, setWeekdays] = useState<number[]>(defaultWeekdays);
  const [level, setLevel] = useState<(typeof levels)[number]["value"]>("intermediate");
  const [selected, setSelected] = useState<string[]>(preselected.slice(0, 12));
  const [weightBy, setWeightBy] = useState<Record<string, 1 | 2 | 3>>({});
  const [topicsBy, setTopicsBy] = useState<Record<string, string>>({});
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleSubject(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : prev.length >= 12 ? prev : [...prev, id]));
  }

  async function suggest(subjectId: string) {
    setSuggesting(subjectId);
    const result = await suggestTopics({ subjectId, examType });
    setSuggesting(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setTopicsBy((prev) => ({ ...prev, [subjectId]: result.topics.join("\n") }));
    toast.success("Tópicos sugeridos. Revise e ajuste antes de criar o plano.");
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createPlan({
            title,
            examType,
            examDate,
            dailyMinutes,
            weekdays,
            level,
            subjects: selected.map((subjectId) => ({
              subjectId,
              weight: weightBy[subjectId] ?? 2,
              topics: parseTopics(topicsBy[subjectId] ?? ""),
            })),
          });
          if (result && !result.ok) setError(result.error);
        });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>1. A prova</CardTitle>
          <CardDescription>O plano vai de hoje até a véspera da prova, com revisões espaçadas e simulados na reta final.</CardDescription>
        </CardHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plano-titulo">Nome do plano</Label>
            <Input id="plano-titulo" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plano-data">Data da prova</Label>
            <Input id="plano-data" type="date" min={minDate} value={examDate} onChange={(e) => setExamDate(e.target.value)} required />
          </div>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Tipo de prova</legend>
          <div className="flex flex-wrap gap-2">
            {examTypes.map((t) => (
              <ChoiceChip key={t.value} type="radio" name="tipo-prova" label={t.label} checked={examType === t.value} onChange={() => setExamType(t.value)} />
            ))}
          </div>
        </fieldset>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Sua rotina</CardTitle>
        </CardHeader>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Dias de estudo</legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <ChoiceChip
                key={day}
                label={weekdayLabel(day).replace(/^./, (c) => c.toUpperCase())}
                checked={weekdays.includes(day)}
                onChange={() => setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))}
              />
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plano-minutos">Tempo por dia</Label>
            <NativeSelect id="plano-minutos" value={dailyMinutes} onChange={(e) => setDailyMinutes(Number(e.target.value))}>
              {[...new Set([defaultMinutes, 30, 45, 60, 90, 120, 180, 240])].sort((a, b) => a - b).map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} minutos` : `${m / 60} ${m === 60 ? "hora" : "horas"}`}
                </option>
              ))}
            </NativeSelect>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Seu momento</legend>
            <div className="flex flex-wrap gap-2">
              {levels.map((l) => (
                <ChoiceChip key={l.value} type="radio" name="nivel" label={l.label} checked={level === l.value} onChange={() => setLevel(l.value)} />
              ))}
            </div>
          </fieldset>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Matérias e tópicos</CardTitle>
          <CardDescription>
            Escolha até 12 matérias. Os tópicos são opcionais (um por linha); sem eles, o plano usa blocos gerais da matéria.
          </CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <ChoiceChip key={s.id} label={s.name} checked={selected.includes(s.id)} onChange={() => toggleSubject(s.id)} />
          ))}
        </div>
        {selected.length ? (
          <ul className="flex flex-col gap-4">
            {selected.map((id) => {
              const subject = subjects.find((s) => s.id === id);
              if (!subject) return null;
              return (
                <li key={id} className="flex flex-col gap-3 rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold">{subject.name}</p>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`peso-${id}`} className="text-sm">
                        Dificuldade
                      </Label>
                      <NativeSelect
                        id={`peso-${id}`}
                        value={weightBy[id] ?? 2}
                        onChange={(e) => setWeightBy((prev) => ({ ...prev, [id]: Number(e.target.value) as 1 | 2 | 3 }))}
                        className="h-9 w-36"
                      >
                        {weights.map((w) => (
                          <option key={w.value} value={w.value}>
                            {w.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={`topicos-${id}`}>Tópicos</Label>
                      {aiAvailable ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => void suggest(id)} disabled={suggesting !== null}>
                          {suggesting === id ? <LoaderCircleIcon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />} Sugerir com IA
                        </Button>
                      ) : null}
                    </div>
                    <Textarea
                      id={`topicos-${id}`}
                      value={topicsBy[id] ?? ""}
                      onChange={(e) => setTopicsBy((prev) => ({ ...prev, [id]: e.target.value }))}
                      rows={3}
                      placeholder={"Ex.:\nFunção do 1º grau\nFunção do 2º grau\nProgressões"}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div>
        <Button type="submit" size="lg" disabled={pending || !examDate || !selected.length || !weekdays.length}>
          {pending ? <LoaderCircleIcon className="animate-spin" /> : null} Criar plano
        </Button>
      </div>
    </form>
  );
}
