import { BookCheckIcon, FlagIcon, InboxIcon, SparklesIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { requireStaff } from "@/lib/auth/session";
import { featureLabels, type UsageFeature } from "@/lib/config/plans";
import { adminOverview } from "@/lib/data/admin";
import { isAIConfigured, isBillingConfigured, isEmailConfigured, serverEnv } from "@/lib/env/server";

import { AdminSkeleton } from "./_components/admin-skeleton";

export const metadata: Metadata = { title: "Visão geral" };

function Tile({ label, value, hint, href, icon: Icon }: { label: string; value: number; hint?: string; href?: string; icon: typeof UsersIcon }) {
  const body = (
    <Card className="h-full gap-2 p-5 transition-colors hover:bg-muted/40">
      <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Icon className="size-4 text-primary" aria-hidden="true" /> {label}
      </p>
      <p className="font-display text-3xl font-extrabold tabular-nums">{value.toLocaleString("pt-BR")}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
  return href ? (
    <Link href={href} className="rounded-2xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function AdminHome() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminHomeContent />
    </Suspense>
  );
}

async function AdminHomeContent() {
  await requireStaff();
  const data = await adminOverview();
  const integrations = [
    { label: "IA", ok: isAIConfigured(), detail: isAIConfigured() ? serverEnv.ai.model : "sem chave de provedor" },
    { label: "Pagamentos (Stripe)", ok: isBillingConfigured(), detail: isBillingConfigured() ? "ativo" : "não configurado" },
    { label: "E-mail (Resend)", ok: isEmailConfigured(), detail: isEmailConfigured() ? "ativo" : "não configurado" },
    { label: "Rotinas agendadas", ok: Boolean(serverEnv.cronSecret), detail: serverEnv.cronSecret ? "segredo definido" : "CRON_SECRET ausente" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Visão geral" description="Números tirados do banco agora; nada é estimado." />
      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Contas" value={data.users} hint={`${data.newUsers} novas nos últimos 7 dias`} href="/admin/usuarios" icon={UsersIcon} />
        <Tile label="Estudaram nos últimos 7 dias" value={data.activeUsers} hint="Com ao menos uma sessão registrada" icon={UserPlusIcon} />
        <Tile
          label="Aguardando moderação"
          value={data.pending}
          hint={`${data.published} materiais publicados`}
          href="/admin/moderacao"
          icon={BookCheckIcon}
        />
        <Tile label="Denúncias abertas" value={data.openReports} href="/admin/denuncias" icon={FlagIcon} />
        <Tile label="Mensagens de contato abertas" value={data.openContacts} href="/admin/contato" icon={InboxIcon} />
        <Tile label="Assinaturas Pro ativas" value={data.proSubs} hint="Inclui cortesias e pagamentos pendentes" icon={SparklesIcon} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Consumo de IA em {data.month}</CardTitle>
            <CardDescription>Usos registrados no período (estornos não entram). Tokens quando o provedor informa.</CardDescription>
          </CardHeader>
          {data.usage.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Recurso
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">
                    Usos
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    Tokens (entrada / saída)
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.usage.map((u) => (
                  <tr key={u.feature} className="border-b border-border last:border-b-0">
                    <th scope="row" className="py-2 pr-3 text-left font-medium">
                      {featureLabels[u.feature as UsageFeature] ?? u.feature}
                    </th>
                    <td className="py-2 pr-3 text-right tabular-nums">{u.quantity.toLocaleString("pt-BR")}</td>
                    <td className="py-2 text-right tabular-nums">
                      {u.inputTokens.toLocaleString("pt-BR")} / {u.outputTokens.toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum uso de IA registrado neste mês.</p>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Integrações</CardTitle>
            <CardDescription>Estado lido das variáveis de ambiente do servidor (valores secretos nunca são exibidos).</CardDescription>
          </CardHeader>
          <ul className="flex flex-col divide-y divide-border">
            {integrations.map((i) => (
              <li key={i.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-medium">{i.label}</span>
                <span className={i.ok ? "font-semibold text-success-text" : "font-semibold text-warning-text"}>{i.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
