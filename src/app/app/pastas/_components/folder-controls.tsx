"use client";

import { FolderInputIcon, FolderMinusIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/primitives";
import type { FolderItemKind } from "@/lib/validation/materials";

import { addItemsToFolder, deleteFolder, moveToFolder } from "../actions";
import { FolderDialog, type FolderDraft } from "./folder-dialog";

export type Candidate = { kind: FolderItemKind; id: string; title: string; meta: string };

const groupLabels: Record<FolderItemKind, string> = {
  file: "Arquivos",
  generation: "Do Estúdio",
  deck: "Baralhos",
  quiz: "Quizzes e simulados",
  conversation: "Conversas do tutor",
  material: "Materiais salvos",
};

export function FolderControls({
  folder,
  subjects,
  candidates,
}: {
  folder: FolderDraft & { id: string };
  subjects: { id: string; name: string }[];
  candidates: Candidate[];
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => setAdding(true)}>
        <PlusIcon className="size-4" /> Adicionar itens
      </Button>
      <Button variant="outline" onClick={() => setEditing(true)}>
        <PencilIcon className="size-4" /> Editar
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" aria-label="Excluir pasta">
            <Trash2Icon className="size-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a pasta “{folder.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Só a pasta é excluída. Arquivos, baralhos, quizzes, conversas e materiais salvos continuam no app, fora de pastas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  const result = await deleteFolder(folder.id);
                  if (result && !result.ok) toast.error(result.error);
                });
              }}
            >
              Excluir pasta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {editing ? <FolderDialog draft={folder} subjects={subjects} onClose={() => setEditing(false)} /> : null}
      {adding ? <AddItemsDialog folderId={folder.id} candidates={candidates} onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

function AddItemsDialog({ folderId, candidates, onClose }: { folderId: string; candidates: Candidate[]; onClose: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const groups = (Object.keys(groupLabels) as FolderItemKind[])
    .map((kind) => ({ kind, items: candidates.filter((c) => c.kind === kind) }))
    .filter((g) => g.items.length);

  function toggle(key: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function submit() {
    const items = [...selected].map((key) => {
      const [kind, id] = key.split(":") as [FolderItemKind, string];
      return { kind, id };
    });
    startTransition(async () => {
      const result = await addItemsToFolder(folderId, items);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.moved === 1 ? "1 item adicionado." : `${result.moved} itens adicionados.`);
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar à pasta</DialogTitle>
          <DialogDescription>Itens que ainda não estão em nenhuma pasta.</DialogDescription>
        </DialogHeader>
        {groups.length ? (
          <div className="-mx-1 flex max-h-[55vh] flex-col gap-4 overflow-y-auto px-1">
            {groups.map((group) => (
              <fieldset key={group.kind} className="flex flex-col gap-1">
                <legend className="mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">{groupLabels[group.kind]}</legend>
                {group.items.map((item) => {
                  const key = `${item.kind}:${item.id}`;
                  return (
                    <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted">
                      <Checkbox checked={selected.has(key)} onCheckedChange={(checked) => toggle(key, checked === true)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.meta}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
            Tudo o que você tem já está organizado em pastas.
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={pending || !selected.size} onClick={submit}>
            <FolderInputIcon className="size-4" /> Adicionar {selected.size ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveFromFolderButton({ kind, id, title }: { kind: FolderItemKind; id: string; title: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Tirar “${title}” da pasta`}
      title="Tirar da pasta"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await moveToFolder(kind, id, null);
          if (result.ok) toast.success("Item retirado da pasta.");
          else toast.error(result.error);
        })
      }
    >
      <FolderMinusIcon className="size-4" />
    </Button>
  );
}
