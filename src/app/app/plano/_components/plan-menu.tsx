"use client";

import { ArchiveIcon, EllipsisVerticalIcon, Trash2Icon, WandSparklesIcon } from "lucide-react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { deletePlan, reorganizePlan, setPlanStatus } from "../actions";

export function ReorganizeButton({ planId, overdue }: { planId: string; overdue: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await reorganizePlan(planId);
          if (!result.ok) toast.error(result.error);
          else
            toast.success(
              `${result.moved} ${result.moved === 1 ? "tarefa reagendada" : "tarefas reagendadas"}` +
                (result.skipped ? `; ${result.skipped} sem espaço até a prova foram puladas.` : "."),
            );
        })
      }
    >
      <WandSparklesIcon /> Reorganizar {overdue} {overdue === 1 ? "atrasada" : "atrasadas"}
    </Button>
  );
}

export function PlanMenu({ planId, title }: { planId: string; title: string }) {
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Opções do plano" disabled={pending}>
            <EllipsisVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              startTransition(async () => {
                const result = await setPlanStatus(planId, "archived");
                if (result.ok) toast.success("Plano arquivado. Crie um novo quando quiser.");
                else toast.error(result.error);
              })
            }
          >
            <ArchiveIcon /> Arquivar plano
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
            <Trash2Icon /> Excluir plano
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{title}”?</AlertDialogTitle>
            <AlertDialogDescription>As tarefas do plano e a data da prova no calendário serão apagadas. O XP já ganho continua.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  const result = await deletePlan(planId);
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

export function ActivatePlanButton({ planId }: { planId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setPlanStatus(planId, "active");
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      Reativar
    </Button>
  );
}
