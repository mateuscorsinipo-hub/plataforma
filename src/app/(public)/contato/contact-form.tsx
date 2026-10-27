"use client";

import { CircleCheckIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";

import { Field, fieldA11y } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/validation/common";
import { type ContactTopic, contactTopics } from "@/lib/validation/contact";

import { sendContactMessage } from "./actions";

function isTopic(value: string | null): value is ContactTopic {
  return value !== null && value in contactTopics;
}

export function ContactForm() {
  const params = useSearchParams();
  const initialTopic = params.get("assunto");
  const [state, formAction] = useActionState(sendContactMessage, initialActionState);
  const [topic, setTopic] = useState<ContactTopic>(isTopic(initialTopic) ? initialTopic : "support");
  const errors = state.fieldErrors ?? {};

  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 text-center">
        <CircleCheckIcon className="size-10 text-success" aria-hidden="true" />
        <h2 className="font-display text-xl font-bold">Obrigado!</h2>
        <p className="max-w-md text-sm text-ink-2" role="status">
          {state.message}
        </p>
      </div>
    );
  }

  const needsUrl = topic === "copyright" || topic === "report";

  return (
    <form action={formAction} className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6" noValidate>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Nome" error={errors.name}>
          <Input name="name" autoComplete="name" required {...fieldA11y("name", errors.name)} />
        </Field>
        <Field id="email" label="E-mail para resposta" error={errors.email}>
          <Input name="email" type="email" autoComplete="email" required {...fieldA11y("email", errors.email)} />
        </Field>
      </div>
      <Field id="topic" label="Assunto" error={errors.topic}>
        <NativeSelect
          name="topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value as ContactTopic)}
          {...fieldA11y("topic", errors.topic)}
        >
          {Object.entries(contactTopics).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {needsUrl ? (
        <Field
          id="referenceUrl"
          label="Link do material ou perfil"
          description="Copie o endereço da página do material na plataforma."
          error={errors.referenceUrl}
          optional={topic === "report"}
        >
          <Input
            name="referenceUrl"
            type="url"
            inputMode="url"
            placeholder="https://"
            {...fieldA11y("referenceUrl", errors.referenceUrl, true)}
          />
        </Field>
      ) : null}
      <Field
        id="message"
        label="Mensagem"
        description={
          topic === "copyright"
            ? "Identifique a obra protegida, sua relação com ela (autor, editora, representante) e o trecho reproduzido."
            : topic === "privacy"
              ? "Diga qual direito quer exercer (acesso, correção, exclusão, portabilidade...) e o e-mail da conta."
              : undefined
        }
        error={errors.message}
      >
        <Textarea name="message" rows={6} required {...fieldA11y("message", errors.message, true)} />
      </Field>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Não preencha este campo</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <p className="text-xs text-muted-foreground">
        Usamos seus dados apenas para responder a esta mensagem, conforme a política de privacidade.
      </p>
      <SubmitButton className="self-start" pendingLabel="Enviando…">
        Enviar mensagem
      </SubmitButton>
    </form>
  );
}
