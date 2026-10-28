import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { requireStaff } from "@/lib/auth/session";
import { getUserDetail } from "@/lib/data/admin";
import { leagueLabel } from "@/lib/domain/gamification";

import { revokeManualPro, setAccountSuspended, setStaffRole } from "../../actions";
import { ConfirmAction } from "../../_components/confirm-action";
import { GrantProDialog } from "../../_components/grant-pro";
import { AdminSkeleton } from "../../_components/admin-skeleton";

export const metadata: Metadata = { title: "Usuário" };

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const statusLabels = { active: "Ativa", pending_guardian: "Aguardando responsável", suspended: "Suspensa" } as const;

function age(birth: string | null): string {
  if (!birth) return "não informada";
  const [y, m, d] = birth.split("-").map(Number);
  const now = new Date();
  let years = now.getUTCFullYear() - y!;
  if (now.getUTCMonth() + 1 < m! || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d!)) years -= 1;
  return `${years} anos`;
}

export default function UserDetailPage({ params }: PageProps<"/admin/usuarios/[id]">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <UserDetailPageContent params={params} />
    </Suspense>
  );
}

async function UserDetailPageContent({ params }: { params: PageProps<"/admin/usuarios/[id]">["params"] }) {
  const { user: me, isAdmin } = await requireStaff();
  const { id } = await params;
  const detail = await getUserDetail(id);
  if (!detail) notFound();
  const { user, subscriptions, stats } = detail;
  const isSelf = me.id === user.id;
  const roles = user.roles;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/usuarios" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden="true" /> Usuários
      </Link>
      <PageHeader
        title={`@${user.username}`}
        description={user.display_name || undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant={user.account_status === "active" ? "success" : user.account_status === "suspended" ? "danger" : "warning"}>
              {statusLabels[user.account_status]}
            </Badge>
            {roles.map((role) => (
              <Badge key={role} variant="dark">
                {role === "admin" ? "admin" : "moderação"}
              </Badge>
            ))}
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conta</CardTitle>
          </CardHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="break-all">{user.email}</dd>
            <dt className="text-muted-foreground">Idade</dt>
            <dd>{age(user.birth_date)}</dd>
            <dt className="text-muted-foreground">Criada em</dt>
            <dd>{date.format(new Date(user.created_at))}</dd>
            <dt className="text-muted-foreground">Último acesso</dt>
            <dd>{user.last_sign_in_at ? dateTime.format(new Date(user.last_sign_in_at)) : "nunca"}</dd>
            <dt className="text-muted-foreground">Progresso</dt>
            <dd>{stats ? `nível ${stats.level} · ${stats.xp_total} XP · liga ${leagueLabel(stats.league)}` : "—"}</dd>
            <dt className="text-muted-foreground">Materiais</dt>
            <dd>
              {detail.materials} publicados ou em rascunho · {detail.reportsAgainst} denúncias recebidas
            </dd>
          </dl>
          <Link href={`/u/${user.username}`} target="_blank" className="text-sm font-semibold text-primary hover:underline">
            Ver perfil público
          </Link>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ações</CardTitle>
          </CardHeader>
          {isSelf ? (
            <p className="text-sm text-muted-foreground">Esta é a sua conta. Outra pessoa da administração precisa fazer alterações nela.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {user.account_status === "suspended" ? (
                <ConfirmAction
                  label="Reativar conta"
                  title="Reativar a conta"
                  description="A pessoa volta a entrar e usar a plataforma."
                  confirmLabel="Reativar"
                  noteLabel="Motivo"
                  action={setAccountSuspended.bind(null, user.id, false)}
                />
              ) : (
                <ConfirmAction
                  label="Suspender conta"
                  variant="destructive"
                  title="Suspender a conta"
                  description="A pessoa perde o acesso imediatamente (login bloqueado). Os dados ficam preservados."
                  confirmLabel="Suspender"
                  noteLabel="Motivo (fica na auditoria)"
                  action={setAccountSuspended.bind(null, user.id, true)}
                />
              )}
              {isAdmin ? (
                <>
                  <GrantProDialog userId={user.id} />
                  {roles.includes("moderator") ? (
                    <ConfirmAction
                      label="Tirar da moderação"
                      title="Remover papel de moderação"
                      description="A pessoa deixa de acessar a moderação."
                      confirmLabel="Remover"
                      action={setStaffRole.bind(null, user.id, "moderator", false)}
                    />
                  ) : (
                    <ConfirmAction
                      label="Tornar moderador"
                      title="Dar papel de moderação"
                      description="A pessoa passa a revisar materiais, denúncias e mensagens de contato."
                      confirmLabel="Confirmar"
                      action={setStaffRole.bind(null, user.id, "moderator", true)}
                    />
                  )}
                </>
              ) : null}
            </div>
          )}
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Assinaturas</CardTitle>
        </CardHeader>
        {subscriptions.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {subscriptions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  <strong className="font-semibold">{s.plan_id}</strong> · {s.provider === "manual" ? "cortesia" : "Stripe"} · {s.status}
                  {s.current_period_end ? ` · até ${date.format(new Date(s.current_period_end))}` : ""}
                  {s.cancel_at_period_end ? " · cancela no fim do período" : ""}
                </span>
                {isAdmin && s.provider === "manual" && s.status === "active" ? (
                  <ConfirmAction
                    label="Encerrar cortesia"
                    variant="ghost"
                    title="Encerrar o Pro de cortesia"
                    description="A conta volta ao plano Grátis agora."
                    confirmLabel="Encerrar"
                    action={revokeManualPro.bind(null, s.id)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma assinatura.</p>
        )}
      </Card>
    </div>
  );
}
