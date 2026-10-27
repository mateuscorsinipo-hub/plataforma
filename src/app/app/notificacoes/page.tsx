import { BellIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { markAllNotificationsRead, markNotificationRead } from "./actions";

export const metadata: Metadata = { title: "Notificações" };

export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notificações"
        description="Conquistas, moderação dos seus materiais e lembretes."
        actions={
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="outline" size="sm">
              Marcar todas como lidas
            </Button>
          </form>
        }
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <NotificationList />
      </Suspense>
    </div>
  );
}

async function NotificationList() {
  const { user } = await requireStudent("/app/notificacoes");
  const supabase = await createSupabaseServerClient();
  const { data: items } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!items?.length) {
    return <EmptyState icon={BellIcon} title="Nada por aqui" description="Quando houver novidades sobre seus estudos ou materiais, elas aparecem aqui." />;
  }

  const formatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            "flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4",
            !item.read_at && "border-[#c9d6fb] bg-secondary/40",
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="font-bold">
              {!item.read_at ? <span className="mr-2 inline-block size-2 rounded-full bg-primary align-middle" aria-label="Não lida" /> : null}
              {item.title}
            </p>
            {item.body ? <p className="text-sm text-ink-2">{item.body}</p> : null}
            <p className="text-xs text-muted-foreground">{formatter.format(new Date(item.created_at))}</p>
          </div>
          <div className="flex gap-2">
            {item.link ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={item.link}>Abrir</Link>
              </Button>
            ) : null}
            {!item.read_at ? (
              <form action={markNotificationRead}>
                <input type="hidden" name="id" value={item.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Marcar como lida
                </Button>
              </form>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
