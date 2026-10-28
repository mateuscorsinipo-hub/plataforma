import { InboxIcon, MailIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireStaff } from "@/lib/auth/session";
import { listContactMessages } from "@/lib/data/admin";
import { cn } from "@/lib/utils";

import { setContactStatus } from "../actions";
import { ConfirmAction } from "../_components/confirm-action";
import { AdminSkeleton } from "../_components/admin-skeleton";

export const metadata: Metadata = { title: "Contato" };

const topics: Record<string, string> = {
  support: "Suporte",
  privacy: "Dados pessoais (LGPD)",
  copyright: "Direitos autorais",
  report: "Denúncia",
  partnership: "Parceria",
  other: "Outro",
};
const filters = [
  { key: "open", label: "Abertas" },
  { key: "in_progress", label: "Em andamento" },
  { key: "closed", label: "Encerradas" },
  { key: "all", label: "Todas" },
] as const;
const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default function ContactAdminPage({ searchParams }: PageProps<"/admin/contato">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <ContactAdminPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ContactAdminPageContent({ searchParams }: { searchParams: PageProps<"/admin/contato">["searchParams"] }) {
  await requireStaff();
  const params = await searchParams;
  const requested = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = filters.find((f) => f.key === requested)?.key ?? "open";
  const messages = await listContactMessages(status);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Contato"
        description="Mensagens do formulário público. Pedidos sobre dados pessoais (LGPD) e direitos autorais têm prazo: responda pelo e-mail informado."
      />
      <nav aria-label="Filtrar" className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={`/admin/contato?status=${f.key}`}
            aria-current={f.key === status ? "page" : undefined}
            className={cn(
              "rounded-xl border px-3.5 py-1.5 text-sm font-semibold",
              f.key === status ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-card hover:bg-muted",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {messages.length ? (
        <ul className="flex flex-col gap-3">
          {messages.map((m) => (
            <li key={m.id}>
              <Card className="gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={m.topic === "privacy" || m.topic === "copyright" ? "warning" : "neutral"}>{topics[m.topic] ?? m.topic}</Badge>
                      <Badge variant="outline">{m.status === "open" ? "aberta" : m.status === "in_progress" ? "em andamento" : "encerrada"}</Badge>
                    </div>
                    <p className="text-sm font-semibold">
                      {m.name} · <span className="font-normal text-ink-2">{m.email}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {when.format(new Date(m.created_at))}
                      {m.user_id ? " · enviada com a conta logada" : ""}
                    </p>
                  </div>
                  <a href={`mailto:${m.email}`} className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                    <MailIcon className="size-4" aria-hidden="true" /> Responder
                  </a>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.message}</p>
                {m.reference_url ? (
                  <p className="text-sm break-all">
                    Link informado: <span className="text-ink-2">{m.reference_url}</span>
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {m.status !== "in_progress" ? (
                    <ConfirmAction
                      label="Marcar em andamento"
                      title="Marcar como em andamento"
                      description="Indica para a equipe que alguém já está cuidando desta mensagem."
                      confirmLabel="Confirmar"
                      action={setContactStatus.bind(null, m.id, "in_progress")}
                    />
                  ) : null}
                  {m.status !== "closed" ? (
                    <ConfirmAction
                      label="Encerrar"
                      variant="ghost"
                      title="Encerrar a mensagem"
                      description="Use depois de responder ou resolver."
                      confirmLabel="Encerrar"
                      action={setContactStatus.bind(null, m.id, "closed")}
                    />
                  ) : (
                    <ConfirmAction
                      label="Reabrir"
                      variant="ghost"
                      title="Reabrir a mensagem"
                      description="Volta para a fila de abertas."
                      confirmLabel="Reabrir"
                      action={setContactStatus.bind(null, m.id, "open")}
                    />
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={InboxIcon} title="Nenhuma mensagem" description="Não há mensagens neste filtro." />
      )}
    </div>
  );
}
