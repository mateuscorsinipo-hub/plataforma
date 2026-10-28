import { FlagIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { listMyReports } from "@/lib/data/library";
import { formatDateBR } from "@/lib/domain/dates";
import { reportReasonLabels } from "@/lib/validation/materials";

import { MaterialsTabs } from "../_components/materials-tabs";

export const metadata: Metadata = { title: "Minhas denúncias" };

const statusInfo = {
  open: { label: "Em análise", variant: "warning" },
  resolved_removed: { label: "Material removido", variant: "success" },
  resolved_kept: { label: "Analisada: material mantido", variant: "neutral" },
  dismissed: { label: "Arquivada", variant: "neutral" },
} as const;

export default function MyReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Comunidade" title="Meus materiais" description="Acompanhe as denúncias que você fez. Quem publicou não sabe quem denunciou." />
      <MaterialsTabs active="denuncias" />
      <Suspense
        fallback={
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando denúncias">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        }
      >
        <Reports />
      </Suspense>
    </div>
  );
}

async function Reports() {
  const { user } = await requireStudent("/app/materiais/denuncias");
  const reports = await listMyReports(user.id);
  if (!reports.length) {
    return (
      <EmptyState
        icon={FlagIcon}
        title="Nenhuma denúncia feita"
        description="Se encontrar um material com erro, cópia sem autorização ou conteúdo impróprio, use “Denunciar” na página dele."
      />
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
      {reports.map((r) => {
        const info = statusInfo[r.status];
        return (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
            <div className="min-w-0">
              {r.material ? (
                <Link href={`/app/biblioteca/${r.material.slug}`} className="block truncate text-sm font-semibold hover:underline">
                  {r.material.title}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">Material fora do ar</p>
              )}
              <p className="text-xs text-muted-foreground">
                {reportReasonLabels[r.reason]} · {formatDateBR(r.createdAt.slice(0, 10), { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>
            <Badge variant={info.variant}>{info.label}</Badge>
          </li>
        );
      })}
    </ul>
  );
}
