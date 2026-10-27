"use client";

import { PencilIcon, PlayIcon, Trash2Icon } from "lucide-react";
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

import { deleteQuiz, startAttempt } from "../actions";

export function QuizActions({ quizId, canStart, hasOpenAttempt, kindLabel }: { quizId: string; canStart: boolean; hasOpenAttempt: boolean; kindLabel: string }) {
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={!canStart || pending}
        onClick={() =>
          startTransition(async () => {
            const result = await startAttempt(quizId);
            if (result && !result.ok) toast.error(result.error);
          })
        }
      >
        <PlayIcon /> {hasOpenAttempt ? "Continuar tentativa" : "Começar"}
      </Button>
      <Button variant="outline" asChild>
        <Link href={`/app/quizzes/${quizId}/editar`}>
          <PencilIcon /> Editar questões
        </Link>
      </Button>
      <Button variant="ghost" className="text-destructive-text" onClick={() => setDeleteOpen(true)}>
        <Trash2Icon /> Excluir
      </Button>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este {kindLabel}?</AlertDialogTitle>
            <AlertDialogDescription>As questões e todas as tentativas e respostas serão apagadas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  const result = await deleteQuiz(quizId);
                  if (result && !result.ok) toast.error(result.error);
                });
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
