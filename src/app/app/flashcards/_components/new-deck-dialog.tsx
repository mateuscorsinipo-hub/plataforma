"use client";

import { PlusIcon } from "lucide-react";
import { useActionState, useState } from "react";

import { SubjectSelect } from "@/components/learning/subject-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/validation/action-state";

import { createDeck } from "../actions";

export function NewDeckDialog({ subjects, label = "Novo baralho" }: { subjects: { id: string; name: string }[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createDeck, initialActionState);
  const errors = state.fieldErrors ?? {};
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo baralho</DialogTitle>
          <DialogDescription>Depois de criar, adicione cartões um a um ou importe uma lista.</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          {state.error && !Object.keys(errors).length ? <Alert tone="danger">{state.error}</Alert> : null}
          <Field id="titulo-baralho" label="Nome" error={errors.title}>
            <Input name="title" maxLength={120} required autoFocus {...fieldA11y("titulo-baralho", errors.title)} />
          </Field>
          <Field id="materia-baralho" label="Matéria" optional>
            <SubjectSelect id="materia-baralho" name="subjectId" subjects={subjects} />
          </Field>
          <Field id="descricao-baralho" label="Descrição" optional error={errors.description}>
            <Textarea name="description" rows={2} maxLength={500} {...fieldA11y("descricao-baralho", errors.description)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pendingLabel="Criando…">Criar baralho</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
