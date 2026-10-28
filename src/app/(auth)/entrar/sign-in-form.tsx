"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/validation/action-state";

import { resendConfirmation, signIn } from "../actions";
import { GoogleButton } from "../google-button";

const urlErrors: Record<string, string> = {
  link: "O link expirou ou já foi usado. Entre com sua senha ou peça um novo link.",
  perfil: "Não encontramos o perfil da sua conta. Entre novamente ou fale com o suporte.",
  oauth: "Não foi possível concluir o login com o provedor externo.",
};

export function SignInForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/app";
  const urlError = urlErrors[params.get("erro") ?? ""];
  const [state, formAction] = useActionState(signIn, initialActionState);
  const [resendState, resendAction] = useActionState(resendConfirmation, initialActionState);
  const [email, setEmail] = useState("");
  const errors = state.fieldErrors ?? {};
  const needsConfirmation = errors.resend?.includes("email_not_confirmed");

  return (
    <div className="flex flex-col gap-5">
      <GoogleButton next={next} />
      {urlError && !state.error ? <Alert tone="warning">{urlError}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {needsConfirmation ? (
        <form action={resendAction} className="flex flex-col gap-2">
          <input type="hidden" name="email" value={email} />
          {resendState.message ? (
            <Alert tone="success">{resendState.message}</Alert>
          ) : (
            <Button type="submit" variant="secondary" size="sm" className="self-start">
              Reenviar e-mail de confirmação
            </Button>
          )}
        </form>
      ) : null}
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <Field id="email" label="E-mail" error={errors.email}>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            {...fieldA11y("email", errors.email)}
          />
        </Field>
        <Field id="password" label="Senha" error={errors.password}>
          <Input name="password" type="password" autoComplete="current-password" required {...fieldA11y("password", errors.password)} />
        </Field>
        <Link href="/recuperar-senha" className="self-end text-sm font-semibold text-primary hover:underline">
          Esqueci minha senha
        </Link>
        <SubmitButton size="lg" pendingLabel="Entrando…">
          Entrar
        </SubmitButton>
      </form>
    </div>
  );
}
