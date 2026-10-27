import { Skeleton } from "@/components/ui/feedback";
import { aiAvailability } from "@/lib/ai";
import { requireUser } from "@/lib/auth/session";
import { getPlanForUser, getUsageSummary, getUserTimezone } from "@/lib/billing/entitlements";
import { listConversations } from "@/lib/data/tutor";
import { daysBetween, localDateString } from "@/lib/domain/dates";

import { ConversationList, type ConversationItem } from "./conversation-list";

function groupFor(lastMessageAt: string, today: string, timezone: string): string {
  const day = localDateString(timezone, new Date(lastMessageAt));
  const diff = daysBetween(day, today);
  if (diff <= 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff < 7) return "Últimos 7 dias";
  if (diff < 30) return "Últimos 30 dias";
  return "Mais antigas";
}

/** Lista de conversas (servidor): agrupada por data no fuso do estudante. */
export async function ConversationSidebar({ mobile = false }: { mobile?: boolean }) {
  const user = await requireUser("/app/tutor");
  const [conversations, timezone, plan] = await Promise.all([listConversations(), getUserTimezone(user.id), getPlanForUser(user.id)]);
  const today = localDateString(timezone);
  const items: ConversationItem[] = conversations.map((c) => ({ id: c.id, title: c.title, group: groupFor(c.lastMessageAt, today, timezone) }));
  const usage = aiAvailability().available ? (await getUsageSummary(user.id, plan, timezone)).ai_chat_message : null;
  return <ConversationList items={items} usage={usage} inDrawer={mobile} key={mobile ? "mobile" : "desktop"} />;
}

export function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-label="Carregando conversas">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-5/6" />
      <Skeleton className="h-8 w-4/6" />
    </div>
  );
}
