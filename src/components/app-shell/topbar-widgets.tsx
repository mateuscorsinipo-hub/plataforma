import { BellIcon, FlameIcon } from "lucide-react";
import Link from "next/link";

import { Skeleton } from "@/components/ui/feedback";
import { Tooltip } from "@/components/ui/primitives";
import { getShellData } from "@/lib/data/shell";
import { cn } from "@/lib/utils";

import { UserMenu } from "./user-menu";

export async function TopbarWidgets() {
  const shell = await getShellData();
  if (!shell) return null;
  return (
    <div className="flex items-center gap-2">
      <Tooltip content={shell.streak > 0 ? `Sequência de ${shell.streak} dias` : "Estude hoje para começar uma sequência"}>
        <Link
          href="/app/conquistas"
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold",
            shell.streak > 0 ? "bg-streak-soft text-streak-text" : "bg-muted text-muted-foreground",
          )}
          aria-label={`Sequência: ${shell.streak} dias`}
        >
          <FlameIcon className={cn("size-4", shell.streak > 0 ? "fill-streak text-streak" : "")} aria-hidden="true" />
          {shell.streak}
        </Link>
      </Tooltip>
      <Link
        href="/app/conquistas"
        className="hidden h-10 items-center rounded-full bg-secondary px-3 text-sm font-bold text-secondary-foreground sm:inline-flex"
        aria-label={`${shell.xpTotal} pontos de experiência, nível ${shell.level}`}
      >
        {shell.xpTotal.toLocaleString("pt-BR")} XP · nível {shell.level}
      </Link>
      <Link
        href="/app/notificacoes"
        className="relative inline-flex size-10 items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-muted"
        aria-label={shell.unreadNotifications > 0 ? `Notificações: ${shell.unreadNotifications} não lidas` : "Notificações"}
      >
        <BellIcon className="size-[19px]" aria-hidden="true" />
        {shell.unreadNotifications > 0 ? (
          <span className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.6875rem] font-bold text-primary-foreground">
            {shell.unreadNotifications > 9 ? "9+" : shell.unreadNotifications}
          </span>
        ) : null}
      </Link>
      <UserMenu displayName={shell.displayName} username={shell.username} avatarUrl={shell.avatarUrl} isStaff={shell.isStaff} />
    </div>
  );
}

export function TopbarWidgetsSkeleton() {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <Skeleton className="h-10 w-16 rounded-full" />
      <Skeleton className="hidden h-10 w-32 rounded-full sm:block" />
      <Skeleton className="size-10 rounded-xl" />
      <Skeleton className="size-10 rounded-full" />
    </div>
  );
}
