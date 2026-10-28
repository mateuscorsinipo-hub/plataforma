"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/primitives";
import { Field, fieldA11y } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { CHILD_AGE_LIMIT, ageOn } from "@/lib/validation/age";
import { useToday } from "@/lib/hooks/use-today";
import { initialActionState } from "@/lib/validation/action-state";

import { signUp } from "../actions";
import { GoogleButton } from "../google-button";

export function SignUpForm() {
  const [state, formAction] = useActionState(signUp, initialActionState);
  const [birthDate, setBirthDate] = useState("");
  const errors = state.fieldErrors ?? {};
  const age = useMemo(() => (/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? ageOn(birthDate) : null), [birthDate]);
  const needsGuardian = age !== null && age >= 0 && age < CHILD_AGE_LIMIT;
  const isMinor = age !== null && age < 18;
  const today = useToday();

  return (
    <div className="flex flex-col gap-5">
      <GoogleButton next="/onboarding" />
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <Field id="displayName" label="Como quer ser chamado" error={errors.displayName}>
          <Input name="displayName" autoComplete="given-name" required maxLength={60} {...fieldA11y("displayName", errors.displayName)} />
        </Field>
        <Field id="email" label="E-mail" error={errors.email}>
          <Input name="email" type="email" autoComplete="email" inputMode="email" required {...fieldA11y("email", errors.email)} />
        </Field>
        <Field id="password" label="Senha" description="Pelo menos 8 caracteres, com letras e números." error={errors.password}>
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            {...fieldA11y("password", errors.password, true)}
          />
        </Field>
        <Field
          id="birthDate"
          label="Data de nascimento"
          description="Usamos para aplicar as proteções de privacidade adequadas à sua idade."
          error={errors.birthDate}
        >
          <Input
            name="birthDate"
            type="date"
            required
            max={today}
            min="1900-01-01"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            {...fieldA11y("birthDate", errors.birthDate, true)}
          />
        </Field>

        {needsGuardian ? (
          <fieldset className="flex flex-col gap-4 rounded-2xl border border-[#f1dda8] bg-warning-soft/60 p-4">
            <legend className="px-1 text-sm font-bold text-warning-text">Autorização do responsável</legend>
            <p className="text-sm leading-relaxed text-warning-text">
              Para quem tem menos de {CHILD_AGE_LIMIT} anos, a conta só é liberada depois que um dos pais ou responsável
              autorizar. Vamos enviar um e-mail para essa pessoa.
            </p>
            <Field id="guardianName" label="Nome do responsável" error={errors.guardianName}>
              <Input name="guardianName" autoComplete="off" {...fieldA11y("guardianName", errors.guardianName)} />
            </Field>
            <Field id="guardianEmail" label="E-mail do responsável" error={errors.guardianEmail}>
              <Input name="guardianEmail" type="email" autoComplete="off" {...fieldA11y("guardianEmail", errors.guardianEmail)} />
            </Field>
          </fieldset>
        ) : isMinor ? (
          <Alert tone="info">
            Contas de menores de 18 anos começam com o perfil privado. Use o Grifo com o conhecimento dos seus pais ou
            responsáveis.
          </Alert>
        ) : null}

        <div className="flex items-start gap-3">
          <Checkbox id="acceptTerms" name="acceptTerms" value="on" aria-invalid={Boolean(errors.acceptTerms) || undefined} className="mt-0.5" />
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
        {errors.acceptTerms ? (
          <p role="alert" className="-mt-2 text-[0.8125rem] font-medium text-destructive-text">
            {errors.acceptTerms[0]}
          </p>
        ) : null}

        <SubmitButton size="lg" pendingLabel="Criando conta…">
          Criar conta
        </SubmitButton>
      </form>
    </div>
  );
}
