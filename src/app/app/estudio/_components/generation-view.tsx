"use client";

import {
  ArrowLeftIcon,
  CheckIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
  PrinterIcon,
  SaveIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { MarkdownView } from "@/components/ai/markdown";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GenerationContent, NormalizedQuestion } from "@/lib/ai/studio/content";
import { difficultyLabels, kindByName } from "@/lib/ai/studio/kinds";
import type { GenerationDetail } from "@/lib/data/studio";
import { cn } from "@/lib/utils";

import { deleteGeneration, renameGeneration, saveGenerationMarkdown } from "../actions";
import { kindIcons } from "./kind-icons";

/** O título já aparece no cabeçalho da página: não repete o "# Título" inicial do Markdown. */
function withoutLeadingTitle(markdown: string): string {
  return markdown.replace(/^\s*#\s[^\n]*\n+/, "");
}

function QuestionCard({ question, index, reveal }: { question: NormalizedQuestion; index: number; reveal: boolean }) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 break-inside-avoid">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="neutral" shape="tag">
          Questão {index + 1}
        </Badge>
        <Badge variant="outline" shape="tag">
          {difficultyLabels[question.difficulty]}
        </Badge>
        <span className="text-muted-foreground">{question.topic}</span>
      </div>
      <MarkdownView content={question.prompt} className="text-[0.9375rem]" />
      {question.type === "open" ? (
        <p className="text-sm text-muted-foreground italic">Questão aberta: responda por escrito.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {question.options.map((option) => {
            const correct = reveal && option.id === question.correctOptionId;
            return (
              <li
                key={option.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border border-border px-3.5 py-2.5 text-sm",
                  correct && "border-success-text/40 bg-success-soft text-success-text",
                )}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold uppercase">
                  {question.type === "true_false" ? (option.id === "true" ? "V" : "F") : option.id}
                </span>
                <span className="min-w-0 flex-1">
                  <MarkdownView content={option.text} className="text-sm" />
                </span>
                {correct ? <CheckIcon className="size-4 shrink-0" aria-label="Alternativa correta" /> : null}
              </li>
            );
          })}
        </ul>
      )}
      {reveal ? (
        <div className="flex flex-col gap-2 rounded-xl bg-muted/70 px-4 py-3 text-sm">
          {question.type === "open" && question.referenceAnswer ? (
            <div>
              <p className="font-semibold">Resposta esperada</p>
              <MarkdownView content={question.referenceAnswer} className="text-sm" />
            </div>
          ) : null}
          {question.explanation ? (
            <div>
              <p className="font-semibold">Explicação</p>
              <MarkdownView content={question.explanation} className="text-sm" />
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function StructuredContent({ content, reveal }: { content: GenerationContent; reveal: boolean }) {
  if (content.kind === "flashcards") {
    return (
      <ul className="grid gap-3 sm:grid-cols-2">
        {content.cards.map((card, index) => (
          <li key={index} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 break-inside-avoid">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Cartão {index + 1}</p>
            <MarkdownView content={card.front} className="font-semibold" />
            {reveal ? (
              <div className="border-t border-border pt-3">
                <MarkdownView content={card.back} className="text-[0.9375rem]" />
                {card.hint ? <p className="mt-2 text-sm text-muted-foreground">Dica: {card.hint}</p> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }
  if (content.kind === "quiz" || content.kind === "mock_exam") {
    return (
      <div className="flex flex-col gap-4">
        {content.kind === "mock_exam" ? (
          <div className="rounded-2xl border border-border bg-card p-5 text-sm">
            <p>
              <strong>Tempo sugerido:</strong> {content.durationMinutes} minutos · {content.questions.length} questões
            </p>
            {content.instructions ? <p className="mt-1 text-muted-foreground">{content.instructions}</p> : null}
          </div>
        ) : null}
        <ol className="flex flex-col gap-4">
          {content.questions.map((question, index) => (
            <QuestionCard key={index} question={question} index={index} reveal={reveal} />
          ))}
        </ol>
      </div>
    );
  }
  return null;
}

export function GenerationView({ generation, createdLabel }: { generation: GenerationDetail; createdLabel: string }) {
  const definition = kindByName[generation.kind];
  const Icon = kindIcons[generation.kind];
  const isDocument = definition.output === "document";
  const completed = generation.status === "completed";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(generation.markdown ?? "");
  const [previewDraft, setPreviewDraft] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState(generation.title);
  const [pending, startTransition] = useTransition();

  return (
    <article className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link href="/app/estudio" className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground print:hidden">
          <ArrowLeftIcon className="size-4" /> Estúdio
        </Link>
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary print:hidden">
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h1 className="font-display text-[1.75rem] leading-tight font-extrabold sm:text-[2.125rem]">{generation.title}</h1>
            <p className="text-sm text-muted-foreground">
              {definition.label} · {completed ? "gerado com IA em" : "criado em"} {createdLabel}
              {generation.sources.length ? ` · a partir de ${generation.sources.map((s) => s.name).join(", ")}` : ""}
            </p>
          </div>
        </div>

        {completed ? (
          <div className="flex flex-wrap gap-2 print:hidden">
            {isDocument && !editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <PencilIcon className="size-4" /> Editar
              </Button>
            ) : null}
            {!isDocument ? (
              <Button variant="outline" size="sm" onClick={() => setReveal((r) => !r)}>
                {reveal ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                {reveal ? "Esconder respostas" : generation.kind === "flashcards" ? "Mostrar versos" : "Mostrar gabarito"}
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setRenameOpen(true)}>
              <TypeIcon className="size-4" /> Renomear
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`/app/estudio/${generation.id}/exportar`} download>
                <DownloadIcon className="size-4" /> Exportar (.md)
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <PrinterIcon className="size-4" /> Imprimir ou PDF
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive-text" onClick={() => setDeleteOpen(true)}>
              <Trash2Icon className="size-4" /> Excluir
            </Button>
          </div>
        ) : null}
      </div>

      {generation.params.truncated === true ? (
        <Alert tone="info">O material era maior que o limite do seu plano: a IA usou apenas a parte inicial dele.</Alert>
      ) : null}

      {generation.status === "failed" ? (
        <Alert
          tone="danger"
          title="A geração falhou"
          action={
            <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}>
              Excluir
            </Button>
          }
        >
          {generation.errorMessage ?? "Tente gerar de novo no estúdio. O crédito usado foi devolvido."}
        </Alert>
      ) : null}

      {generation.status === "pending" ? (
        <Alert
          tone="warning"
          title="Geração não concluída"
          action={
            <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}>
              Excluir
            </Button>
          }
        >
          Esta geração foi interrompida antes de terminar. Gere novamente no estúdio.
        </Alert>
      ) : null}

      {completed && isDocument ? (
        editing ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Formato Markdown: # títulos, **negrito**, - listas, $fórmulas$.</p>
              <Button variant="ghost" size="sm" onClick={() => setPreviewDraft((p) => !p)}>
                {previewDraft ? "Voltar a editar" : "Pré-visualizar"}
              </Button>
            </div>
            {previewDraft ? (
              <div className="rounded-2xl border border-border bg-card p-5 sm:p-7">
                <MarkdownView content={draft} />
              </div>
            ) : (
              <>
                <label htmlFor="editor-material" className="sr-only">
                  Conteúdo do material
                </label>
                <Textarea id="editor-material" value={draft} onChange={(e) => setDraft(e.target.value)} rows={24} className="font-mono text-sm leading-relaxed" />
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await saveGenerationMarkdown(generation.id, draft);
                    if (result.ok) {
                      setEditing(false);
                      setPreviewDraft(false);
                      toast.success("Alterações salvas.");
                    } else toast.error(result.error);
                  })
                }
              >
                <SaveIcon /> Salvar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(generation.markdown ?? "");
                  setEditing(false);
                  setPreviewDraft(false);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-8 print:border-none print:p-0">
            <MarkdownView content={withoutLeadingTitle(generation.markdown ?? "")} />
          </div>
        )
      ) : null}

      {completed && !isDocument && generation.content ? <StructuredContent content={generation.content} reveal={reveal} /> : null}

      {completed ? (
        <p className="text-xs text-muted-foreground print:hidden">
          Conteúdo gerado automaticamente por IA a partir do seu material. Confira informações importantes antes de usar em provas.
        </p>
      ) : null}

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear material</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await renameGeneration(generation.id, title);
                if (result.ok) {
                  setRenameOpen(false);
                  toast.success("Material renomeado.");
                } else toast.error(result.error);
              });
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="titulo-material">Título</Label>
              <Input id="titulo-material" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending || !title.trim()}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este material?</AlertDialogTitle>
            <AlertDialogDescription>O material gerado será apagado para sempre. Seus arquivos enviados continuam no estúdio.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              destructive
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  const result = await deleteGeneration(generation.id);
                  if (result && !result.ok) toast.error(result.error);
                });
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
