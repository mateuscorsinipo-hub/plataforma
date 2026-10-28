"use client";

import { useActionState } from "react";

import { Field, fieldA11y } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/validation/action-state";

import { sendGuardianInvite } from "../actions";

export function GuardianInviteForm({ hasPending }: { hasPending: boolean }) {
  const [state, formAction] = useActionState(sendGuardianInvite, initialActionState);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <h2 className="text-lg font-bold">{hasPending ? "Enviar para outro responsável" : "Enviar pedido ao responsável"}</h2>
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field id="guardianName" label="Nome do responsável" error={errors.guardianName}>
        <Input name="guardianName" {...fieldA11y("guardianName", errors.guardianName)} />
      </Field>
      <Field id="guardianEmail" label="E-mail do responsável" error={errors.guardianEmail}>
        <Input name="guardianEmail" type="email" {...fieldA11y("guardianEmail", errors.guardianEmail)} />
      </Field>
      <SubmitButton className="self-start" pendingLabel="Enviando…">
        Enviar pedido
      </SubmitButton>
    </form>
  );
}
