"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { Alert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/validation/action-state";

import { resendConfirmation } from "../../actions";

export function ResendForm() {
  const params = useSearchParams();
  const withGuardian = params.get("responsavel") === "1";
  const [state, formAction] = useActionState(resendConfirmation, initialActionState);

  return (
    <div className="flex flex-col gap-4">
      {withGuardian ? (
        <Alert tone="info" title="Falta a autorização do responsável">
          Também enviamos um e-mail para o responsável que você informou. Sua conta é liberada quando ele autorizar.
        </Alert>
      ) : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <form action={formAction} className="flex flex-col gap-2 rounded-2xl border border-border p-4">
        <Label htmlFor="resend-email">Não chegou? Reenviar para</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="resend-email" name="email" type="email" autoComplete="email" required className="flex-1" />
          <SubmitButton variant="outline" pendingLabel="Enviando…">
            Reenviar
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
