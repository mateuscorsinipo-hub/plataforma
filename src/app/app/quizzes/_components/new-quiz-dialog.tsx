"use client";

import { PlusIcon, ShuffleIcon } from "lucide-react";
import { useActionState, useState } from "react";

import { SubjectSelect } from "@/components/learning/subject-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/validation/action-state";

import { composeMockExam, createQuiz } from "../actions";

export function NewQuizDialog({ kind, subjects }: { kind: "quiz" | "mock_exam"; subjects: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createQuiz, initialActionState);
  const errors = state.fieldErrors ?? {};
  const isMock = kind === "mock_exam";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isMock ? "outline" : "default"}>
          <PlusIcon /> {isMock ? "Criar do zero" : "Novo quiz"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isMock ? "Novo simulado" : "Novo quiz"}</DialogTitle>
          <DialogDescription>Depois de criar, você escreve as questões no editor.</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="kind" value={kind} />
          {state.error && !Object.keys(errors).length ? <Alert tone="danger">{state.error}</Alert> : null}
          <Field id="quiz-titulo" label="Título" error={errors.title}>
            <Input name="title" maxLength={160} required autoFocus {...fieldA11y("quiz-titulo", errors.title)} />
          </Field>
          <Field id="quiz-materia" label="Matéria" optional>
            <SubjectSelect id="quiz-materia" name="subjectId" subjects={subjects} />
          </Field>
          {isMock ? (
            <Field id="quiz-duracao" label="Duração (minutos)" error={errors.durationMinutes}>
              <Input name="durationMinutes" type="number" min={5} max={600} defaultValue={90} required className="w-32" {...fieldA11y("quiz-duracao", errors.durationMinutes)} />
            </Field>
          ) : null}
          <Field id="quiz-descricao" label="Descrição" optional error={errors.description}>
            <Textarea name="description" rows={2} maxLength={1000} {...fieldA11y("quiz-descricao", errors.description)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pendingLabel="Criando…">Criar e escrever questões</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ComposeMockDialog({ subjects, maxQuestions }: { subjects: { id: string; name: string }[]; maxQuestions: number }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(composeMockExam, initialActionState);
  const errors = state.fieldErrors ?? {};
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <ShuffleIcon /> Montar com minhas questões
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Montar simulado</DialogTitle>
          <DialogDescription>Sorteamos questões dos seus quizzes e criamos uma prova cronometrada.</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          {state.error && !Object.keys(errors).length ? <Alert tone="danger">{state.error}</Alert> : null}
          <Field id="montar-titulo" label="Título" error={errors.title}>
            <Input name="title" maxLength={160} required defaultValue="Simulado" {...fieldA11y("montar-titulo", errors.title)} />
          </Field>
          <Field id="montar-materia" label="Matéria" optional>
            <SubjectSelect id="montar-materia" name="subjectId" subjects={subjects} emptyLabel="Todas as matérias" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id="montar-qtd" label="Questões" error={errors.count}>
              <Input name="count" type="number" min={3} max={maxQuestions} defaultValue={Math.min(20, maxQuestions)} required {...fieldA11y("montar-qtd", errors.count)} />
            </Field>
            <Field id="montar-tempo" label="Minutos" error={errors.durationMinutes}>
              <Input name="durationMinutes" type="number" min={5} max={600} defaultValue={60} required {...fieldA11y("montar-tempo", errors.durationMinutes)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pendingLabel="Montando…">Montar simulado</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
