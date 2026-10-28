"use client";

import { CloudUploadIcon, FileTextIcon, LoaderCircleIcon, SendIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { MarkdownView } from "@/components/ai/markdown";
import { SubjectSelect } from "@/components/learning/subject-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { uploadAndProcess, uploadStageLabels } from "@/lib/client/upload";
import { gradeOptions, materialTypeLabels, schoolStageLabels, type SchoolStage } from "@/lib/config/subjects";
import { formatBytes, studyAccept } from "@/lib/config/uploads";
import type { FileSummary } from "@/lib/documents/summary";
import { cn } from "@/lib/utils";
import {
  MIN_PUBLISH_CONTENT,
  materialStatusLabels,
  parseTags,
  publishBlockers,
  visibilityDescriptions,
  visibilityLabels,
  type MaterialInput,
} from "@/lib/validation/materials";

import { saveMaterial, submitMaterial } from "../actions";
import { submittedMessage } from "./material-row-actions";

export type EditorValues = {
  title: string;
  description: string;
  subjectId: string;
  schoolStage: string;
  gradeYear: string;
  topic: string;
  tags: string;
  materialType: string;
  content: string;
  fileId: string | null;
  visibility: "public" | "unlisted" | "private";
  copyright: boolean;
};

export type EditorEvent = { id: number; label: string; note: string | null; when: string };

type Status = keyof typeof materialStatusLabels;

const MAX_CONTENT = 100_000;

export function MaterialEditor({
  material,
  initial,
  subjects,
  files: initialFiles,
  canPublish,
  minAge,
  moderationMode,
  maxUploadBytes,
  events,
}: {
  material: { id: string; slug: string; status: Status; moderationNote: string | null } | null;
  initial: EditorValues;
  subjects: { id: string; name: string }[];
  files: FileSummary[];
  canPublish: boolean;
  minAge: number;
  moderationMode: "pre" | "post";
  maxUploadBytes: number;
  events: EditorEvent[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [files, setFiles] = useState(initialFiles);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const grades = values.schoolStage ? (gradeOptions[values.schoolStage as SchoolStage] ?? []) : [];
  const attached = files.find((f) => f.id === values.fileId) ?? null;
  const blockers = publishBlockers({ visibility: values.visibility, copyright: values.copyright, content: values.content, fileId: values.fileId });
  const tagsPreview = useMemo(() => parseTags(values.tags), [values.tags]);
  const status = material?.status ?? "draft";
  const editingPublished = status === "published";

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function set<K extends keyof EditorValues>(key: K, value: EditorValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function toInput(v: EditorValues): MaterialInput {
    return {
      title: v.title,
      description: v.description,
      subjectId: v.subjectId,
      schoolStage: v.schoolStage,
      gradeYear: v.gradeYear,
      topic: v.topic,
      tags: v.tags,
      materialType: v.materialType as MaterialInput["materialType"],
      content: v.content,
      fileId: v.fileId,
      visibility: v.visibility,
      copyright: v.copyright,
    };
  }

  function save(thenSubmit: boolean) {
    setFormError(null);
    startTransition(async () => {
      const result = await saveMaterial(material?.id ?? null, toInput(values));
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        return;
      }
      setSaved(values);
      if (!thenSubmit) {
        toast.success(
          result.status === "pending_review" && editingPublished
            ? "Alterações salvas. O material voltou para revisão."
            : material
              ? "Alterações salvas."
              : "Rascunho criado.",
        );
        if (!material) router.replace(`/app/materiais/${result.id}/editar`);
        return;
      }
      const submitted = await submitMaterial(result.id);
      if (!submitted.ok) {
        setFormError(submitted.error);
        if (!material) router.replace(`/app/materiais/${result.id}/editar`);
        return;
      }
      toast.success(submittedMessage(submitted.status));
      for (const title of submitted.achievements) toast.success(`Conquista desbloqueada: ${title}`);
      router.push("/app/materiais");
    });
  }

  async function upload(file: File) {
    if (file.size > maxUploadBytes) {
      toast.error(`O arquivo passa do limite de ${formatBytes(maxUploadBytes)} do seu plano.`);
      return;
    }
    setUploading(uploadStageLabels.preparing);
    try {
      const summary = await uploadAndProcess(file, { purpose: "study", onStage: (stage) => setUploading(uploadStageLabels[stage]) });
      setFiles((prev) => [summary, ...prev.filter((f) => f.id !== summary.id)]);
      set("fileId", summary.id);
      toast.success(`${summary.name} anexado.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o arquivo.");
    } finally {
      setUploading(null);
    }
  }

  const readyFiles = files.filter((f) => f.status === "ready");

  return (
    <form
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
      onSubmit={(event) => {
        event.preventDefault();
        save(false);
      }}
    >
      <div className="flex min-w-0 flex-col gap-5">
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mat-titulo">Título</Label>
          <Input
            id="mat-titulo"
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={140}
            placeholder="Ex.: Resumo de Função Afim com exercícios resolvidos"
            aria-invalid={Boolean(errors.title) || undefined}
            aria-describedby={errors.title ? "mat-titulo-erro" : undefined}
            required
          />
          {errors.title ? (
            <p id="mat-titulo-erro" role="alert" className="text-sm font-medium text-destructive-text">
              {errors.title}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mat-descricao">
            Descrição <span className="font-normal text-muted-foreground">(aparece na busca)</span>
          </Label>
          <Textarea
            id="mat-descricao"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Em uma ou duas frases: o que este material cobre e para quem serve."
          />
        </div>

        <Tabs defaultValue="escrever">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="escrever">Escrever</TabsTrigger>
              <TabsTrigger value="ver">Pré-visualizar</TabsTrigger>
            </TabsList>
            <span className={cn("text-xs tabular-nums", values.content.length > MAX_CONTENT ? "text-destructive-text" : "text-muted-foreground")}>
              {values.content.length.toLocaleString("pt-BR")} / {MAX_CONTENT.toLocaleString("pt-BR")} caracteres
            </span>
          </div>
          <TabsContent value="escrever" className="flex flex-col gap-1.5">
            <Label htmlFor="mat-conteudo" className="sr-only">
              Conteúdo
            </Label>
            <Textarea
              id="mat-conteudo"
              value={values.content}
              onChange={(e) => set("content", e.target.value)}
              rows={20}
              className="min-h-[24rem] font-mono text-[0.9rem] leading-relaxed"
              placeholder={"# Função afim\n\nUma função afim tem a forma **f(x) = ax + b**...\n\n## Exemplos\n\n- Se a > 0, a função é crescente."}
              aria-describedby="mat-conteudo-ajuda"
            />
            <p id="mat-conteudo-ajuda" className="text-xs leading-relaxed text-muted-foreground">
              Use Markdown: <code># Título</code>, <code>**negrito**</code>, listas com <code>-</code>, tabelas e fórmulas entre <code>$</code> (ex.:{" "}
              <code>$x^2$</code>). Para publicar: pelo menos {MIN_PUBLISH_CONTENT} caracteres ou um arquivo anexado.
            </p>
          </TabsContent>
          <TabsContent value="ver">
            <div className="min-h-[24rem] rounded-2xl border border-border bg-card p-5 sm:p-8">
              {values.content.trim() ? (
                <MarkdownView content={values.content} />
              ) : (
                <p className="text-sm text-muted-foreground">Nada para mostrar ainda. Escreva na aba “Escrever”.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="text-base">Arquivo anexado</CardTitle>
            <CardDescription>PDF, Word, PowerPoint, imagem ou texto. Fotos são publicadas sem os metadados (como localização).</CardDescription>
          </CardHeader>
          {attached ? (
            <div className="flex items-center gap-3 rounded-xl border border-border p-3">
              <FileTextIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{attached.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(attached.sizeBytes)}</p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover anexo" onClick={() => set("fileId", null)}>
                <XIcon className="size-4" />
              </Button>
            </div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            {readyFiles.length ? (
              <>
                <Label htmlFor="mat-arquivo" className="sr-only">
                  Escolher um arquivo já enviado
                </Label>
                <NativeSelect
                  id="mat-arquivo"
                  value={values.fileId ?? ""}
                  onChange={(e) => set("fileId", e.target.value || null)}
                  className="sm:flex-1"
                >
                  <option value="">{attached ? "Trocar por outro arquivo…" : "Escolher dos meus arquivos…"}</option>
                  {readyFiles.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </NativeSelect>
              </>
            ) : null}
            <input
              ref={fileInput}
              type="file"
              accept={studyAccept}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              aria-label="Enviar arquivo"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void upload(file);
              }}
            />
            <Button type="button" variant="outline" disabled={Boolean(uploading)} onClick={() => fileInput.current?.click()}>
              {uploading ? <LoaderCircleIcon className="size-4 animate-spin" /> : <CloudUploadIcon className="size-4" />}
              {uploading ?? "Enviar arquivo"}
            </Button>
          </div>
          {errors.fileId ? <p className="text-sm font-medium text-destructive-text">{errors.fileId}</p> : null}
        </Card>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="gap-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Situação</CardTitle>
            <Badge variant={status === "published" ? "success" : status === "removed" ? "danger" : status === "draft" ? "neutral" : "warning"}>
              {materialStatusLabels[status]}
            </Badge>
          </div>
          {material?.moderationNote && (status === "rejected" || status === "pending_review") ? (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-text">{material.moderationNote}</p>
          ) : null}
          {editingPublished && moderationMode === "pre" ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Mudar título, descrição, texto, anexo, tema ou etiquetas faz o material voltar para revisão antes de reaparecer.
            </p>
          ) : null}
          {events.length ? (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold">Histórico</summary>
              <ol className="mt-2 flex flex-col gap-2 border-l border-border pl-3">
                {events.map((e) => (
                  <li key={e.id}>
                    <p className="font-medium">{e.label}</p>
                    <p className="text-xs text-muted-foreground">{e.when}</p>
                    {e.note ? <p className="text-xs text-ink-2">{e.note}</p> : null}
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </Card>

        <Card className="gap-4">
          <CardTitle className="text-base">Detalhes</CardTitle>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mat-materia">Matéria</Label>
            <SubjectSelect
              id="mat-materia"
              subjects={subjects}
              emptyLabel="Escolha a matéria"
              value={values.subjectId}
              onChange={(e) => set("subjectId", e.target.value)}
              aria-invalid={Boolean(errors.subjectId) || undefined}
              required
            />
            {errors.subjectId ? <p className="text-sm font-medium text-destructive-text">{errors.subjectId}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mat-tipo">Tipo</Label>
            <NativeSelect id="mat-tipo" value={values.materialType} onChange={(e) => set("materialType", e.target.value)}>
              {Object.entries(materialTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mat-etapa">Etapa</Label>
              <NativeSelect
                id="mat-etapa"
                value={values.schoolStage}
                onChange={(e) => setValues((prev) => ({ ...prev, schoolStage: e.target.value, gradeYear: "" }))}
              >
                <option value="">Qualquer</option>
                {Object.entries(schoolStageLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mat-serie">Ano/série</Label>
              <NativeSelect id="mat-serie" value={values.gradeYear} onChange={(e) => set("gradeYear", e.target.value)} disabled={!grades.length}>
                <option value="">Qualquer</option>
                {grades.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mat-tema">
              Tema <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input id="mat-tema" value={values.topic} onChange={(e) => set("topic", e.target.value)} maxLength={120} placeholder="Ex.: Funções" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mat-tags">
              Etiquetas <span className="font-normal text-muted-foreground">(separe por vírgula)</span>
            </Label>
            <Input id="mat-tags" value={values.tags} onChange={(e) => set("tags", e.target.value)} maxLength={500} placeholder="enem, gráficos, 1º ano" />
            {tagsPreview.length ? (
              <p className="flex flex-wrap gap-1" aria-label="Etiquetas que serão salvas">
                {tagsPreview.map((t) => (
                  <span key={t} className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-ink-2">
                    #{t}
                  </span>
                ))}
              </p>
            ) : null}
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">Visibilidade</legend>
            {(Object.keys(visibilityLabels) as (keyof typeof visibilityLabels)[]).map((key) => (
              <label
                key={key}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
                  values.visibility === key ? "border-primary bg-secondary/60" : "border-border hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  name="visibilidade"
                  value={key}
                  checked={values.visibility === key}
                  onChange={() => set("visibility", key)}
                  className="mt-1 accent-[var(--primary)]"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{visibilityLabels[key]}</span>
                  <span className="text-xs text-muted-foreground">{visibilityDescriptions[key]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
            <Checkbox checked={values.copyright} onCheckedChange={(checked) => set("copyright", checked === true)} className="mt-0.5" />
            <span>
              Declaro que o material é meu (ou tenho autorização para publicá-lo), que não copia livros, apostilas ou provas protegidas e que não expõe
              dados pessoais de outras pessoas.
            </span>
          </label>
        </Card>

        <div className="flex flex-col gap-2">
          {!canPublish ? (
            <Alert tone="info">
              Publicar exige {minAge} anos ou o consentimento de um responsável. Você pode salvar como rascunho.
            </Alert>
          ) : blockers.length && status !== "published" && status !== "pending_review" ? (
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground" aria-label="Pendências para publicar">
              {blockers.map((b) => (
                <li key={b}>• {b}</li>
              ))}
            </ul>
          ) : null}
          <Button type="submit" variant="outline" disabled={pending || Boolean(uploading)}>
            {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
            {material ? "Salvar alterações" : "Salvar rascunho"}
          </Button>
          {status === "draft" || status === "rejected" ? (
            <Button
              type="button"
              disabled={pending || Boolean(uploading) || !canPublish || blockers.length > 0}
              onClick={() => save(true)}
            >
              <SendIcon className="size-4" /> {moderationMode === "pre" ? "Enviar para revisão" : "Publicar"}
            </Button>
          ) : null}
          {dirty ? <p className="text-center text-xs text-muted-foreground">Há alterações não salvas.</p> : null}
        </div>
      </aside>
    </form>
  );
}
