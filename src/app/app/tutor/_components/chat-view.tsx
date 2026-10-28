"use client";

import {
  ArrowUpIcon,
  FileTextIcon,
  ImagePlusIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  MessagesSquareIcon,
  PaperclipIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { ChatStreamEvent } from "@/lib/ai/tutor/chat";
import { errorMessageOf, readNdjson } from "@/lib/client/ndjson";
import { uploadAndProcess } from "@/lib/client/upload";
import { imageAccept } from "@/lib/config/uploads";
import type { FileSummary } from "@/lib/documents/summary";
import { cn } from "@/lib/utils";

import { addConversationSources, removeConversationSource } from "../actions";
import { ConversationMenu } from "./conversation-menu";
import { emitTutorActivity } from "./events";
import { MessageBubble } from "./message-bubble";
import { SourcesSheet } from "./sources-sheet";
import type { AIState, LocalMessage, UsageState } from "./types";

type PendingImage = { localId: string; name: string; previewUrl: string; status: "uploading" | "ready" | "error"; fileId?: string };

const quickActions = [
  { label: "Explique mais simples", prompt: "Explique de um jeito mais simples, como se eu estivesse vendo isso pela primeira vez." },
  { label: "Aprofunde", prompt: "Aprofunde essa explicação com mais detalhes e um exemplo resolvido." },
  { label: "Dê uma analogia", prompt: "Me dê uma analogia do dia a dia para entender isso." },
  { label: "3 questões para praticar", prompt: "Crie 3 questões parecidas sobre esse assunto para eu praticar, com o gabarito comentado no final." },
];

const starters = [
  "Explique a diferença entre mitose e meiose com um quadro comparativo.",
  "Como resolver equações do 2º grau usando Bhaskara? Mostre um exemplo.",
  "Quais foram as causas da Revolução Francesa?",
  "Me ajude a montar a estrutura de uma redação do ENEM.",
];

let localCounter = 0;
const localId = (prefix: string) => `${prefix}-${Date.now()}-${++localCounter}`;

export function ChatView({
  conversationId: initialConversationId,
  title: initialTitle,
  summary: initialSummary,
  initialMessages,
  initialSources,
  libraryFiles,
  ai,
  usage: initialUsage,
  maxSources,
  maxUploadBytes,
  mobileList,
}: {
  conversationId: string | null;
  title: string;
  summary: string | null;
  initialMessages: LocalMessage[];
  initialSources: FileSummary[];
  libraryFiles: FileSummary[];
  ai: AIState;
  usage: UsageState;
  maxSources: number;
  maxUploadBytes: number;
  /** Lista de conversas (componente de servidor) exibida numa gaveta no celular. */
  mobileList?: React.ReactNode;
}) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(initialSummary);
  const [messages, setMessages] = useState<LocalMessage[]>(initialMessages);
  const [sources, setSources] = useState<FileSummary[]>(initialSources);
  const [library, setLibrary] = useState<FileSummary[]>(libraryFiles);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<PendingImage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [usage, setUsage] = useState(initialUsage);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const stickToBottom = useRef(true);

  // Acompanha o fim da conversa enquanto a resposta chega, salvo se o estudante rolou para cima.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const uploading = images.some((i) => i.status === "uploading");
  const readyImages = images.filter((i) => i.status === "ready" && i.fileId);
  const canSend = ai.available && !streaming && !uploading && (input.trim().length > 0 || readyImages.length > 0) && usage.remaining > 0;

  const patchLast = useCallback((patch: (m: LocalMessage) => LocalMessage) => {
    setMessages((prev) => {
      const next = [...prev];
      const index = next.length - 1;
      if (index >= 0 && next[index]!.role === "assistant") next[index] = patch(next[index]!);
      return next;
    });
  }, []);

  async function send(text: string, options: { regenerate?: boolean } = {}) {
    if (streaming) return;
    const message = text.trim();
    const attachments = options.regenerate ? [] : readyImages;
    if (!options.regenerate && !message && !attachments.length) return;

    const assistant: LocalMessage = { id: localId("a"), role: "assistant", content: "", status: "streaming", attachments: [], citations: [] };
    setMessages((prev) => {
      const base = options.regenerate && prev[prev.length - 1]?.role === "assistant" ? prev.slice(0, -1) : prev;
      if (options.regenerate) return [...base, assistant];
      const user: LocalMessage = {
        id: localId("u"),
        role: "user",
        content: message,
        status: "complete",
        attachments: attachments.map((i) => ({ fileId: i.fileId!, name: i.name, url: i.previewUrl })),
        citations: [],
      };
      return [...base, user, assistant];
    });
    if (!options.regenerate) {
      setInput("");
      setImages([]);
    }
    stickToBottom.current = true;
    setStreaming(true);
    setThinking(false);

    const controller = new AbortController();
    abortRef.current = controller;
    const isNewConversation = !conversationId;
    let activeId = conversationId;
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId ?? undefined,
          message,
          imageFileIds: attachments.map((i) => i.fileId),
          sourceFileIds: isNewConversation ? sources.map((s) => s.id) : [],
          regenerate: Boolean(options.regenerate),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = await errorMessageOf(response);
        patchLast((m) => ({ ...m, status: "error", errorMessage: error, retryable: response.status !== 429 && response.status !== 503 }));
        return;
      }
      for await (const event of readNdjson<ChatStreamEvent>(response)) {
        if (event.type === "meta") {
          activeId = event.conversationId;
          if (event.isNew) {
            setConversationId(event.conversationId);
            setTitle(event.title);
            // Atualiza a URL sem navegar: o chat continua montado enquanto a resposta chega.
            window.history.replaceState(null, "", `/app/tutor/${event.conversationId}`);
            emitTutorActivity({ conversationId: event.conversationId, title: event.title });
          }
        } else if (event.type === "thinking") {
          setThinking(true);
        } else if (event.type === "delta") {
          patchLast((m) => ({ ...m, content: m.content + event.text }));
        } else if (event.type === "done") {
          patchLast((m) => ({ ...m, id: event.messageId || m.id, status: "complete", citations: event.citations }));
          setUsage((u) => ({ ...u, remaining: event.remaining, limit: event.limit }));
          if (activeId) emitTutorActivity({ conversationId: activeId, usage: { used: event.limit - event.remaining, limit: event.limit } });
        } else if (event.type === "error") {
          patchLast((m) => ({
            ...m,
            id: event.messageId || m.id,
            status: "error",
            errorMessage: event.message,
            retryable: event.code !== "limit_reached",
          }));
          if (event.code === "limit_reached") setUsage((u) => ({ ...u, remaining: 0 }));
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        patchLast((m) => ({ ...m, status: m.content ? "cancelled" : "error", errorMessage: m.content ? undefined : "Geração interrompida." }));
      } else {
        patchLast((m) => ({ ...m, status: "error", errorMessage: "A conexão caiu durante a resposta. Tente novamente." }));
      }
    } finally {
      setStreaming(false);
      setThinking(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    const room = 4 - images.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) toast.error("Anexe no máximo 4 imagens por mensagem.");
    for (const file of picked) {
      const id = localId("img");
      const previewUrl = URL.createObjectURL(file);
      setImages((prev) => [...prev, { localId: id, name: file.name, previewUrl, status: "uploading" }]);
      try {
        const summary = await uploadAndProcess(file, { purpose: "chat" });
        setImages((prev) => prev.map((i) => (i.localId === id ? { ...i, status: "ready", fileId: summary.id } : i)));
      } catch (error) {
        setImages((prev) => prev.filter((i) => i.localId !== id));
        toast.error(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
      }
    }
  }

  async function attachSources(files: FileSummary[]): Promise<boolean> {
    if (!conversationId) {
      setSources((prev) => [...prev, ...files.filter((f) => !prev.some((p) => p.id === f.id))]);
      return true;
    }
    const result = await addConversationSources(
      conversationId,
      files.map((f) => f.id),
    );
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    setSources((prev) => [...prev, ...files.filter((f) => !prev.some((p) => p.id === f.id))]);
    return true;
  }

  async function removeSource(fileId: string) {
    if (conversationId) {
      const result = await removeConversationSource(conversationId, fileId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
    }
    setSources((prev) => prev.filter((s) => s.id !== fileId));
  }

  const last = messages[messages.length - 1];
  const showQuickActions = ai.available && !streaming && last?.role === "assistant" && last.status === "complete";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
        {mobileList ? (
          <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Ver conversas" onClick={() => setListOpen(true)}>
            <MessagesSquareIcon />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-bold">{conversationId ? title : "Nova conversa"}</h1>
          {sources.length ? (
            <p className="truncate text-xs text-muted-foreground">
              Consultando {sources.length} {sources.length === 1 ? "documento" : "documentos"}
            </p>
          ) : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => setSourcesOpen(true)} disabled={!ai.available}>
          <FileTextIcon className="size-4" />
          <span className="sr-only sm:not-sr-only">Documentos</span>
          {sources.length ? <span className="rounded-md bg-secondary px-1.5 text-xs text-secondary-foreground">{sources.length}</span> : null}
        </Button>
        {conversationId ? (
          <ConversationMenu
            conversationId={conversationId}
            title={title}
            hasSummary={Boolean(summary)}
            aiAvailable={ai.available}
            onRenamed={(next) => {
              setTitle(next);
              emitTutorActivity({ conversationId, title: next });
            }}
            onSummarized={setSummary}
          />
        ) : null}
      </header>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-5 sm:px-6"
        aria-live="polite"
      >
        {!ai.available ? (
          <Alert tone="warning" title="Tutor indisponível">
            {ai.notice ?? "Os recursos de IA ainda não foram configurados nesta instalação."}
          </Alert>
        ) : null}

        {summary ? (
          <details className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm">
            <summary className="cursor-pointer font-semibold">Resumo da conversa</summary>
            <p className="mt-2 leading-relaxed whitespace-pre-line text-ink-2">{summary}</p>
          </details>
        ) : null}

        {messages.length === 0 ? (
          <div className="m-auto flex max-w-xl flex-col items-center gap-5 py-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
              <MessageCircleIcon className="size-7" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="font-display text-2xl font-extrabold">Em que posso ajudar?</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Pergunte sobre qualquer matéria, envie a foto de um exercício ou anexe seus documentos para tirar dúvidas sobre eles.
              </p>
            </div>
            {ai.available ? (
              <div className="grid w-full gap-2 sm:grid-cols-2">
                {starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => {
                      setInput(starter);
                      textareaRef.current?.focus();
                    }}
                    className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm leading-snug transition-colors hover:border-primary/40 hover:bg-secondary/50"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              thinking={thinking}
              isLast={index === messages.length - 1}
              onRetry={() => send("", { regenerate: true })}
            />
          ))
        )}

        {showQuickActions ? (
          <div className="flex flex-wrap gap-2 pl-11">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => send(action.prompt)}
                disabled={usage.remaining <= 0}
                className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-border bg-background px-3 pt-3 pb-3 sm:px-5">
        {images.length ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {images.map((image) => (
              <div key={image.localId} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) antes do envio */}
                <img src={image.previewUrl} alt={image.name} className="size-16 rounded-lg border border-border object-cover" />
                {image.status === "uploading" ? (
                  <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70">
                    <LoaderCircleIcon className="size-5 animate-spin text-primary" aria-label="Enviando imagem" />
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((i) => i.localId !== image.localId))}
                  className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-foreground text-background"
                  aria-label={`Remover ${image.name}`}
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSend) void send(input);
          }}
          className={cn(
            "flex items-end gap-2 rounded-2xl border border-input bg-card p-2 shadow-card focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring/20",
            !ai.available && "opacity-60",
          )}
        >
          {ai.supportsImages ? (
            <>
              <input
                ref={imageInputRef}
                type="file"
                accept={imageAccept}
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                aria-label="Anexar imagens"
                onChange={(event) => {
                  void addImages(event.target.files);
                  event.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Anexar foto de exercício"
                onClick={() => imageInputRef.current?.click()}
                disabled={!ai.available || streaming || images.length >= 4}
              >
                <ImagePlusIcon />
              </Button>
            </>
          ) : (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Anexar documento" onClick={() => setSourcesOpen(true)} disabled={!ai.available}>
              <PaperclipIcon />
            </Button>
          )}
          <label htmlFor="mensagem-tutor" className="sr-only">
            Mensagem para o tutor
          </label>
          <textarea
            id="mensagem-tutor"
            ref={textareaRef}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              const el = event.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (canSend) void send(input);
              }
            }}
            rows={1}
            maxLength={8000}
            disabled={!ai.available}
            placeholder={ai.available ? "Mensagem para o tutor" : "Tutor indisponível"}
            className="max-h-[200px] min-h-10 flex-1 resize-none bg-transparent px-1.5 py-2 text-[0.9375rem] leading-relaxed outline-none placeholder:text-muted-foreground"
          />
          {streaming ? (
            <Button type="button" size="sm" variant="dark" onClick={stop} className="h-10">
              <SquareIcon className="size-3.5 fill-current" /> Parar
            </Button>
          ) : (
            <Button type="submit" size="icon-sm" className="size-10" disabled={!canSend} aria-label="Enviar mensagem">
              <ArrowUpIcon />
            </Button>
          )}
        </form>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
          <span>O tutor pode errar. Confira informações importantes no seu material.</span>
          {ai.available ? (
            <span className={cn(usage.remaining <= 3 && "font-semibold text-warning-text")}>
              {usage.remaining > 0
                ? `Restam ${usage.remaining} de ${usage.limit} mensagens ${usage.window === "day" ? "hoje" : "neste mês"}`
                : `Limite de mensagens ${usage.window === "day" ? "de hoje" : "do mês"} atingido`}
            </span>
          ) : null}
        </div>
      </div>

      {mobileList ? (
        <Sheet open={listOpen} onOpenChange={setListOpen}>
          <SheetContent side="left" className="gap-0 p-0">
            <SheetTitle className="sr-only">Conversas</SheetTitle>
            {/* Fecha a gaveta ao escolher uma conversa. */}
            <div
              className="h-full"
              onClickCapture={(event) => {
                if ((event.target as HTMLElement).closest("a")) setListOpen(false);
              }}
            >
              {mobileList}
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      <SourcesSheet
        open={sourcesOpen}
        onOpenChange={setSourcesOpen}
        attached={sources}
        library={library}
        maxSources={maxSources}
        maxUploadBytes={maxUploadBytes}
        onAttach={attachSources}
        onRemove={removeSource}
        onUploaded={(file) => setLibrary((prev) => [file, ...prev])}
      />
    </div>
  );
}
