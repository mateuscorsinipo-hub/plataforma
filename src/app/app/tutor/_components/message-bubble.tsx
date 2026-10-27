"use client";

import { CircleAlertIcon, FileTextIcon, RotateCcwIcon, SparklesIcon } from "lucide-react";

import { CopyButton } from "@/components/ai/copy-button";
import { MarkdownView } from "@/components/ai/markdown";
import { Button } from "@/components/ui/button";
import type { Citation } from "@/lib/ai/sources";
import { cn } from "@/lib/utils";

import type { LocalMessage } from "./types";

function pagesLabel(c: Pick<Citation, "pageStart" | "pageEnd">): string {
  if (!c.pageStart) return "";
  if (!c.pageEnd || c.pageEnd === c.pageStart) return `p. ${c.pageStart}`;
  return `p. ${c.pageStart}–${c.pageEnd}`;
}

function Citations({ messageId, citations }: { messageId: string; citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Fontes do seu material</p>
      <ol className="flex flex-col gap-1.5">
        {citations.map((c) => (
          <li key={c.n} id={`fonte-${messageId}-${c.n}`} className="scroll-mt-24">
            <details className="group rounded-lg bg-muted/60 px-3 py-2 text-sm">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-secondary text-[0.7rem] font-bold text-secondary-foreground">
                  {c.n}
                </span>
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 truncate">{c.fileName}</span>
                {pagesLabel(c) ? <span className="shrink-0 text-muted-foreground">{pagesLabel(c)}</span> : null}
              </summary>
              {c.excerpt ? (
                <p className="mt-2 border-l-2 border-border pl-3 text-[0.8125rem] leading-relaxed text-ink-2">
                  {c.excerpt}
                  {c.excerpt.length >= 400 ? "…" : ""}
                </p>
              ) : null}
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function MessageBubble({
  message,
  thinking,
  isLast,
  onRetry,
}: {
  message: LocalMessage;
  thinking: boolean;
  isLast: boolean;
  onRetry: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[88%] flex-col items-end gap-2 sm:max-w-[75%]">
          {message.attachments.length ? (
            <div className="flex flex-wrap justify-end gap-2">
              {message.attachments.map((a) =>
                a.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária do Storage privado
                  <img key={a.fileId} src={a.url} alt={a.name} className="size-28 rounded-xl border border-border object-cover" />
                ) : (
                  <span key={a.fileId} className="rounded-lg bg-muted px-2.5 py-1 text-xs text-ink-2">
                    {a.name}
                  </span>
                ),
              )}
            </div>
          ) : null}
          {message.content ? (
            <div className="rounded-2xl rounded-br-md bg-primary px-4 py-3 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-primary-foreground">
              {message.content}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const streaming = message.status === "streaming";
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary" aria-hidden="true">
        <SparklesIcon className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {message.content ? (
          <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-card">
            <MarkdownView
              content={message.content}
              citationNumbers={message.citations.map((c) => c.n)}
              citationIdPrefix={`fonte-${message.id}`}
              className="text-[0.9375rem]"
            />
            {streaming ? <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary align-middle" aria-hidden="true" /> : null}
            <Citations messageId={message.id} citations={message.citations} />
          </div>
        ) : streaming ? (
          <div className="flex w-fit items-center gap-2 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-card" role="status">
            <span className="flex gap-1" aria-hidden="true">
              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary" />
            </span>
            {thinking ? "Pensando na melhor explicação…" : "Gerando resposta…"}
          </div>
        ) : null}

        {message.status === "error" ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#f3c9c6] bg-destructive-soft px-3.5 py-2.5 text-sm text-destructive-text" role="alert">
            <CircleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{message.errorMessage ?? "A resposta falhou."}</span>
            {isLast && message.retryable !== false ? (
              <Button size="sm" variant="outline" onClick={onRetry} className="h-8">
                <RotateCcwIcon className="size-4" /> Tentar novamente
              </Button>
            ) : null}
          </div>
        ) : null}

        {message.status === "cancelled" ? <p className="text-xs text-muted-foreground">Resposta interrompida.</p> : null}

        {!streaming && message.content ? (
          <div className={cn("-ml-2 flex flex-wrap items-center gap-1")}>
            <CopyButton text={message.content} />
            {isLast ? (
              <Button variant="ghost" size="sm" className="h-8 px-2.5 text-muted-foreground" onClick={onRetry}>
                <RotateCcwIcon className="size-4" /> Gerar de novo
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
