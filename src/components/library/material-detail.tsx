import {
  BookmarkIcon,
  ChevronRightIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileImageIcon,
  FileTextIcon,
  PresentationIcon,
  StarIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarkdownView } from "@/components/ai/markdown";
import { SubjectChip } from "@/components/brand/subject-chip";
import { MaterialActions, RatingInput } from "@/components/library/material-actions";
import { formatCount, formatRating, MaterialCard, MaterialGrid } from "@/components/library/material-card";
import { StudyWithAIButton } from "@/components/library/study-with-ai-button";
import { ViewTracker } from "@/components/library/view-tracker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives";
import { getCurrentProfile, getSessionUser, getStaffRoles } from "@/lib/auth/session";
import { initialsOf, safeAvatarUrl } from "@/lib/avatar";
import { gradeLabel, materialTypeLabels } from "@/lib/config/subjects";
import { formatBytes, type UploadKind } from "@/lib/config/uploads";
import { getMaterialBySlug, getViewerState, type MaterialAttachment } from "@/lib/data/library";
import { getSubjectMap } from "@/lib/data/subjects";
import { publicEnv } from "@/lib/env/public";
import { materialStatusLabels } from "@/lib/validation/materials";

const attachmentIcons: Record<UploadKind, LucideIcon> = {
  pdf: FileTextIcon,
  docx: FileTextIcon,
  pptx: PresentationIcon,
  image: FileImageIcon,
  text: FileTextIcon,
};

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });

function AttachmentCard({ attachment, fileHref }: { attachment: MaterialAttachment; fileHref: string }) {
  const Icon = attachmentIcons[attachment.kind];
  const details = [
    formatBytes(attachment.sizeBytes),
    attachment.pageCount && attachment.kind === "pdf" ? `${attachment.pageCount} ${attachment.pageCount === 1 ? "página" : "páginas"}` : null,
    attachment.pageCount && attachment.kind === "pptx" ? `${attachment.pageCount} slides` : null,
  ].filter(Boolean);
  const canPreview = attachment.kind === "pdf" || attachment.kind === "image" || attachment.kind === "text";
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{attachment.name}</p>
          <p className="text-xs text-muted-foreground">{details.join(" · ")}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {canPreview ? (
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <a href={`${fileHref}?modo=ver`} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon className="size-4" /> Abrir
              </a>
            </Button>
          ) : null}
          <Button asChild size="sm">
            <a href={fileHref} rel="nofollow">
              <DownloadIcon className="size-4" /> Baixar
            </a>
          </Button>
        </div>
      </div>
      {attachment.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem servida por URL temporária do Storage privado
        <img src={`${fileHref}?modo=ver`} alt={`Imagem anexada: ${attachment.name}`} loading="lazy" className="max-h-[70vh] w-full rounded-xl border border-border object-contain" />
      ) : null}
    </div>
  );
}

function StatusNotice({
  status,
  visibility,
  note,
  isAuthor,
  isStaff,
  editHref,
}: {
  status: keyof typeof materialStatusLabels;
  visibility: string;
  note: string | null;
  isAuthor: boolean;
  isStaff: boolean;
  editHref: string | null;
}) {
  const edit = editHref ? (
    <Button asChild size="sm" variant="outline">
      <Link href={editHref}>Editar</Link>
    </Button>
  ) : undefined;
  if (status === "published") {
    if (visibility === "unlisted") return <Alert tone="info">Este material não aparece na busca: só abre para quem tem o link.</Alert>;
    if (visibility === "private") return <Alert tone="info" title="Privado" action={edit}>Só você vê este material. Mude a visibilidade para compartilhar.</Alert>;
    return null;
  }
  const viewerNote = isAuthor ? "Só você vê esta página." : isStaff ? "Você está vendo como moderação." : "";
  switch (status) {
    case "draft":
      return (
        <Alert tone="info" title="Rascunho" action={edit}>
          {viewerNote} Envie para publicação quando estiver pronto.
        </Alert>
      );
    case "pending_review":
      return (
        <Alert tone="warning" title="Em revisão">
          {note ?? "A moderação está analisando este material."} {viewerNote}
        </Alert>
      );
    case "rejected":
      return (
        <Alert tone="warning" title="Precisa de ajustes" action={edit}>
          {note ?? "A moderação pediu mudanças antes de publicar."} {viewerNote}
        </Alert>
      );
    default:
      return (
        <Alert tone="danger" title="Removido pela moderação">
          {note ?? "Este material violou as regras da comunidade."} {viewerNote}
        </Alert>
      );
  }
}

/** Página completa de um material, usada no site público e dentro do app. */
export async function MaterialDetail({ slug, context }: { slug: string; context: "public" | "app" }) {
  const data = await getMaterialBySlug(slug);
  if (!data) notFound();
  const { material, author, attachment, related } = data;
  const user = await getSessionUser();
  const [subjects, viewer, roles, profile] = await Promise.all([
    getSubjectMap(),
    user ? getViewerState(material.id, user.id) : Promise.resolve(null),
    user ? getStaffRoles() : Promise.resolve([]),
    user ? getCurrentProfile() : Promise.resolve(null),
  ]);
  const isAuthor = user?.id === material.author_id;
  const isStaff = roles.length > 0;
  const published = material.status === "published" && material.visibility !== "private";
  const subject = subjects.get(material.subject_id);
  const root = context === "app" ? "/app/biblioteca" : "/biblioteca";
  const publicPath = `/biblioteca/${material.slug}`;
  const editHref = isAuthor && material.status !== "removed" ? `/app/materiais/${material.id}/editar` : null;
  const level = gradeLabel(material.school_stage, material.grade_year);
  const rating = material.rating_count ? material.rating_sum / material.rating_count : null;
  const canInteract = Boolean(user && profile?.account_status === "active");
  const authorName = author?.displayName || (author ? `@${author.username}` : "Autor indisponível");

  return (
    <article className="flex flex-col gap-8">
      {published ? <ViewTracker materialId={material.id} /> : null}
      <nav aria-label="Trilha" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href={root} className="hover:text-foreground hover:underline">
          Biblioteca
        </Link>
        {subject ? (
          <>
            <ChevronRightIcon className="size-4" aria-hidden="true" />
            <Link href={`${root}?materia=${subject.slug}`} className="hover:text-foreground hover:underline">
              {subject.name}
            </Link>
          </>
        ) : null}
      </nav>

      <StatusNotice
        status={material.status}
        visibility={material.visibility}
        note={material.moderation_note}
        isAuthor={isAuthor}
        isStaff={isStaff}
        editHref={editHref}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {subject ? <SubjectChip subject={subject} withIcon /> : null}
              <Badge variant="neutral">{materialTypeLabels[material.material_type]}</Badge>
              {level ? <Badge variant="outline">{level}</Badge> : null}
              {material.status !== "published" ? <Badge variant="warning">{materialStatusLabels[material.status]}</Badge> : null}
            </div>
            <h1 className="font-display text-[1.75rem] leading-tight font-extrabold text-balance sm:text-[2.25rem]">{material.title}</h1>
            {material.topic ? <p className="text-sm font-semibold text-ink-2">Tema: {material.topic}</p> : null}
            {material.description ? <p className="max-w-3xl text-[1.0625rem] leading-relaxed text-ink-2">{material.description}</p> : null}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Avatar className="size-7">
                  {safeAvatarUrl(author?.avatarUrl) ? <AvatarImage src={safeAvatarUrl(author?.avatarUrl)!} alt="" /> : null}
                  <AvatarFallback className="text-[0.65rem]">{initialsOf(author?.displayName || author?.username || "?")}</AvatarFallback>
                </Avatar>
                {author ? (
                  <Link href={`/u/${author.username}`} className="font-semibold text-foreground hover:underline">
                    {authorName}
                  </Link>
                ) : (
                  <span>{authorName}</span>
                )}
              </span>
              {material.published_at ? <span>Publicado em {dateFormat.format(new Date(material.published_at))}</span> : null}
              {published ? (
                <span className="flex items-center gap-3 tabular-nums">
                  <span className="flex items-center gap-1">
                    <EyeIcon className="size-4" aria-hidden="true" />
                    {formatCount(material.views_count)} {material.views_count === 1 ? "visualização" : "visualizações"}
                  </span>
                  <span className="flex items-center gap-1">
                    <BookmarkIcon className="size-4" aria-hidden="true" />
                    {formatCount(material.saves_count + material.favorites_count)} {material.saves_count + material.favorites_count === 1 ? "salvamento" : "salvamentos"}
                  </span>
                </span>
              ) : null}
            </div>
          </header>

          <MaterialActions
            materialId={material.id}
            title={material.title}
            shareUrl={`${publicEnv.siteUrl}${publicPath}`}
            loginHref={`/entrar?next=${encodeURIComponent(publicPath)}`}
            editHref={editHref}
            viewer={canInteract && viewer ? viewer : null}
            isAuthor={isAuthor}
            published={published}
            leading={
              (published || isAuthor) && material.status !== "removed" ? (
                <StudyWithAIButton slug={material.slug} loginHref={user ? null : `/entrar?next=${encodeURIComponent(publicPath)}`} />
              ) : null
            }
          />

          {attachment ? <AttachmentCard attachment={attachment} fileHref={`${publicPath}/arquivo`} /> : null}

          {material.content.trim() ? (
            <Card className="p-5 sm:p-8">
              <MarkdownView content={material.content} className="max-w-none" />
            </Card>
          ) : !attachment ? (
            <p className="rounded-xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">Este material ainda não tem conteúdo.</p>
          ) : null}

          {material.tags.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="Etiquetas">
              {material.tags.map((tag) => (
                <li key={tag}>
                  <Link
                    href={`${root}?q=${encodeURIComponent(tag)}`}
                    className="inline-flex rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-ink-2 hover:bg-secondary hover:text-secondary-foreground"
                  >
                    #{tag}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          {published ? (
            <Card className="gap-3 p-5">
              <div className="flex items-baseline gap-2">
                <StarIcon className="size-5 self-center fill-[#f5b301] text-[#b7791f]" aria-hidden="true" />
                <span className="font-display text-2xl font-extrabold tabular-nums">{rating !== null ? formatRating(rating) : "—"}</span>
                <span className="text-sm text-muted-foreground">
                  {material.rating_count
                    ? `${material.rating_count} ${material.rating_count === 1 ? "avaliação" : "avaliações"}`
                    : "Sem avaliações ainda"}
                </span>
              </div>
              <RatingInput
                materialId={material.id}
                initial={viewer?.rating ?? null}
                loginHref={user ? null : `/entrar?next=${encodeURIComponent(publicPath)}`}
                canRate={canInteract && !isAuthor}
                reason={isAuthor ? "Você não pode avaliar o próprio material." : "Sua conta não pode avaliar materiais agora."}
              />
            </Card>
          ) : null}
          {!user ? (
            <Card className="gap-3 bg-secondary/60 p-5">
              <p className="font-display text-lg font-bold">Estude este conteúdo do seu jeito</p>
              <p className="text-sm leading-relaxed text-ink-2">
                Com uma conta grátis você salva materiais, revisa com flashcards e tira dúvidas com o tutor de IA.
              </p>
              <Button asChild>
                <Link href="/cadastro">Criar conta grátis</Link>
              </Button>
            </Card>
          ) : null}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Conteúdo publicado por estudantes, de responsabilidade de quem publicou. Encontrou um erro ou uma cópia sem autorização? Use
            “Denunciar” ou a{" "}
            <Link href={`/contato?assunto=copyright&url=${encodeURIComponent(`${publicEnv.siteUrl}${publicPath}`)}`} className="underline">
              notificação de direitos autorais
            </Link>
            .
          </p>
        </aside>
      </div>

      {related.length ? (
        <section aria-labelledby="relacionados" className="flex flex-col gap-4">
          <h2 id="relacionados" className="font-display text-xl font-bold">
            Materiais relacionados
          </h2>
          <MaterialGrid>
            {related.map((m) => (
              <MaterialCard key={m.id} material={m} subject={subjects.get(m.subjectId)} href={`${root}/${m.slug}`} />
            ))}
          </MaterialGrid>
        </section>
      ) : null}
    </article>
  );
}
