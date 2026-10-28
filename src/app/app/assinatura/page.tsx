import { CircleCheckIcon, ReceiptTextIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader, Skeleton } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/primitives";
import { requireStudent } from "@/lib/auth/session";
import { getPlanForUser, getUsageSummary, getUserTimezone } from "@/lib/billing/entitlements";
import { comparisonRows, featureLabels, formatPriceBRL, type UsageFeature } from "@/lib/config/plans";
import { getLatestSubscription, listUsageHistory } from "@/lib/data/billing";
import { publicEnv } from "@/lib/env/public";
import { isBillingConfigured } from "@/lib/env/server";

import { CheckoutButton, PortalButton } from "./_components/billing-buttons";

export const metadata: Metadata = { title: "Assinatura" };

const statusLabels: Record<string, string> = {
  active: "Ativa",
  trialing: "Em período de teste",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
  incomplete: "Aguardando pagamento",
  incomplete_expired: "Pagamento não concluído",
  unpaid: "Não paga",
  paused: "Pausada",
};

export default function SubscriptionPage({ searchParams }: PageProps<"/app/assinatura">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Conta" title="Assinatura e uso" description="Seu plano, quanto você já usou neste período e o histórico de consumo." />
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando assinatura">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        }
      >
        <Subscription searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Subscription({ searchParams }: { searchParams: PageProps<"/app/assinatura">["searchParams"] }) {
  const { user } = await requireStudent("/app/assinatura");
  const params = await searchParams;
  const [plan, timezone, subscription, history] = await Promise.all([
    getPlanForUser(user.id),
    getUserTimezone(user.id),
    getLatestSubscription(user.id),
    listUsageHistory(user.id),
  ]);
  const usage = await getUsageSummary(user.id, plan, timezone);
  const billing = isBillingConfigured();
  const price = publicEnv.proPriceCents;
  const isPro = plan.id === "pro";
  const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: timezone });
  const longDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: timezone });
  const periodEnd = subscription?.currentPeriodEnd ? longDate.format(new Date(subscription.currentPeriodEnd)) : null;

  return (
    <>
      {params.status === "sucesso" ? (
        <Alert tone="success" title="Pagamento enviado">
          {isPro
            ? "Seu plano Pro está ativo. Bons estudos!"
            : "Assim que o Stripe confirmar o pagamento (normalmente em segundos), o Pro é ativado. Atualize a página em instantes."}
        </Alert>
      ) : params.status === "cancelado" ? (
        <Alert tone="info">O pagamento foi cancelado. Nada foi cobrado.</Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Plano {plan.name}</CardTitle>
            {subscription && subscription.provider !== "manual" ? (
              <Badge variant={subscription.status === "active" || subscription.status === "trialing" ? "success" : "warning"}>
                {statusLabels[subscription.status] ?? subscription.status}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm leading-relaxed text-ink-2">
            {isPro && subscription?.provider === "manual"
              ? `Pro concedido pela equipe${periodEnd ? ` até ${periodEnd}` : ""}.`
              : isPro && subscription?.cancelAtPeriodEnd && periodEnd
                ? `A assinatura foi cancelada e o Pro vale até ${periodEnd}. Depois disso, a conta volta ao plano Grátis sem perder nada.`
                : isPro && periodEnd
                  ? `Próxima renovação em ${periodEnd}.`
                  : subscription?.status === "past_due"
                    ? "O último pagamento não foi aprovado. Atualize a forma de pagamento para manter o Pro."
                    : "Flashcards, quizzes, plano, calendário e biblioteca não têm limite. Os limites abaixo valem para a IA."}
          </p>
          {subscription?.provider === "stripe" && billing ? (
            <PortalButton />
          ) : !isPro ? (
            billing && price ? (
              <CheckoutButton label={`Assinar o Pro por ${formatPriceBRL(price)}/mês`} />
            ) : (
              <Alert tone="info" title="Pro indisponível no momento">
                O pagamento ainda não foi configurado nesta instalação. Nenhuma cobrança é feita.
              </Alert>
            )
          ) : null}
          {!isPro && billing && price ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Pagamento processado pelo Stripe; o Grifo não vê nem guarda os dados do cartão. Cancele quando quiser. Na primeira
              contratação, você pode desistir em até 7 dias com reembolso integral (fale com o suporte).
            </p>
          ) : null}
        </Card>

        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Uso neste período</CardTitle>
            <CardDescription>Limites diários renovam à meia-noite; mensais, no dia 1 (no seu fuso).</CardDescription>
          </CardHeader>
          <ul className="flex flex-col gap-3.5">
            {(Object.keys(usage) as UsageFeature[]).map((feature) => {
              const item = usage[feature];
              const percent = Math.min(100, Math.round((item.used / Math.max(1, item.limit)) * 100));
              return (
                <li key={feature} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{featureLabels[feature]}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {item.used} de {item.limit} {item.window === "day" ? "hoje" : "no mês"}
                    </span>
                  </div>
                  <Progress
                    value={percent}
                    aria-label={`${featureLabels[feature]}: ${item.used} de ${item.limit}`}
                    indicatorClassName={percent >= 100 ? "bg-destructive" : percent >= 80 ? "bg-warning" : undefined}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {!isPro ? (
        <Card>
          <CardHeader>
            <CardTitle>Grátis × Pro</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Comparação entre os planos</caption>
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Recurso
                  </th>
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Grátis
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows().map((row) => (
                  <tr key={row.label} className="border-b border-border last:border-b-0">
                    <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                      {row.label}
                    </th>
                    <td className="py-2.5 pr-4">{row.free}</td>
                    <td className="py-2.5 font-semibold">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptTextIcon className="size-5 text-primary" aria-hidden="true" /> Histórico de uso
          </CardTitle>
          <CardDescription>Os 50 registros mais recentes. Usos que falharam são estornados e não aparecem.</CardDescription>
        </CardHeader>
        {history.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Histórico de consumo</caption>
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Quando
                  </th>
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Recurso
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    Quantidade
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-b-0">
                    <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground tabular-nums">{dateTime.format(new Date(entry.createdAt))}</td>
                    <td className="py-2 pr-4">{featureLabels[entry.feature as UsageFeature] ?? entry.feature}</td>
                    <td className="py-2 text-right tabular-nums">{entry.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-xl bg-muted/60 px-4 py-4 text-sm text-muted-foreground">
            <CircleCheckIcon className="size-4" aria-hidden="true" /> Nenhum uso de IA ou processamento de arquivos registrado ainda.
          </p>
        )}
      </Card>
    </>
  );
}
