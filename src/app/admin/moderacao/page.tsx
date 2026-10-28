import { CheckIcon, ExternalLinkIcon, FlagIcon, PaperclipIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { MarkdownView } from "@/components/ai/markdown";
import { SubjectChip } from "@/components/brand/subject-chip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireStaff } from "@/lib/auth/session";
import { materialTypeLabels } from "@/lib/config/subjects";
import { listPendingMaterials } from "@/lib/data/admin";
import { getSubjectMap } from "@/lib/data/subjects";
import { visibilityLabels } from "@/lib/validation/materials";

import { moderateMaterial } from "../actions";
import { ConfirmAction } from "../_components/confirm-action";
import { AdminSkeleton } from "../_components/admin-skeleton";

export const metadata: Metadata = { title: "Moderação" };

const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default function ModerationPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <ModerationPageContent />
    </Suspense>
  );
}

async function ModerationPageContent() {
  await requireStaff();
  const [items, subjects] = await Promise.all([listPendingMaterials(), getSubjectMap()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Moderação"
        description="Materiais enviados para publicação, do mais antigo para o mais novo. Aprovar publica e avisa o autor; pedir ajustes e remover exigem um motivo, que o autor recebe."
      />
      {items.length ? (
        <ul className="flex flex-col gap-4">
          {items.map((m) => {
            const subject = subjects.get(m.subject_id);
            return (
              <li key={m.id}>
                <Card className="gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {subject ? <SubjectChip subject={subject} size="sm" /> : null}
                        <Badge variant="neutral">{materialTypeLabels[m.material_type]}</Badge>
                        <Badge variant="outline">{visibilityLabels[m.visibility]}</Badge>
                        {m.file_id ? (
                          <Badge variant="outline">
                            <PaperclipIcon /> anexo
                          </Badge>
                        ) : null}
                        {m.openReports ? (
                          <Badge variant="danger">
                            <FlagIcon /> {m.openReports} {m.openReports === 1 ? "denúncia" : "denúncias"}
                          </Badge>
                        ) : null}
                      </div>
                      <h2 className="font-display text-lg leading-snug font-bold">{m.title}</h2>
                      <p className="text-xs text-muted-foreground">
                        {m.author ? `@${m.author}` : "autor indisponível"} · enviado em {when.format(new Date(m.updated_at))}
                        {m.moderation_note ? ` · ${m.moderation_note}` : ""}
                      </p>
                    </div>
                    <Link
                      href={`/biblioteca/${m.slug}`}
                      target="_blank"
                      className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                      Abrir página <ExternalLinkIcon className="size-4" aria-hidden="true" />
                    </Link>
                  </div>
                  {m.description ? <p className="text-sm text-ink-2">{m.description}</p> : null}
                  <details className="rounded-xl border border-border bg-muted/30 p-4">
                    <summary className="cursor-pointer text-sm font-semibold">
                      Ver o conteúdo ({m.content.length.toLocaleString("pt-BR")} caracteres)
                    </summary>
                    <div className="mt-3 max-h-[28rem] overflow-y-auto">
                      {m.content.trim() ? (
                        <MarkdownView content={m.content} />
                      ) : (
                        <p className="text-sm text-muted-foreground">Sem texto; confira o anexo.</p>
                      )}
                    </div>
                  </details>
                  <div className="flex flex-wrap gap-2">
                    <ConfirmAction
                      label={
                        <>
                          <CheckIcon className="size-4" /> Aprovar
                        </>
                      }
                      variant="default"
                      title="Publicar este material?"
                      description="Ele passa a aparecer na biblioteca e o autor recebe um aviso e o XP de publicação."
                      confirmLabel="Publicar"
                      action={moderateMaterial.bind(null, m.id, "approve")}
                    />
                    <ConfirmAction
                      label="Pedir ajustes"
                      title="Pedir ajustes ao autor"
                      description="O material volta para o autor, que pode corrigir e reenviar."
                      confirmLabel="Enviar pedido"
                      noteLabel="O que precisa mudar"
                      notePlaceholder="Ex.: o exemplo 2 tem um erro de sinal; corrija antes de publicar."
                      action={moderateMaterial.bind(null, m.id, "changes")}
                    />
                    <ConfirmAction
                      label="Remover"
                      variant="destructive"
                      title="Remover este material"
                      description="Use para violação de direitos autorais, conteúdo impróprio, spam ou dados pessoais. O autor não poderá reenviá-lo."
                      confirmLabel="Remover"
                      noteLabel="Motivo da remoção"
                      notePlaceholder="Ex.: cópia integral de apostila comercial."
                      action={moderateMaterial.bind(null, m.id, "remove")}
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={ShieldCheckIcon} title="Fila vazia" description="Nenhum material aguardando revisão." />
      )}
    </div>
  );
}
