"use client";

import { MessageSquareIcon, PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { onTutorActivity } from "./events";

export type ConversationItem = { id: string; title: string; group: string };

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function ConversationList({
  items: initialItems,
  usage: initialUsage,
  onNavigate,
  inDrawer = false,
}: {
  items: ConversationItem[];
  usage: { used: number; limit: number; window: "day" | "month" } | null;
  onNavigate?: () => void;
  /** Na gaveta do celular o botão de fechar fica no canto superior direito. */
  inDrawer?: boolean;
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(initialItems);
  const [usage, setUsage] = useState(initialUsage);

  // Conversa nova, renomeada ou com mensagem recente sobe para o topo sem recarregar a página.
  useEffect(
    () =>
      onTutorActivity((activity) => {
        setItems((prev) => {
          if (activity.removed) return prev.filter((item) => item.id !== activity.conversationId);
          const current = prev.find((item) => item.id === activity.conversationId);
          const updated: ConversationItem = { id: activity.conversationId, title: activity.title ?? current?.title ?? "Nova conversa", group: "Hoje" };
          return [updated, ...prev.filter((item) => item.id !== activity.conversationId)];
        });
        if (activity.usage) {
          const next = activity.usage;
          setUsage((prev) => (prev ? { ...prev, used: next.used, limit: next.limit } : prev));
        }
      }),
    [],
  );
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q ? items.filter((item) => normalize(item.title).includes(q)) : items;
  }, [items, query]);
  const groups = useMemo(() => {
    const map = new Map<string, ConversationItem[]>();
    for (const item of filtered) map.set(item.group, [...(map.get(item.group) ?? []), item]);
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex flex-col gap-3 border-b border-border p-4", inDrawer && "pr-16")}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Tutor</h2>
          <Button asChild size="sm">
            <Link href="/app/tutor" onClick={onNavigate}>
              <PlusIcon className="size-4" /> Nova conversa
            </Link>
          </Button>
        </div>
        {items.length > 4 ? (
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="buscar-conversas" className="sr-only">
              Buscar conversas
            </label>
            <input
              id="buscar-conversas"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar conversas"
              className="h-10 w-full rounded-xl border border-input bg-background pr-3 pl-9 text-sm outline-none focus:border-primary focus:ring-[3px] focus:ring-ring/20"
            />
          </div>
        ) : null}
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Conversas">
        {groups.length ? (
          groups.map(([group, list]) => (
            <div key={group} className="mb-3">
              <p className="px-2.5 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group}</p>
              <ul className="flex flex-col gap-0.5">
                {list.map((item) => {
                  const active = pathname === `/app/tutor/${item.id}`;
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/app/tutor/${item.id}`}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-muted",
                          active && "bg-secondary font-semibold text-secondary-foreground hover:bg-secondary",
                        )}
                      >
                        <MessageSquareIcon className="size-4 shrink-0 opacity-60" aria-hidden="true" />
                        <span className="min-w-0 truncate">{item.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        ) : (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {items.length ? "Nenhuma conversa encontrada." : "Suas conversas com o tutor aparecem aqui."}
          </p>
        )}
      </nav>
      {usage ? (
        <div className="border-t border-border p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Mensagens {usage.window === "day" ? "hoje" : "no mês"}</span>
            <span className="font-semibold">
              {usage.used} de {usage.limit}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (usage.used / Math.max(1, usage.limit)) * 100)}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
