"use client";

import { ArrowDownIcon, ArrowUpIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { MarkdownView } from "@/components/ai/markdown";
import { SubjectSelect } from "@/components/learning/subject-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { deleteQuestion, moveQuestion, saveQuestion, updateQuizSettings } from "../actions";
import { QuestionForm, type EditableQuestion } from "./question-form";

export type EditorQuestion = EditableQuestion & { id: string; correctLabel: string };

const typeShort = { multiple_choice: "Múltipla escolha", true_false: "V ou F", open: "Aberta" } as const;

export function QuizEditor({
  quiz,
  questions,
  subjects,
}: {
  quiz: { id: string; kind: "quiz" | "mock_exam"; title: string; description: string | null; subjectId: string | null; durationMinutes: number | null };
  questions: EditorQuestion[];
  subjects: { id: string; name: string }[];
}) {
  const [settings, setSettings] = useState({
    title: quiz.title,
    description: quiz.description ?? "",
    subjectId: quiz.subjectId ?? "",
    durationMinutes: quiz.durationMinutes ?? 60,
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Configurações</CardTitle>
        </CardHeader>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await updateQuizSettings(quiz.id, {
                ...settings,
                durationMinutes: quiz.kind === "mock_exam" ? settings.durationMinutes : null,
              });
              if (result.ok) toast.success("Configurações salvas.");
              else toast.error(result.error);
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cfg-quiz-titulo">Título</Label>
            <Input id="cfg-quiz-titulo" value={settings.title} onChange={(e) => setSettings({ ...settings, title: e.target.value })} maxLength={160} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cfg-quiz-materia">Matéria</Label>
            <SubjectSelect id="cfg-quiz-materia" subjects={subjects} value={settings.subjectId} onChange={(e) => setSettings({ ...settings, subjectId: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="cfg-quiz-descricao">Descrição</Label>
            <Textarea id="cfg-quiz-descricao" value={settings.description} onChange={(e) => setSettings({ ...settings, description: e.target.value })} rows={2} maxLength={1000} />
          </div>
          {quiz.kind === "mock_exam" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cfg-quiz-duracao">Duração (minutos)</Label>
              <Input
                id="cfg-quiz-duracao"
                type="number"
                min={5}
                max={600}
                value={settings.durationMinutes}
                onChange={(e) => setSettings({ ...settings, durationMinutes: Number(e.target.value) || 60 })}
                className="w-32"
              />
            </div>
          ) : null}
          <div className="md:col-span-2">
            <Button type="submit" variant="outline" disabled={pending}>
              Salvar configurações
            </Button>
          </div>
        </form>
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="questoes-titulo">
        <h2 id="questoes-titulo" className="text-lg font-bold">
          Questões ({questions.length})
        </h2>
        {questions.length ? (
          <ol className="flex flex-col gap-3">
            {questions.map((question, index) => (
              <li key={question.id} className="rounded-2xl border border-border bg-card p-5">
                {editing === question.id ? (
                  <QuestionForm
                    idPrefix={`q-${question.id}`}
                    initial={question}
                    submitLabel="Salvar questão"
                    onCancel={() => setEditing(null)}
                    onSubmit={async (input) => {
                      const result = await saveQuestion(quiz.id, question.id, input);
                      if (!result.ok) toast.error(result.error);
                      else {
                        setEditing(null);
                        toast.success("Questão salva.");
                      }
                      return result.ok;
                    }}
                  />
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="neutral" shape="tag">
                          {index + 1}
                        </Badge>
                        <Badge variant="outline" shape="tag">
                          {typeShort[question.type]}
                        </Badge>
                        {question.topic ? <span className="text-muted-foreground">{question.topic}</span> : null}
                      </div>
                      <MarkdownView content={question.prompt} className="text-[0.9375rem]" />
                      <p className="mt-2 text-sm text-success-text">Gabarito: {question.correctLabel}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Mover para cima"
                        disabled={index === 0 || pending}
                        onClick={() => startTransition(async () => void (await moveQuestion(question.id, "up")))}
                      >
                        <ArrowUpIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Mover para baixo"
                        disabled={index === questions.length - 1 || pending}
                        onClick={() => startTransition(async () => void (await moveQuestion(question.id, "down")))}
                      >
                        <ArrowDownIcon className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Editar questão" onClick={() => setEditing(question.id)}>
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Excluir questão"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await deleteQuestion(question.id);
                            if (!result.ok) toast.error(result.error);
                          })
                        }
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma questão ainda. Escreva a primeira abaixo.</p>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Nova questão</CardTitle>
        </CardHeader>
        <QuestionForm
          idPrefix="nova"
          submitLabel="Adicionar questão"
          onSubmit={async (input) => {
            const result = await saveQuestion(quiz.id, null, input);
            if (!result.ok) toast.error(result.error);
            else toast.success("Questão adicionada.");
            return result.ok;
          }}
        />
      </Card>
    </div>
  );
}
