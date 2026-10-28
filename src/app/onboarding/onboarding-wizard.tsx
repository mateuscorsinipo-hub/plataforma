"use client";

import { ArrowLeftIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { SubjectIcon } from "@/components/brand/subject-chip";
import { Button } from "@/components/ui/button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { Field, fieldA11y } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox, Progress } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/submit-button";
import { gradeOptions, schoolStageLabels, type SchoolStage } from "@/lib/config/subjects";
import { weekdayLabel } from "@/lib/domain/dates";
import { useBrowserTimezone, useToday } from "@/lib/hooks/use-today";
import { CHILD_AGE_LIMIT, ageOn } from "@/lib/validation/age";
import { initialActionState } from "@/lib/validation/action-state";
import { dailyGoalOptions, difficultyOptions, goalOptions, periodOptions } from "@/lib/validation/onboarding";

import { completeOnboarding } from "./actions";

type Subject = { id: string; name: string; color: string; icon: string; kind: string };

type Defaults = {
  displayName: string;
  hasBirthDate: boolean;
  hasAcceptedTerms: boolean;
  schoolStage: string | null;
  gradeYear: number | null;
  subjectIds: string[];
  goals: string[];
  difficulties: string[];
  dailyGoalMinutes: number;
  studyWeekdays: number[];
  preferredPeriod: string | null;
};

const steps = [
  { id: "voce", title: "Sobre você", optional: false, fields: ["displayName", "birthDate", "acceptTerms"] },
  { id: "etapa", title: "Etapa de ensino", optional: true, fields: ["schoolStage", "gradeYear"] },
  { id: "materias", title: "Matérias de interesse", optional: true, fields: ["subjectIds"] },
  { id: "objetivos", title: "Objetivos e dificuldades", optional: true, fields: ["goals", "difficulties"] },
  { id: "rotina", title: "Rotina de estudo", optional: true, fields: ["dailyGoalMinutes", "studyWeekdays", "preferredPeriod", "timezone"] },
  { id: "provas", title: "Próximas provas", optional: true, fields: ["exams"] },
] as const;

type ExamDraft = { key: number; title: string; date: string; subjectId: string };

export function OnboardingWizard({ subjects, defaults }: { subjects: Subject[]; defaults: Defaults }) {
  const [state, formAction] = useActionState(completeOnboarding, initialActionState);
  const [step, setStep] = useState(0);
  const [stage, setStage] = useState<string>(defaults.schoolStage ?? "");
  const [birthDate, setBirthDate] = useState("");
  const timezone = useBrowserTimezone();
  const [exams, setExams] = useState<ExamDraft[]>([]);
  const [handledErrors, setHandledErrors] = useState(state.fieldErrors);
  const errors = state.fieldErrors ?? {};

  // Se o servidor apontou erro, volta para a primeira etapa com problema
  // (ajuste de estado durante a renderização, sem efeito).
  if (state.fieldErrors !== handledErrors) {
    setHandledErrors(state.fieldErrors);
    const keys = Object.keys(state.fieldErrors ?? {});
    const failing = steps.findIndex((s) =>
      s.fields.some((field) => keys.some((key) => key === field || key.startsWith(`${field}.`))),
    );
    if (failing >= 0) setStep(failing);
  }

  const age = useMemo(() => (/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? ageOn(birthDate) : null), [birthDate]);
  const grades = gradeOptions[(stage || "outro") as SchoolStage] ?? [];
  const current = steps[step] ?? steps[0];
  const isLast = step === steps.length - 1;
  const today = useToday();

  return (
    <form
      action={formAction}
      className="flex flex-col gap-6"
      noValidate
      onKeyDown={(event) => {
        // Enter num campo avança a etapa em vez de enviar o formulário inteiro.
        if (event.key === "Enter" && !isLast && event.target instanceof HTMLInputElement) {
          event.preventDefault();
          setStep((s) => Math.min(steps.length - 1, s + 1));
        }
      }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
          <span>
            Etapa {step + 1} de {steps.length}
          </span>
          {current.optional ? <span>Opcional</span> : null}
        </div>
        <Progress value={((step + 1) / steps.length) * 100} aria-label="Progresso do cadastro" />
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
        <h1 className="mb-1 font-display text-2xl font-extrabold sm:text-3xl">{current.title}</h1>
        {state.error ? (
          <Alert tone="danger" className="my-4">
            {state.error}
          </Alert>
        ) : null}

        {/* Etapa 1 */}
        <section hidden={step !== 0} className="mt-5 flex flex-col gap-5" aria-label="Sobre você">
          <p className="text-[0.9375rem] text-ink-2">Vamos personalizar o Grifo. Você pode mudar tudo depois nas configurações.</p>
          <Field id="displayName" label="Como quer ser chamado" error={errors.displayName}>
            <Input name="displayName" defaultValue={defaults.displayName} maxLength={60} required {...fieldA11y("displayName", errors.displayName)} />
          </Field>
          {!defaults.hasBirthDate ? (
            <Field
              id="birthDate"
              label="Data de nascimento"
              description="Necessária para aplicar as proteções de privacidade adequadas à sua idade."
              error={errors.birthDate}
            >
              <Input
                name="birthDate"
                type="date"
                max={today}
                min="1900-01-01"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                {...fieldA11y("birthDate", errors.birthDate, true)}
              />
            </Field>
          ) : null}
          {age !== null && age < CHILD_AGE_LIMIT ? (
            <Alert tone="warning">
              Para menores de {CHILD_AGE_LIMIT} anos, a conta precisa da autorização de um responsável. Depois desta etapa,
              pediremos o contato dele.
            </Alert>
          ) : null}
          {!defaults.hasAcceptedTerms ? (
            <div className="flex items-start gap-3">
              <Checkbox id="acceptTerms" name="acceptTerms" value="on" className="mt-0.5" />
              <Label htmlFor="acceptTerms" className="block text-sm leading-relaxed font-normal text-ink-2">
                Li e aceito os{" "}
                <Link href="/termos" target="_blank" className="font-semibold text-primary hover:underline">
                  Termos de uso
                </Link>{" "}
                e a{" "}
                <Link href="/privacidade" target="_blank" className="font-semibold text-primary hover:underline">
                  Política de privacidade
                </Link>
                .
              </Label>
            </div>
          ) : null}
          {errors.acceptTerms ? (
            <p role="alert" className="text-[0.8125rem] font-medium text-destructive-text">
              {errors.acceptTerms[0]}
            </p>
          ) : null}
        </section>

        {/* Etapa 2 */}
        <section hidden={step !== 1} className="mt-5 flex flex-col gap-5" aria-label="Etapa de ensino">
          <p className="text-[0.9375rem] text-ink-2">Ajuda a sugerir materiais e simulados no nível certo.</p>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Etapa de ensino</legend>
            {Object.entries(schoolStageLabels).map(([value, label]) => (
              <ChoiceChip
                key={value}
                type="radio"
                name="schoolStage"
                value={value}
                label={label}
                checked={stage === value}
                onChange={() => setStage(value)}
              />
            ))}
          </fieldset>
          {grades.length ? (
            <Field id="gradeYear" label="Série ou ano" error={errors.gradeYear} optional>
              <NativeSelect name="gradeYear" defaultValue={defaults.gradeYear ?? ""} {...fieldA11y("gradeYear", errors.gradeYear)}>
                <option value="">Prefiro não informar</option>
                {grades.map((grade) => (
                  <option key={grade.value} value={grade.value}>
                    {grade.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
        </section>

        {/* Etapa 3 */}
        <section hidden={step !== 2} className="mt-5 flex flex-col gap-4" aria-label="Matérias de interesse">
          <p className="text-[0.9375rem] text-ink-2">Escolha as matérias que você quer acompanhar de perto.</p>
          <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <legend className="sr-only">Matérias</legend>
            {subjects.map((subject) => (
              <ChoiceChip
                key={subject.id}
                name="subjectIds"
                value={subject.id}
                defaultChecked={defaults.subjectIds.includes(subject.id)}
                label={
                  <span className="flex items-center gap-2">
                    <SubjectIcon icon={subject.icon} className="size-4" />
                    {subject.name}
                  </span>
                }
              />
            ))}
          </fieldset>
          {errors.subjectIds ? <p className="text-sm text-destructive-text">{errors.subjectIds[0]}</p> : null}
        </section>

        {/* Etapa 4 */}
        <section hidden={step !== 3} className="mt-5 flex flex-col gap-6" aria-label="Objetivos e dificuldades">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-bold">O que você quer alcançar?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(goalOptions).map(([value, label]) => (
                <ChoiceChip key={value} name="goals" value={value} label={label} defaultChecked={defaults.goals.includes(value)} />
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-bold">Onde você sente mais dificuldade?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(difficultyOptions).map(([value, label]) => (
                <ChoiceChip
                  key={value}
                  name="difficulties"
                  value={value}
                  label={label}
                  defaultChecked={defaults.difficulties.includes(value)}
                />
              ))}
            </div>
          </fieldset>
        </section>

        {/* Etapa 5 */}
        <section hidden={step !== 4} className="mt-5 flex flex-col gap-6" aria-label="Rotina de estudo">
          <input type="hidden" name="timezone" value={timezone} />
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-bold">Meta diária de estudo</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {dailyGoalOptions.map((minutes) => (
                <ChoiceChip
                  key={minutes}
                  type="radio"
                  name="dailyGoalMinutes"
                  value={minutes}
                  defaultChecked={defaults.dailyGoalMinutes === minutes}
                  label={`${minutes} min`}
                  chipClassName="items-center"
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-bold">Dias em que você pode estudar</legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <ChoiceChip
                  key={day}
                  name="studyWeekdays"
                  value={day}
                  defaultChecked={defaults.studyWeekdays.includes(day)}
                  label={weekdayLabel(day)}
                  chipClassName="items-center capitalize"
                />
              ))}
            </div>
            {errors.studyWeekdays ? <p className="text-sm text-destructive-text">{errors.studyWeekdays[0]}</p> : null}
          </fieldset>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-bold">Melhor período</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(periodOptions).map(([value, label]) => (
                <ChoiceChip
                  key={value}
                  type="radio"
                  name="preferredPeriod"
                  value={value}
                  defaultChecked={defaults.preferredPeriod === value}
                  label={label}
                  chipClassName="items-center"
                />
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-muted-foreground">Fuso horário detectado: {timezone}</p>
        </section>

        {/* Etapa 6 */}
        <section hidden={step !== 5} className="mt-5 flex flex-col gap-4" aria-label="Próximas provas">
          <p className="text-[0.9375rem] text-ink-2">
            Cadastre provas que já estão marcadas. Elas aparecem no calendário e ajudam a montar seu plano.
          </p>
          {exams.map((exam, index) => (
            <div key={exam.key} className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
              <Field id={`examTitle-${exam.key}`} label="Prova" error={errors[`exams.${index}.title`]}>
                <Input
                  id={`examTitle-${exam.key}`}
                  name="examTitle"
                  placeholder="Ex.: ENEM 1º dia"
                  value={exam.title}
                  onChange={(event) =>
                    setExams((list) => list.map((item) => (item.key === exam.key ? { ...item, title: event.target.value } : item)))
                  }
                />
              </Field>
              <Field id={`examDate-${exam.key}`} label="Data" error={errors[`exams.${index}.date`]}>
                <Input
                  id={`examDate-${exam.key}`}
                  name="examDate"
                  type="date"
                  min={today}
                  value={exam.date}
                  onChange={(event) =>
                    setExams((list) => list.map((item) => (item.key === exam.key ? { ...item, date: event.target.value } : item)))
                  }
                />
              </Field>
              <Field id={`examSubject-${exam.key}`} label="Matéria" optional>
                <NativeSelect
                  id={`examSubject-${exam.key}`}
                  name="examSubject"
                  value={exam.subjectId}
                  onChange={(event) =>
                    setExams((list) =>
                      list.map((item) => (item.key === exam.key ? { ...item, subjectId: event.target.value } : item)),
                    )
                  }
                >
                  <option value="">Várias</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover prova"
                onClick={() => setExams((list) => list.filter((item) => item.key !== exam.key))}
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
          {errors.exams ? <p className="text-sm text-destructive-text">{errors.exams[0]}</p> : null}
          {exams.length < 5 ? (
            <Button
              variant="outline"
              className="self-start"
              onClick={() => setExams((list) => [...list, { key: Date.now(), title: "", date: "", subjectId: "" }])}
            >
              <PlusIcon />
              Adicionar prova
            </Button>
          ) : null}
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>
            <ArrowLeftIcon />
            Voltar
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap gap-2">
          {current.optional && !isLast ? (
            <Button variant="ghost" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
              Pular
            </Button>
          ) : null}
          {isLast ? (
            <SubmitButton size="lg" pendingLabel="Salvando…">
              Concluir e ir para o painel
            </SubmitButton>
          ) : (
            <Button size="lg" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
              Continuar
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
