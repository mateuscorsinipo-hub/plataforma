"use client";

import { FolderIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SubjectSelect } from "@/components/learning/subject-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { subjectColorClass } from "@/lib/config/subjects";
import { cn } from "@/lib/utils";
import { folderColors, type FolderInput } from "@/lib/validation/materials";

import { saveFolder } from "../actions";

export type FolderDraft = { id: string | null; name: string; color: string; subjectId: string; examDate: string };

const colorNames: Record<(typeof folderColors)[number], string> = {
  blue: "Azul",
  green: "Verde",
  purple: "Roxo",
  rose: "Rosa",
  amber: "Âmbar",
  teal: "Verde-azulado",
  orange: "Laranja",
  slate: "Cinza",
};

export function FolderDialog({
  draft,
  subjects,
  onClose,
  openAfterCreate = true,
}: {
  draft: FolderDraft;
  subjects: { id: string; name: string }[];
  onClose: () => void;
  openAfterCreate?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(draft);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const input: FolderInput = {
        name: form.name,
        color: form.color as FolderInput["color"],
        subjectId: form.subjectId,
        examDate: form.examDate,
      };
      const result = await saveFolder(form.id, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(form.id ? "Pasta atualizada." : "Pasta criada.");
      onClose();
      if (!form.id && openAfterCreate) router.push(`/app/pastas/${result.id}`);
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar pasta" : "Nova pasta"}</DialogTitle>
          <DialogDescription>Junte arquivos, resumos, baralhos, quizzes e materiais salvos de uma matéria ou prova.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pasta-nome">Nome</Label>
            <Input
              id="pasta-nome"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={80}
              required
              autoFocus
              placeholder="Ex.: Prova de Biologia — 2º bimestre"
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">Cor</legend>
            <div className="flex flex-wrap gap-2">
              {folderColors.map((color) => (
                <label key={color} className="cursor-pointer">
                  <input
                    type="radio"
                    name="pasta-cor"
                    value={color}
                    checked={form.color === color}
                    onChange={() => setForm({ ...form, color })}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl ring-offset-2 transition peer-checked:ring-2 peer-checked:ring-primary peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/40",
                      subjectColorClass(color),
                    )}
                  >
                    <FolderIcon className="size-5" aria-hidden="true" />
                    <span className="sr-only">{colorNames[color]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pasta-materia">
                Matéria <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <SubjectSelect id="pasta-materia" subjects={subjects} value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pasta-prova">
                Data da prova <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="pasta-prova" type="date" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
            </div>
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !form.name.trim()}>
              {form.id ? "Salvar" : "Criar pasta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewFolderButton({ subjects, label = "Nova pasta" }: { subjects: { id: string; name: string }[]; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <FolderIcon className="size-4" /> {label}
      </Button>
      {open ? (
        <FolderDialog draft={{ id: null, name: "", color: "blue", subjectId: "", examDate: "" }} subjects={subjects} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
