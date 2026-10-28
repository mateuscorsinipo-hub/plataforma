"use client";

import { CreditCardIcon, SparklesIcon } from "lucide-react";
import { useActionState } from "react";

import { Alert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";

import { openBillingPortal, startCheckout } from "../actions";

type State = { ok: false; error: string } | null;

export function CheckoutButton({ label }: { label: string }) {
  const [state, action] = useActionState<State>(async () => startCheckout(), null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <SubmitButton size="lg" pendingLabel="Abrindo o pagamento…">
        <SparklesIcon /> {label}
      </SubmitButton>
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
    </form>
  );
}

export function PortalButton() {
  const [state, action] = useActionState<State>(async () => openBillingPortal(), null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <SubmitButton variant="outline" pendingLabel="Abrindo…">
        <CreditCardIcon /> Gerenciar assinatura
      </SubmitButton>
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
    </form>
  );
}
