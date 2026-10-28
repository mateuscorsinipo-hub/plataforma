import { CalendarDaysIcon, FlameIcon, LockIcon, SparklesIcon, TrophyIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SubjectChip } from "@/components/brand/subject-chip";
import { AchievementIcon } from "@/components/gamification/achievement-icon";
import { MaterialCard, MaterialGrid } from "@/components/library/material-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives";
import { getSessionUser } from "@/lib/auth/session";
import { initialsOf, safeAvatarUrl } from "@/lib/avatar";
import { listMaterialsByAuthor } from "@/lib/data/library";
import { getPublicProfile } from "@/lib/data/profiles";
import { getSubjectMap } from "@/lib/data/subjects";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  // Perfis de estudantes (muitos menores de idade) não entram em buscadores; os materiais, sim.
  if (!profile) return { title: "Perfil não encontrado", robots: { index: false, follow: false } };
  return {
    title: profile.displayName ? `${profile.displayName} (@${profile.username})` : `@${profile.username}`,
    robots: { index: false, follow: true },
  };
}

export default function ProfilePage({ params }: PageProps<"/u/[username]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense
        fallback={
          <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando perfil">
            <div className="flex items-center gap-4">
              <Skeleton className="size-20 rounded-full" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        }
      >
        <Profile params={params} />
      </Suspense>
    </div>
  );
}

const monthYear = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

async function Profile({ params }: { params: PageProps<"/u/[username]">["params"] }) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) notFound();
  const [materials, subjects, viewer] = await Promise.all([listMaterialsByAuthor(profile.id, 30), getSubjectMap(), getSessionUser()]);
  const isOwner = viewer?.id === profile.id;
  const name = profile.displayName ?? `@${profile.username}`;
  const avatar = safeAvatarUrl(profile.avatarUrl);

  return (
    <div className="flex flex-col gap-8">
      {isOwner ? (
        <Alert
          tone="info"
          title="Este é o seu perfil como os outros veem"
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/app/configuracoes#privacidade">Ajustar privacidade</Link>
            </Button>
          }
        >
          {profile.isPublic
            ? "Nome, foto, bio e o que você escolheu mostrar aparecem aqui."
            : "Seu perfil é privado: aparecem só o seu @ e os materiais que você publicou."}
        </Alert>
      ) : null}

      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar className="size-20 text-2xl">
          {avatar ? <AvatarImage src={avatar} alt="" /> : null}
          <AvatarFallback className="text-xl">{initialsOf(profile.displayName ?? profile.username)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-display text-3xl leading-tight font-extrabold break-words">{name}</h1>
          {profile.displayName ? <p className="text-sm font-semibold text-muted-foreground">@{profile.username}</p> : null}
          {profile.bio ? <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-ink-2">{profile.bio}</p> : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {profile.memberSince ? (
              <span className="flex items-center gap-1.5">
                <CalendarDaysIcon className="size-4" aria-hidden="true" /> No Grifo desde {monthYear.format(new Date(profile.memberSince))}
              </span>
            ) : null}
            {!profile.isPublic ? (
              <span className="flex items-center gap-1.5">
                <LockIcon className="size-4" aria-hidden="true" /> Perfil privado
              </span>
            ) : null}
            <span>
              {profile.materialsCount === 1 ? "1 material publicado" : `${profile.materialsCount.toLocaleString("pt-BR")} materiais publicados`}
            </span>
          </div>
          {profile.subjects.length ? (
            <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Matérias que estuda">
              {profile.subjects.map((s) => (
                <li key={s.slug}>
                  <SubjectChip subject={s} size="sm" />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      {profile.stats ? (
        <section aria-label="Estatísticas" className="grid grid-cols-3 gap-3 sm:max-w-xl">
          <Card className="gap-1 p-4">
            <SparklesIcon className="size-5 text-primary" aria-hidden="true" />
            <p className="font-display text-2xl font-extrabold tabular-nums">{profile.stats.level}</p>
            <p className="text-xs text-muted-foreground">Nível</p>
          </Card>
          <Card className="gap-1 p-4">
            <TrophyIcon className="size-5 text-primary" aria-hidden="true" />
            <p className="font-display text-2xl font-extrabold tabular-nums">{profile.stats.xpTotal.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">XP total</p>
          </Card>
          <Card className="gap-1 p-4">
            <FlameIcon className="size-5 text-streak-text" aria-hidden="true" />
            <p className="font-display text-2xl font-extrabold tabular-nums">{profile.stats.longestStreak}</p>
            <p className="text-xs text-muted-foreground">Maior sequência (dias)</p>
          </Card>
        </section>
      ) : null}

      {profile.achievements.length ? (
        <section aria-labelledby="conquistas" className="flex flex-col gap-3">
          <h2 id="conquistas" className="font-display text-xl font-bold">
            Conquistas
          </h2>
          <ul className="flex flex-wrap gap-2">
            {profile.achievements.map((a) => (
              <li key={a.code} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold">
                <span className="flex size-7 items-center justify-center rounded-lg bg-secondary text-primary">
                  <AchievementIcon name={a.icon} className="size-4" />
                </span>
                {a.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="materiais" className="flex flex-col gap-4">
        <h2 id="materiais" className="font-display text-xl font-bold">
          Materiais publicados
        </h2>
        {materials.length ? (
          <MaterialGrid>
            {materials.map((m) => (
              <MaterialCard key={m.id} material={m} subject={subjects.get(m.subjectId)} href={`/biblioteca/${m.slug}`} showAuthor={false} />
            ))}
          </MaterialGrid>
        ) : (
          <EmptyState
            title="Nenhum material público ainda"
            description={isOwner ? "Quando você publicar um material, ele aparece aqui." : "Esta pessoa ainda não publicou materiais na biblioteca."}
            action={
              isOwner ? (
                <Button asChild>
                  <Link href="/app/materiais/novo">Publicar um material</Link>
                </Button>
              ) : undefined
            }
          />
        )}
      </section>
    </div>
  );
}
