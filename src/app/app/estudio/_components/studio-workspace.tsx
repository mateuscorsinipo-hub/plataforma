"use client";

import { CameraIcon, ClipboardPasteIcon, CloudUploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generationKinds, type GenerationKind, type KindDefinition } from "@/lib/ai/studio/kinds";
import { errorMessageOf } from "@/lib/client/ndjson";
import { uploadAndProcess, uploadStageLabels } from "@/lib/client/upload";
import { formatBytes, imageAccept, studyAccept } from "@/lib/config/uploads";
import type { FileSummary } from "@/lib/documents/summary";
import { cn } from "@/lib/utils";

import { FileList, type PendingUpload } from "./file-list";
import { GenerateDialog } from "./generate-dialog";
import { kindIcons } from "./kind-icons";

let counter = 0;

export function StudioWorkspace({
  initialFiles,
  aiAvailable,
  supportsImages,
  maxSources,
  maxUploadBytes,
  maxCounts,
  generationsRemaining,
}: {
  initialFiles: FileSummary[];
  aiAvailable: boolean;
  supportsImages: boolean;
  maxSources: number;
  maxUploadBytes: number;
  maxCounts: Record<GenerationKind, number>;
  generationsRemaining: number;
}) {
  const router = useRouter();
  const [files, setFiles] = useState(initialFiles);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialFiles.filter((f) => f.status === "ready").slice(0, 1).map((f) => f.id)),
  );
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [tool, setTool] = useState<KindDefinition | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  async function upload(list: File[]) {
    for (const file of list) {
      if (file.size > maxUploadBytes) {
        toast.error(`${file.name}: passa do limite de ${formatBytes(maxUploadBytes)} do seu plano.`);
        continue;
      }
      const localId = `up-${++counter}`;
      setPending((prev) => [...prev, { localId, name: file.name, label: uploadStageLabels.preparing }]);
      try {
        const summary = await uploadAndProcess(file, {
          purpose: "study",
          onStage: (stage) => setPending((prev) => prev.map((p) => (p.localId === localId ? { ...p, label: uploadStageLabels[stage] } : p))),
        });
        setFiles((prev) => [summary, ...prev.filter((f) => f.id !== summary.id)]);
        setSelected((prev) => (prev.size < maxSources ? new Set(prev).add(summary.id) : prev));
        toast.success(`${summary.name} está pronto.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível enviar o arquivo.");
        router.refresh();
      } finally {
        setPending((prev) => prev.filter((p) => p.localId !== localId));
      }
    }
  }

  async function retry(id: string) {
    setRetrying((prev) => new Set(prev).add(id));
    try {
      const response = await fetch(`/api/uploads/${id}/process`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) {
        toast.error(await errorMessageOf(response));
        router.refresh();
        return;
      }
      const { file } = (await response.json()) as { file: FileSummary };
      setFiles((prev) => prev.map((f) => (f.id === id ? file : f)));
      toast.success(`${file.name} está pronto.`);
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function submitPaste() {
    const text = pasteText.trim();
    if (text.length < 50) {
      toast.error("Cole pelo menos algumas frases de conteúdo.");
      return;
    }
    const name = `${(pasteTitle.trim() || "Texto colado").replace(/[\\/]/g, " ").slice(0, 80)}.txt`;
    setPasteOpen(false);
    setPasteText("");
    setPasteTitle("");
    await upload([new File([text], name, { type: "text/plain" })]);
  }

  function chooseTool(definition: KindDefinition) {
    if (!aiAvailable) return;
    if (!selected.size) {
      toast.error("Escolha pelo menos um arquivo pronto na lista acima.");
      return;
    }
    if (generationsRemaining <= 0) {
      toast.error("Você usou todas as gerações do estúdio deste período.");
      return;
    }
    setTool(definition);
  }

  const selectedIds = files.filter((f) => selected.has(f.id) && f.status === "ready").map((f) => f.id);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Seu material</CardTitle>
          <CardDescription>
            PDF, Word, PowerPoint, fotos de caderno ou texto. Até {formatBytes(maxUploadBytes)} por arquivo. Selecione até {maxSources} para gerar.
          </CardDescription>
        </CardHeader>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void upload(Array.from(event.dataTransfer.files));
          }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-input bg-background px-4 py-7 text-center transition-colors",
            dragging && "border-primary bg-secondary/60",
          )}
        >
          <CloudUploadIcon className="size-8 text-primary" aria-hidden="true" />
          <p className="text-sm text-ink-2">
            <span className="hidden sm:inline">Arraste arquivos para cá ou escolha como enviar:</span>
            <span className="sm:hidden">Escolha como enviar:</span>
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={studyAccept}
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                void upload(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            <Button onClick={() => fileInput.current?.click()}>
              <CloudUploadIcon /> Enviar arquivo
            </Button>
            {supportsImages ? (
              <>
                <input
                  ref={cameraInput}
                  type="file"
                  accept={imageAccept}
                  capture="environment"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(event) => {
                    void upload(Array.from(event.target.files ?? []));
                    event.target.value = "";
                  }}
                />
                <Button variant="outline" onClick={() => cameraInput.current?.click()}>
                  <CameraIcon /> Tirar foto
                </Button>
              </>
            ) : null}
            <Button variant="outline" onClick={() => setPasteOpen(true)}>
              <ClipboardPasteIcon /> Colar texto
            </Button>
          </div>
        </div>

        <FileList
          files={files}
          pending={pending}
          selected={selected}
          maxSelected={maxSources}
          retrying={retrying}
          onToggle={(id, checked) =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (checked) next.add(id);
              else next.delete(id);
              return next;
            })
          }
          onRetry={(id) => void retry(id)}
          onDeleted={(id) => {
            setFiles((prev) => prev.filter((f) => f.id !== id));
            setSelected((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }}
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. O que você quer criar?</CardTitle>
          <CardDescription>
            {selectedIds.length
              ? `Usando ${selectedIds.length} ${selectedIds.length === 1 ? "arquivo selecionado" : "arquivos selecionados"}.`
              : "Selecione pelo menos um arquivo pronto acima."}
          </CardDescription>
        </CardHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {generationKinds.map((definition) => {
            const Icon = kindIcons[definition.kind];
            return (
              <button
                key={definition.kind}
                type="button"
                onClick={() => chooseTool(definition)}
                disabled={!aiAvailable}
                className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-55"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold">{definition.label}</span>
                  <span className="text-sm leading-snug text-muted-foreground">{definition.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <GenerateDialog
        key={tool?.kind ?? "none"}
        definition={tool}
        fileIds={selectedIds}
        maxCount={tool ? maxCounts[tool.kind] : 0}
        open={tool !== null}
        onOpenChange={(open) => {
          if (!open) setTool(null);
        }}
      />

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Colar texto</DialogTitle>
            <DialogDescription>O texto vira um arquivo na sua lista e pode ser usado em qualquer ferramenta.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitPaste();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="titulo-texto">Título</Label>
              <Input id="titulo-texto" value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} maxLength={80} placeholder="Ex.: Anotações de História" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="conteudo-texto">Conteúdo</Label>
              <Textarea id="conteudo-texto" value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={10} maxLength={500_000} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPasteOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pasteText.trim().length < 50}>
                Adicionar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
