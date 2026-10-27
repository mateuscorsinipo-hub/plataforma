"use client";

import { FileTextIcon, LoaderCircleIcon, PlusIcon, UploadIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/primitives";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { uploadAndProcess, uploadStageLabels, type UploadStage } from "@/lib/client/upload";
import { formatBytes, studyAccept } from "@/lib/config/uploads";
import type { FileSummary } from "@/lib/documents/summary";

export function SourcesSheet({
  open,
  onOpenChange,
  attached,
  library,
  maxSources,
  maxUploadBytes,
  onAttach,
  onRemove,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attached: FileSummary[];
  library: FileSummary[];
  maxSources: number;
  maxUploadBytes: number;
  onAttach: (files: FileSummary[]) => Promise<boolean>;
  onRemove: (fileId: string) => Promise<void>;
  onUploaded: (file: FileSummary) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const attachedIds = new Set(attached.map((f) => f.id));
  const available = library.filter((f) => !attachedIds.has(f.id) && f.status === "ready");
  const slots = Math.max(0, maxSources - attached.length);

  async function attachSelected() {
    const files = available.filter((f) => selected.has(f.id));
    if (!files.length) return;
    if (files.length > slots) {
      toast.error(`Você pode anexar mais ${slots} ${slots === 1 ? "documento" : "documentos"} nesta conversa.`);
      return;
    }
    setBusy(true);
    const ok = await onAttach(files);
    setBusy(false);
    if (ok) setSelected(new Set());
  }

  async function handleUpload(file: File) {
    if (file.size > maxUploadBytes) {
      toast.error(`O arquivo passa do limite de ${formatBytes(maxUploadBytes)} do seu plano.`);
      return;
    }
    if (slots <= 0) {
      toast.error("Esta conversa já está no limite de documentos.");
      return;
    }
    try {
      const summary = await uploadAndProcess(file, { purpose: "study", onStage: setUploadStage });
      onUploaded(summary);
      await onAttach([summary]);
      toast.success("Documento pronto e anexado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o arquivo.");
    } finally {
      setUploadStage(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 p-0">
        <div className="border-b border-border px-5 pt-5 pb-4">
          <SheetTitle className="font-display text-lg font-bold">Documentos da conversa</SheetTitle>
          <SheetDescription className="mt-1 text-sm text-muted-foreground">
            O tutor consulta estes documentos e cita os trechos usados. Até {maxSources} por conversa.
          </SheetDescription>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Anexados ({attached.length})</h3>
            {attached.length ? (
              <ul className="flex flex-col gap-1.5">
                {attached.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <FileTextIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate" title={f.name}>
                      {f.name}
                    </span>
                    <Button variant="ghost" size="icon-sm" aria-label={`Remover ${f.name}`} onClick={() => onRemove(f.id)}>
                      <XIcon className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum documento anexado. Sem documentos, o tutor responde com conhecimento geral.</p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Enviar novo documento</h3>
            <input
              ref={inputRef}
              type="file"
              accept={studyAccept}
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleUpload(file);
              }}
            />
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={uploadStage !== null}>
              {uploadStage ? <LoaderCircleIcon className="animate-spin" /> : <UploadIcon />}
              {uploadStage ? uploadStageLabels[uploadStage] : "PDF, Word, PowerPoint, foto ou texto"}
            </Button>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Da sua biblioteca</h3>
            {available.length ? (
              <ul className="flex flex-col gap-1.5">
                {available.map((f) => (
                  <li key={f.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/60">
                      <Checkbox
                        checked={selected.has(f.id)}
                        onCheckedChange={(checked) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (checked === true) next.add(f.id);
                            else next.delete(f.id);
                            return next;
                          })
                        }
                      />
                      <span className="min-w-0 flex-1 truncate" title={f.name}>
                        {f.name}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Os arquivos processados no Estúdio aparecem aqui.</p>
            )}
          </section>
        </div>
        <div className="border-t border-border px-5 py-4">
          <Button className="w-full" onClick={attachSelected} disabled={!selected.size || busy}>
            {busy ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
            Anexar {selected.size ? `(${selected.size})` : ""}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
