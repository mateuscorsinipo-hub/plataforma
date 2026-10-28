"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, fieldA11y } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/validation/action-state";

import { requestPasswordReset } from "../actions";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialActionState);
  const errors = state.fieldErrors ?? {};
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold">Recuperar senha</h1>
        <p className="text-[0.9375rem] text-ink-2">Informe o e-mail da sua conta para receber um link de redefinição.</p>
      </div>
      {state.ok ? (
        <Alert tone="success">{state.message}</Alert>
      ) : (
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
          <Field id="email" label="E-mail" error={errors.email}>
            <Input name="email" type="email" autoComplete="email" inputMode="email" required {...fieldA11y("email", errors.email)} />
          </Field>
          <SubmitButton size="lg" pendingLabel="Enviando…">
            Enviar link
          </SubmitButton>
        </form>
      )}
      <Link href="/entrar" className="text-center text-sm font-semibold text-primary hover:underline">
        Voltar para o login
      </Link>
    </div>
  );
}
