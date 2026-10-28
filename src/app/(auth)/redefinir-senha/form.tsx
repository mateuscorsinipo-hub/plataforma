"use client";

import { useActionState } from "react";

import { Field, fieldA11y } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/validation/action-state";

import { resetPassword } from "../actions";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPassword, initialActionState);
  const errors = state.fieldErrors ?? {};
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold">Criar nova senha</h1>
        <p className="text-[0.9375rem] text-ink-2">Escolha uma senha com pelo menos 8 caracteres, letras e números.</p>
      </div>
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        <Field id="password" label="Nova senha" error={errors.password}>
          <Input name="password" type="password" autoComplete="new-password" required minLength={8} {...fieldA11y("password", errors.password)} />
        </Field>
        <Field id="confirm" label="Repita a nova senha" error={errors.confirm}>
          <Input name="confirm" type="password" autoComplete="new-password" required {...fieldA11y("confirm", errors.confirm)} />
        </Field>
        <SubmitButton size="lg" pendingLabel="Salvando…">
          Salvar nova senha
        </SubmitButton>
      </form>
    </div>
  );
}
