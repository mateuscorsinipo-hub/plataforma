import { SearchIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives";
import { getSessionUser } from "@/lib/auth/session";
import { initialsOf, safeAvatarUrl } from "@/lib/avatar";
import { searchProfiles } from "@/lib/data/profiles";
import { localDateString } from "@/lib/domain/dates";
import { checkRateLimit, rateLimits } from "@/lib/security/rate-limit";
import { anonymousVisitorKey } from "@/lib/security/request";

export const metadata: Metadata = {
  title: "Encontrar pessoas",
  description: "Procure estudantes que publicam materiais na biblioteca.",
  robots: { index: false, follow: true },
};

export default function PeoplePage({ searchParams }: PageProps<"/biblioteca/pessoas">) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-2">
        <Link href="/biblioteca" className="text-sm font-semibold text-primary hover:underline">
          Biblioteca
        </Link>
        <h1 className="font-display text-3xl font-extrabold">Encontrar pessoas</h1>
        <p className="text-[0.9375rem] leading-relaxed text-ink-2">
          Busque pelo @ ou pelo nome. Aparecem só perfis públicos e pessoas que já publicaram materiais.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-11" />}>
        <People searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function People({ searchParams }: { searchParams: PageProps<"/biblioteca/pessoas">["searchParams"] }) {
  const params = await searchParams;
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (raw ?? "").trim().slice(0, 40);
  let results: Awaited<ReturnType<typeof searchProfiles>> = [];
  let limited = false;
  if (query.length >= 2) {
    const user = await getSessionUser();
    const key = user ? `user:${user.id}` : await anonymousVisitorKey(localDateString("America/Sao_Paulo"));
    // Limite por visitante: dificulta varrer a lista de usuários.
    limited = !(await checkRateLimit(`people:${key}`, rateLimits.profileSearch));
    if (!limited) results = await searchProfiles(query);
  }

  return (
    <div className="flex flex-col gap-5">
      <form role="search" action="/biblioteca/pessoas" method="get" className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="busca-pessoas" className="sr-only">
            Nome ou @
          </label>
          <Input id="busca-pessoas" name="q" type="search" defaultValue={query} minLength={2} maxLength={40} placeholder="Ex.: @ana.lima" className="pl-10" />
        </div>
        <Button type="submit">Buscar</Button>
      </form>
      {limited ? (
        <Alert tone="warning">Muitas buscas em pouco tempo. Tente de novo em alguns minutos.</Alert>
      ) : query.length < 2 ? (
        <EmptyState icon={UsersIcon} title="Digite pelo menos 2 letras" description="Você pode buscar pelo @ (sem espaços) ou pelo nome de perfis públicos." />
      ) : results.length ? (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
          {results.map((p) => {
            const avatar = safeAvatarUrl(p.avatarUrl);
            return (
              <li key={p.username}>
                <Link href={`/u/${p.username}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
                  <Avatar className="size-10">
                    {avatar ? <AvatarImage src={avatar} alt="" /> : null}
                    <AvatarFallback>{initialsOf(p.displayName ?? p.username)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.displayName ?? `@${p.username}`}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.displayName ? `@${p.username} · ` : ""}
                      {p.materialsCount === 1 ? "1 material" : `${p.materialsCount} materiais`}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={UsersIcon} title="Ninguém encontrado" description="Confira a grafia do @. Perfis privados sem materiais publicados não aparecem na busca." />
      )}
    </div>
  );
}
