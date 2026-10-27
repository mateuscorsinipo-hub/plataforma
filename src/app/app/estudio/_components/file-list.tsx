"use client";

import {
  CircleAlertIcon,
  FileImageIcon,
  FileTextIcon,
  LoaderCircleIcon,
  PresentationIcon,
  RefreshCwIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/primitives";
import { formatBytes, type UploadKind } from "@/lib/config/uploads";
import type { FileSummary } from "@/lib/documents/summary";
import { cn } from "@/lib/utils";

import { deleteStudyFile } from "../actions";

const kindIcon: Record<UploadKind, LucideIcon> = {
  pdf: FileTextIcon,
  docx: FileTextIcon,
  pptx: PresentationIcon,
  image: FileImageIcon,
  text: FileTextIcon,
};

function describe(file: FileSummary): string {
  const parts: string[] = [formatBytes(file.sizeBytes)];
  if (file.pageCount && file.kind === "pdf") parts.push(`${file.pageCount} ${file.pageCount === 1 ? "página" : "páginas"}`);
  if (file.pageCount && file.kind === "pptx") parts.push(`${file.pageCount} slides`);
  if (file.charCount) parts.push(`${file.charCount.toLocaleString("pt-BR")} caracteres`);
  return parts.join(" · ");
}

export type PendingUpload = { localId: string; name: string; label: string };

export function FileList({
  files,
  pending,
  selected,
  maxSelected,
  onToggle,
  onRetry,
  onDeleted,
  retrying,
}: {
  files: FileSummary[];
  pending: PendingUpload[];
  selected: Set<string>;
  maxSelected: number;
  onToggle: (id: string, checked: boolean) => void;
  onRetry: (id: string) => void;
  onDeleted: (id: string) => void;
  retrying: Set<string>;
}) {
  const [deleting, startDelete] = useTransition();

  if (!files.length && !pending.length) {
    return <p className="rounded-xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">Nenhum arquivo ainda. Envie um material para começar.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
      {pending.map((upload) => (
        <li key={upload.localId} className="flex items-center gap-3 px-3.5 py-3">
          <LoaderCircleIcon className="size-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{upload.name}</p>
            <p className="text-xs text-muted-foreground" role="status">
              {upload.label}
            </p>
          </div>
        </li>
      ))}
      {files.map((file) => {
        const Icon = kindIcon[file.kind] ?? FileTextIcon;
        const ready = file.status === "ready";
        const isSelected = selected.has(file.id);
        const disabled = !ready || (!isSelected && selected.size >= maxSelected);
        return (
          <li key={file.id} className={cn("flex items-center gap-3 px-3.5 py-3", isSelected && "bg-secondary/50")}>
            <Checkbox
              id={`arquivo-${file.id}`}
              checked={isSelected}
              disabled={disabled}
              onCheckedChange={(checked) => onToggle(file.id, checked === true)}
              aria-label={`Usar ${file.name}`}
            />
            <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <label htmlFor={`arquivo-${file.id}`} className={cn("min-w-0 flex-1", ready && "cursor-pointer")}>
              <span className="block truncate text-sm font-medium" title={file.name}>
                {file.name}
              </span>
              {file.status === "failed" ? (
                <span className="flex items-start gap-1 text-xs text-destructive-text">
                  <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {file.errorMessage ?? "Falha no processamento."}
                </span>
              ) : (
                <span className="block text-xs text-muted-foreground">{describe(file)}</span>
              )}
            </label>
            {file.status === "processing" || retrying.has(file.id) ? (
              <Badge variant="neutral">
                <LoaderCircleIcon className="animate-spin" /> Processando
              </Badge>
            ) : null}
            {file.status === "failed" && !retrying.has(file.id) ? (
              <Button variant="ghost" size="icon-sm" aria-label={`Tentar processar ${file.name} de novo`} onClick={() => onRetry(file.id)}>
                <RefreshCwIcon className="size-4" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Excluir ${file.name}`}
              disabled={deleting}
              onClick={() =>
                startDelete(async () => {
                  const result = await deleteStudyFile(file.id);
                  if (result.ok) {
                    onDeleted(file.id);
                    toast.success("Arquivo excluído.");
                  } else toast.error(result.error);
                })
              }
            >
              <Trash2Icon className="size-4" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
