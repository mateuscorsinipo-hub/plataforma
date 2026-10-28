import { ExternalLinkIcon, FlagIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireStaff } from "@/lib/auth/session";
import { listOpenReports } from "@/lib/data/admin";
import { materialStatusLabels, reportReasonLabels } from "@/lib/validation/materials";

import { resolveMaterialReports } from "../actions";
import { ConfirmAction } from "../_components/confirm-action";
import { AdminSkeleton } from "../_components/admin-skeleton";

export const metadata: Metadata = { title: "Denúncias" };

const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default function ReportsPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <ReportsPageContent />
    </Suspense>
  );
}

async function ReportsPageContent() {
  await requireStaff();
  const groups = await listOpenReports();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Denúncias"
        description="Agrupadas por material, com mais denúncias primeiro. Ao atingir o limite configurado de denúncias de pessoas diferentes, o material sai do ar até a decisão. Quem denunciou não é identificado para o autor."
      />
      {groups.length ? (
        <ul className="flex flex-col gap-4">
          {groups.map((g) => (
            <li key={g.materialId}>
              <Card className="gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="danger">
                        <FlagIcon /> {g.reports.length} {g.reports.length === 1 ? "denúncia" : "denúncias"}
                      </Badge>
                      {g.material ? (
                        <Badge variant="outline">
                          {materialStatusLabels[g.material.status as keyof typeof materialStatusLabels] ?? g.material.status}
                        </Badge>
                      ) : null}
                    </div>
                    <h2 className="font-display text-lg leading-snug font-bold">{g.material?.title ?? "Material excluído"}</h2>
                    <p className="text-xs text-muted-foreground">{g.author ? `@${g.author}` : "autor indisponível"}</p>
                  </div>
                  {g.material ? (
                    <Link
                      href={`/biblioteca/${g.material.slug}`}
                      target="_blank"
                      className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                      Abrir página <ExternalLinkIcon className="size-4" aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
                <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                  {g.reports.map((r) => (
                    <li key={r.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                      <p className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{reportReasonLabels[r.reason as keyof typeof reportReasonLabels] ?? r.reason}</span>
                        <span className="text-xs text-muted-foreground">{when.format(new Date(r.createdAt))}</span>
                      </p>
                      {r.details ? <p className="text-ink-2">{r.details}</p> : null}
                    </li>
                  ))}
                </ul>
                {g.material ? (
                  <div className="flex flex-wrap gap-2">
                    <ConfirmAction
                      label="Manter material"
                      title="Manter o material no ar"
                      description="As denúncias são marcadas como analisadas. Se ele saiu do ar por causa delas, volta a aparecer."
                      confirmLabel="Manter"
                      action={resolveMaterialReports.bind(null, g.materialId, "keep")}
                    />
                    <ConfirmAction
                      label="Arquivar denúncias"
                      variant="ghost"
                      title="Arquivar as denúncias"
                      description="Para denúncias sem fundamento ou repetidas. O material não muda."
                      confirmLabel="Arquivar"
                      action={resolveMaterialReports.bind(null, g.materialId, "dismiss")}
                    />
                    <ConfirmAction
                      label="Remover material"
                      variant="destructive"
                      title="Remover o material"
                      description="O material sai da biblioteca e o autor recebe o motivo."
                      confirmLabel="Remover"
                      noteLabel="Motivo da remoção"
                      action={resolveMaterialReports.bind(null, g.materialId, "remove")}
                    />
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={FlagIcon} title="Nenhuma denúncia aberta" description="Quando alguém denunciar um material, ele aparece aqui." />
      )}
    </div>
  );
}
