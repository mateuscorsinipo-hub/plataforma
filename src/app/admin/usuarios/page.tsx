import { SearchIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { requireStaff } from "@/lib/auth/session";
import { findUsers } from "@/lib/data/admin";

import { AdminSkeleton } from "../_components/admin-skeleton";

export const metadata: Metadata = { title: "Usuários" };

const statusLabels = { active: "Ativa", pending_guardian: "Aguardando responsável", suspended: "Suspensa" } as const;
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export default function UsersPage({ searchParams }: PageProps<"/admin/usuarios">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <UsersPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function UsersPageContent({ searchParams }: { searchParams: PageProps<"/admin/usuarios">["searchParams"] }) {
  await requireStaff();
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim().slice(0, 80) ?? "";
  const users = await findUsers(query);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Usuários" description="Busque por @, nome, e-mail ou identificador. E-mails aparecem só para a equipe." />
      <form role="search" action="/admin/usuarios" method="get" className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <label htmlFor="busca-usuarios" className="sr-only">
            Buscar usuários
          </label>
          <Input
            id="busca-usuarios"
            name="q"
            type="search"
            defaultValue={query}
            maxLength={80}
            placeholder="@usuario, nome ou e-mail"
            className="pl-10"
          />
        </div>
        <Button type="submit">Buscar</Button>
      </form>
      {users.length ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">{query ? `Resultados para ${query}` : "Contas mais recentes"}</caption>
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Conta
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  E-mail
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Situação
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Desde
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/usuarios/${u.id}`} className="font-semibold hover:underline">
                      @{u.username}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{u.display_name}</span>
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={u.account_status === "active" ? "success" : u.account_status === "suspended" ? "danger" : "warning"}>
                        {statusLabels[u.account_status]}
                      </Badge>
                      {u.roles.map((role) => (
                        <Badge key={role} variant="dark">
                          {role === "admin" ? "admin" : "moderação"}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{date.format(new Date(u.created_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={UsersIcon} title="Ninguém encontrado" description="Confira a grafia ou busque pelo e-mail completo." />
      )}
    </div>
  );
}
