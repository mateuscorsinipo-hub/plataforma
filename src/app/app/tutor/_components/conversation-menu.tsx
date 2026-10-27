"use client";

import { EllipsisVerticalIcon, NotebookTextIcon, PencilIcon, Trash2Icon } from "lucide-react";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { deleteConversation, renameConversation, summarizeConversation } from "../actions";

export function ConversationMenu({
  conversationId,
  title,
  hasSummary,
  aiAvailable,
  onRenamed,
  onSummarized,
}: {
  conversationId: string;
  title: string;
  hasSummary: boolean;
  aiAvailable: boolean;
  onRenamed: (title: string) => void;
  onSummarized: (summary: string) => void;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(title);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Opções da conversa">
            <EllipsisVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setName(title);
              setRenameOpen(true);
            }}
          >
            <PencilIcon /> Renomear
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!aiAvailable || pending}
            onSelect={() =>
              startTransition(async () => {
                const result = await summarizeConversation(conversationId);
                if (result.ok) {
                  onSummarized(result.summary);
                  toast.success("Resumo pronto.");
                } else toast.error(result.error);
              })
            }
          >
            <NotebookTextIcon /> {hasSummary ? "Atualizar resumo" : "Resumir conversa"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
            <Trash2Icon /> Excluir conversa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear conversa</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await renameConversation(conversationId, name);
                if (result.ok) {
                  setRenameOpen(false);
                  onRenamed(name.trim());
                  toast.success("Conversa renomeada.");
                } else toast.error(result.error);
              });
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nome-conversa">Nome</Label>
              <Input id="nome-conversa" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending || !name.trim()}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              As mensagens e as imagens enviadas nela serão apagadas para sempre. Os documentos anexados continuam na sua biblioteca.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              destructive
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  const result = await deleteConversation(conversationId);
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
