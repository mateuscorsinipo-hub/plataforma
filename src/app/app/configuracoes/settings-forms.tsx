"use client";

import { DownloadIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { SubjectIcon } from "@/components/brand/subject-chip";
import { Button } from "@/components/ui/button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { Field, fieldA11y } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/submit-button";
import { gradeOptions, schoolStageLabels, type SchoolStage } from "@/lib/config/subjects";
import { timezoneOptions } from "@/lib/config/timezones";
import { weekdayLabel } from "@/lib/domain/dates";
import { type ActionState, initialActionState } from "@/lib/validation/action-state";
import { dailyGoalOptions, difficultyOptions, goalOptions, periodOptions } from "@/lib/validation/onboarding";

import {
  changeEmail,
  changePassword,
  deleteAccount,
  updatePreferences,
  updatePrivacy,
  updateProfile,
  updateSubjects,
} from "./actions";

/** Mostra o resultado de cada formulário como aviso discreto. */
function useResultToast(state: ActionState) {
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);
}

export function ProfileForm({
  defaults,
}: {
  defaults: { displayName: string; username: string; bio: string | null; schoolStage: string | null; gradeYear: number | null };
}) {
  const [state, action] = useActionState(updateProfile, initialActionState);
  const [stage, setStage] = useState(defaults.schoolStage ?? "");
  const errors = state.fieldErrors ?? {};
  useResultToast(state);
  const grades = gradeOptions[(stage || "outro") as SchoolStage] ?? [];
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="displayName" label="Nome de exibição" error={errors.displayName}>
          <Input name="displayName" defaultValue={defaults.displayName} maxLength={60} {...fieldA11y("displayName", errors.displayName)} />
        </Field>
        <Field id="username" label="Nome de usuário" description="Aparece nos materiais publicados e no ranking." error={errors.username}>
          <Input name="username" defaultValue={defaults.username} maxLength={24} autoComplete="off" {...fieldA11y("username", errors.username, true)} />
        </Field>
      </div>
      <Field id="bio" label="Biografia" optional error={errors.bio}>
        <Textarea name="bio" defaultValue={defaults.bio ?? ""} maxLength={280} rows={3} {...fieldA11y("bio", errors.bio)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="schoolStage" label="Etapa de ensino" optional>
          <NativeSelect name="schoolStage" value={stage} onChange={(event) => setStage(event.target.value)} id="schoolStage">
            <option value="">Prefiro não informar</option>
            {Object.entries(schoolStageLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {grades.length ? (
          <Field id="gradeYear" label="Série ou ano" optional>
            <NativeSelect name="gradeYear" defaultValue={defaults.gradeYear ?? ""} id="gradeYear">
              <option value="">Prefiro não informar</option>
              {grades.map((grade) => (
                <option key={grade.value} value={grade.value}>
                  {grade.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
      </div>
      <SubmitButton className="self-start" pendingLabel="Salvando…">
        Salvar perfil
      </SubmitButton>
    </form>
  );
}

export function SubjectsForm({ subjects, selected }: { subjects: { id: string; name: string; icon: string }[]; selected: string[] }) {
  const [state, action] = useActionState(updateSubjects, initialActionState);
  useResultToast(state);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <fieldset className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="sr-only">Matérias de interesse</legend>
        {subjects.map((subject) => (
          <ChoiceChip
            key={subject.id}
            name="subjectIds"
            value={subject.id}
            defaultChecked={selected.includes(subject.id)}
            label={
              <span className="flex items-center gap-2">
                <SubjectIcon icon={subject.icon} className="size-4" />
                {subject.name}
              </span>
            }
          />
        ))}
      </fieldset>
      <SubmitButton className="self-start" pendingLabel="Salvando…">
        Salvar matérias
      </SubmitButton>
    </form>
  );
}

export function PreferencesForm({
  defaults,
}: {
  defaults: {
    dailyGoalMinutes: number;
    studyWeekdays: number[];
    preferredPeriod: string | null;
    goals: string[];
    difficulties: string[];
    explanationLevel: string;
    timezone: string;
    emailReminders: boolean;
    emailAvailable: boolean;
  };
}) {
  const [state, action] = useActionState(updatePreferences, initialActionState);
  const errors = state.fieldErrors ?? {};
  useResultToast(state);
  const zones = timezoneOptions.some((tz) => tz.value === defaults.timezone)
    ? timezoneOptions
    : [{ value: defaults.timezone, label: defaults.timezone }, ...timezoneOptions];
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-bold">Meta diária</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {dailyGoalOptions.map((minutes) => (
            <ChoiceChip key={minutes} type="radio" name="dailyGoalMinutes" value={minutes} defaultChecked={defaults.dailyGoalMinutes === minutes} label={`${minutes} min`} />
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-bold">Dias de estudo</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => (
            <ChoiceChip key={day} name="studyWeekdays" value={day} defaultChecked={defaults.studyWeekdays.includes(day)} label={weekdayLabel(day)} chipClassName="capitalize" />
          ))}
        </div>
        {errors.studyWeekdays ? <p className="text-sm text-destructive-text">{errors.studyWeekdays[0]}</p> : null}
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-bold">Melhor período</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(periodOptions).map(([value, label]) => (
            <ChoiceChip key={value} type="radio" name="preferredPeriod" value={value} defaultChecked={defaults.preferredPeriod === value} label={label} />
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-bold">Objetivos</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(goalOptions).map(([value, label]) => (
            <ChoiceChip key={value} name="goals" value={value} defaultChecked={defaults.goals.includes(value)} label={label} />
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-bold">Dificuldades</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(difficultyOptions).map(([value, label]) => (
            <ChoiceChip key={value} name="difficulties" value={value} defaultChecked={defaults.difficulties.includes(value)} label={label} />
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="explanationLevel" label="Nível das explicações do tutor">
          <NativeSelect id="explanationLevel" name="explanationLevel" defaultValue={defaults.explanationLevel}>
            <option value="simple">Simples e direto</option>
            <option value="balanced">Equilibrado</option>
            <option value="deep">Aprofundado</option>
          </NativeSelect>
        </Field>
        <Field id="timezone" label="Fuso horário" error={errors.timezone}>
          <NativeSelect id="timezone" name="timezone" defaultValue={defaults.timezone}>
            {zones.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-border p-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="emailReminders">Lembretes por e-mail</Label>
          <p className="text-sm text-muted-foreground">
            {defaults.emailAvailable
              ? "Avisos de provas e eventos com lembrete marcado no calendário."
              : "O envio de e-mails ainda não está configurado nesta instalação."}
          </p>
        </div>
        <Switch id="emailReminders" name="emailReminders" value="on" defaultChecked={defaults.emailReminders} disabled={!defaults.emailAvailable} />
      </div>
      <SubmitButton className="self-start" pendingLabel="Salvando…">
        Salvar preferências
      </SubmitButton>
    </form>
  );
}

function PrivacyToggle({ id, label, description, defaultChecked, disabled }: { id: string; label: string; description: string; defaultChecked: boolean; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border p-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} name={id} value="on" defaultChecked={defaultChecked} disabled={disabled} />
    </div>
  );
}

export function PrivacyForm({
  defaults,
  restricted,
}: {
  defaults: { profileVisibility: string; showInLeaderboard: boolean; showStatsPublicly: boolean; showAchievementsPublicly: boolean };
  restricted: boolean;
}) {
  const [state, action] = useActionState(updatePrivacy, initialActionState);
  useResultToast(state);
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {restricted ? (
        <Alert tone="info">
          Para menores de 16 anos, o perfil fica privado e as estatísticas não são públicas, a menos que um responsável autorize.
        </Alert>
      ) : null}
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-bold">Quem pode ver seu perfil</legend>
        <ChoiceChip type="radio" name="profileVisibility" value="private" defaultChecked={defaults.profileVisibility !== "public"} label="Privado" description="Só seu @usuário e materiais publicados." />
        <ChoiceChip type="radio" name="profileVisibility" value="public" defaultChecked={defaults.profileVisibility === "public"} disabled={restricted} label="Público" description="Nome, foto, bio e matérias visíveis." />
      </fieldset>
      <PrivacyToggle id="showInLeaderboard" label="Aparecer no ranking da liga" description="Mostra seu @usuário e XP da semana para quem está na mesma liga." defaultChecked={defaults.showInLeaderboard} />
      <PrivacyToggle id="showStatsPublicly" label="Mostrar estatísticas no perfil" description="Nível, XP e maior sequência (só com perfil público)." defaultChecked={defaults.showStatsPublicly} disabled={restricted} />
      <PrivacyToggle id="showAchievementsPublicly" label="Mostrar conquistas no perfil" description="As medalhas que você desbloqueou." defaultChecked={defaults.showAchievementsPublicly} />
      <SubmitButton className="self-start" pendingLabel="Salvando…">
        Salvar privacidade
      </SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, initialActionState);
  const errors = state.fieldErrors ?? {};
  useResultToast(state);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field id="currentPassword" label="Senha atual" error={errors.currentPassword}>
        <Input name="currentPassword" type="password" autoComplete="current-password" {...fieldA11y("currentPassword", errors.currentPassword)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="newPassword" label="Nova senha" error={errors.newPassword}>
          <Input name="newPassword" type="password" autoComplete="new-password" {...fieldA11y("newPassword", errors.newPassword)} />
        </Field>
        <Field id="confirm" label="Repita a nova senha" error={errors.confirm}>
          <Input name="confirm" type="password" autoComplete="new-password" {...fieldA11y("confirm", errors.confirm)} />
        </Field>
      </div>
      <SubmitButton variant="outline" className="self-start" pendingLabel="Salvando…">
        Trocar senha
      </SubmitButton>
    </form>
  );
}

export function EmailForm({ currentEmail }: { currentEmail: string | null }) {
  const [state, action] = useActionState(changeEmail, initialActionState);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}
      <Field id="email" label="Novo e-mail" description={currentEmail ? `Atual: ${currentEmail}` : undefined} error={errors.email}>
        <Input name="email" type="email" autoComplete="email" {...fieldA11y("email", errors.email, true)} />
      </Field>
      <SubmitButton variant="outline" className="self-start" pendingLabel="Enviando…">
        Trocar e-mail
      </SubmitButton>
    </form>
  );
}

export function DeleteAccountForm({ usesPassword }: { usesPassword: boolean }) {
  const [state, action] = useActionState(deleteAccount, initialActionState);
  const [open, setOpen] = useState(false);
  const errors = state.fieldErrors ?? {};
  if (!open) {
    return (
      <Button variant="destructive" className="self-start" onClick={() => setOpen(true)}>
        Excluir minha conta
      </Button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl border border-[#f3c9c6] bg-destructive-soft/50 p-4" noValidate>
      <p className="text-sm leading-relaxed text-destructive-text">
        Isso apaga definitivamente seu perfil, arquivos, conversas, materiais (inclusive os publicados), flashcards, quizzes,
        planos e histórico. Não é possível desfazer. Se quiser guardar uma cópia, exporte seus dados antes.
      </p>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field id="confirmation" label="Digite EXCLUIR para confirmar" error={errors.confirmation}>
        <Input name="confirmation" autoComplete="off" {...fieldA11y("confirmation", errors.confirmation)} />
      </Field>
      {usesPassword ? (
        <Field id="deletePassword" label="Sua senha" error={errors.password}>
          <Input id="deletePassword" name="password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password) || undefined} />
        </Field>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="destructive-solid" pendingLabel="Excluindo…">
          Excluir definitivamente
        </SubmitButton>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function ExportDataButton() {
  return (
    <Button asChild variant="outline" className="self-start">
      <a href="/app/configuracoes/exportar" download>
        <DownloadIcon />
        Exportar meus dados (JSON)
      </a>
    </Button>
  );
}
