"use client";

import { FileUpIcon, PauseIcon, PencilIcon, PlayIcon, PlusIcon, SettingsIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SubjectSelect } from "@/components/learning/subject-select";
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
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cardStateLabels, type CardStateName } from "@/lib/domain/srs";
import { cn } from "@/lib/utils";

import { addCard, deleteCard, deleteDeck, importCards, setCardSuspended, updateCard, updateDeck } from "../actions";

export type EditorCard = {
  id: string;
  front: string;
  back: string;
  explanation: string | null;
  state: CardStateName;
  suspended: boolean;
  dueLabel: string;
};

type Deck = { id: string; title: string; description: string | null; subjectId: string | null };

function CardForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: { front: string; back: string; explanation: string | null };
  submitLabel: string;
  onSubmit: (values: { front: string; back: string; explanation: string }) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [front, setFront] = useState(initial?.front ?? "");
  const [back, setBack] = useState(initial?.back ?? "");
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [pending, startTransition] = useTransition();
  const prefix = initial ? "editar" : "novo";
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const ok = await onSubmit({ front, back, explanation });
          if (ok && !initial) {
            setFront("");
            setBack("");
            setExplanation("");
            document.getElementById(`${prefix}-frente`)?.focus();
          }
        });
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}-frente`}>Frente</Label>
          <Textarea id={`${prefix}-frente`} value={front} onChange={(e) => setFront(e.target.value)} rows={3} maxLength={2000} required placeholder="Pergunta, termo ou lacuna" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}-verso`}>Verso</Label>
          <Textarea id={`${prefix}-verso`} value={back} onChange={(e) => setBack(e.target.value)} rows={3} maxLength={4000} required placeholder="Resposta" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${prefix}-explicacao`}>
          Explicação <span className="font-normal text-muted-foreground">(opcional, aparece depois de responder)</span>
        </Label>
        <Input id={`${prefix}-explicacao`} value={explanation} onChange={(e) => setExplanation(e.target.value)} maxLength={4000} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !front.trim() || !back.trim()}>
          {initial ? null : <PlusIcon />} {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function DeckEditor({
  deck,
  cards,
  subjects,
  dueCount,
}: {
  deck: Deck;
  cards: EditorCard[];
  subjects: { id: string; name: string }[];
  dueCount: number;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [settings, setSettings] = useState({ title: deck.title, description: deck.description ?? "", subjectId: deck.subjectId ?? "" });
  const [pending, startTransition] = useTransition();

  const counts = cards.reduce(
    (acc, card) => {
      if (card.suspended) acc.suspended += 1;
      else acc[card.state] += 1;
      return acc;
    },
    { new: 0, learning: 0, review: 0, relearning: 0, suspended: 0 } as Record<CardStateName | "suspended", number>,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {dueCount > 0 ? (
          <Button asChild>
            <Link href={`/app/flashcards/revisar?baralho=${deck.id}&modo=completa`}>
              <PlayIcon /> Revisar ({dueCount})
            </Link>
          </Button>
        ) : (
          <Badge variant="success" className="h-11 rounded-xl px-4 text-sm">
            Nada para revisar agora
          </Badge>
        )}
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <FileUpIcon /> Importar lista
        </Button>
        <Button variant="outline" onClick={() => setSettingsOpen(true)}>
          <SettingsIcon /> Configurar
        </Button>
        <Button variant="ghost" className="text-destructive-text" onClick={() => setDeleteOpen(true)}>
          <Trash2Icon /> Excluir baralho
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ["Total", cards.length],
            ["Novos", counts.new],
            ["Aprendendo", counts.learning + counts.relearning],
            ["Em revisão", counts.review],
            ["Suspensos", counts.suspended],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-card px-4 py-3">
            <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
            <dd className="font-display text-2xl font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>

      <Card>
        <h2 className="text-base font-bold">Novo cartão</h2>
        <CardForm
          submitLabel="Adicionar cartão"
          onSubmit={async (values) => {
            const result = await addCard(deck.id, values);
            if (!result.ok) toast.error(result.error);
            return result.ok;
          }}
        />
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="cartoes-titulo">
        <h2 id="cartoes-titulo" className="text-base font-bold">
          Cartões ({cards.length})
        </h2>
        {cards.length ? (
          <ul className="flex flex-col gap-2">
            {cards.map((card) => (
              <li key={card.id} className={cn("rounded-2xl border border-border bg-card p-4", card.suspended && "opacity-60")}>
                {editingId === card.id ? (
                  <CardForm
                    initial={card}
                    submitLabel="Salvar"
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (values) => {
                      const result = await updateCard(card.id, values);
                      if (!result.ok) toast.error(result.error);
                      else setEditingId(null);
                      return result.ok;
                    }}
                  />
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                      <p className="text-sm font-semibold whitespace-pre-line">{card.front}</p>
                      <p className="text-sm whitespace-pre-line text-ink-2">{card.back}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant={card.suspended ? "neutral" : card.state === "new" ? "default" : "outline"} className="mr-1">
                        {card.suspended ? "Suspenso" : `${cardStateLabels[card.state]} · ${card.dueLabel}`}
                      </Badge>
                      <Button variant="ghost" size="icon-sm" aria-label="Editar cartão" onClick={() => setEditingId(card.id)}>
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={card.suspended ? "Voltar a revisar" : "Suspender cartão"}
                        title={card.suspended ? "Voltar a revisar" : "Suspender (não aparece nas revisões)"}
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await setCardSuspended(card.id, !card.suspended);
                            if (!result.ok) toast.error(result.error);
                          })
                        }
                      >
                        {card.suspended ? <PlayIcon className="size-4" /> : <PauseIcon className="size-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Excluir cartão"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await deleteCard(card.id);
                            if (!result.ok) toast.error(result.error);
                          })
                        }
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
            Este baralho ainda não tem cartões. Adicione acima ou importe uma lista.
          </p>
        )}
      </section>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar cartões</DialogTitle>
            <DialogDescription>
              Uma linha por cartão, com frente e verso separados por ponto e vírgula, tabulação ou hífen. Listas exportadas do Anki e do Quizlet
              funcionam.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await importCards(deck.id, importText);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                const skipped = result.skipped.length;
                toast.success(
                  `${result.imported} ${result.imported === 1 ? "cartão importado" : "cartões importados"}` +
                    (skipped
                      ? `. ${skipped} ${skipped === 1 ? "linha ignorada" : "linhas ignoradas"} por falta de separador (linha ${result.skipped.slice(0, 8).join(", ")}${skipped > 8 ? "…" : ""}).`
                      : "."),
                );
                setImportText("");
                setImportOpen(false);
              });
            }}
          >
            <Label htmlFor="importar-texto" className="sr-only">
              Cartões
            </Label>
            <Textarea
              id="importar-texto"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={10}
              placeholder={"Mitocôndria;Organela responsável pela respiração celular\nCapital do Peru;Lima"}
              className="font-mono text-sm"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending || !importText.trim()}>
                Importar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar baralho</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await updateDeck(deck.id, settings);
                if (result.ok) {
                  setSettingsOpen(false);
                  toast.success("Baralho atualizado.");
                } else toast.error(result.error);
              });
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cfg-titulo">Nome</Label>
              <Input id="cfg-titulo" value={settings.title} onChange={(e) => setSettings({ ...settings, title: e.target.value })} maxLength={120} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cfg-materia">Matéria</Label>
              <SubjectSelect id="cfg-materia" subjects={subjects} value={settings.subjectId} onChange={(e) => setSettings({ ...settings, subjectId: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cfg-descricao">Descrição</Label>
              <Textarea id="cfg-descricao" value={settings.description} onChange={(e) => setSettings({ ...settings, description: e.target.value })} rows={2} maxLength={500} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o baralho “{deck.title}”?</AlertDialogTitle>
            <AlertDialogDescription>Todos os {cards.length} cartões e o histórico de revisões deles serão apagados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  const result = await deleteDeck(deck.id);
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
