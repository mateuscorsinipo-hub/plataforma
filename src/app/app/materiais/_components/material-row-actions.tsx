"use client";

import { EllipsisVerticalIcon, EyeIcon, PencilIcon, SendIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import Link from "next/link";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { deleteMaterial, submitMaterial, withdrawMaterial } from "../actions";

export function submittedMessage(status: string): string {
  return status === "published" ? "Material publicado na biblioteca." : "Enviado para a moderação. Acompanhe o andamento em Meus materiais.";
}

export function MaterialRowActions({
  id,
  slug,
  title,
  status,
  visibility,
}: {
  id: string;
  slug: string;
  title: string;
  status: string;
  visibility: string;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const canSubmit = (status === "draft" || status === "rejected") && visibility !== "private";
  const canWithdraw = status === "pending_review" || status === "published" || status === "rejected";

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error ?? "Não foi possível concluir.");
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações de “${title}”`} disabled={pending}>
            <EllipsisVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/app/biblioteca/${slug}`}>
              <EyeIcon /> Ver página
            </Link>
          </DropdownMenuItem>
          {status !== "removed" ? (
            <DropdownMenuItem asChild>
              <Link href={`/app/materiais/${id}/editar`}>
                <PencilIcon /> Editar
              </Link>
            </DropdownMenuItem>
          ) : null}
          {canSubmit ? (
            <DropdownMenuItem
              onSelect={() =>
                startTransition(async () => {
                  const result = await submitMaterial(id);
                  if (result.ok) toast.success(submittedMessage(result.status));
                  else toast.error(result.error);
                })
              }
            >
              <SendIcon /> Enviar para publicação
            </DropdownMenuItem>
          ) : null}
          {canWithdraw ? (
            <DropdownMenuItem onSelect={() => run(() => withdrawMaterial(id), "O material voltou a ser rascunho.")}>
              <Undo2Icon /> {status === "published" ? "Despublicar" : "Voltar para rascunho"}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
            <Trash2Icon /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              O material sai da biblioteca e some dos salvos de quem guardou. Avaliações e visualizações também são apagadas. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  const result = await deleteMaterial(id);
                  if (result && !result.ok) toast.error(result.error);
                });
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
