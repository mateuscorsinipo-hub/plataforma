import { daysBetween, formatDateBR } from "@/lib/domain/dates";
import type { FolderItemKind } from "@/lib/validation/materials";

export const itemCountLabels: Record<FolderItemKind, [string, string]> = {
  file: ["arquivo", "arquivos"],
  generation: ["item do Estúdio", "itens do Estúdio"],
  deck: ["baralho", "baralhos"],
  quiz: ["quiz", "quizzes"],
  conversation: ["conversa", "conversas"],
  material: ["material salvo", "materiais salvos"],
};

/** Contagem regressiva até a prova, no fuso do estudante. */
export function examCountdown(examDate: string | null, today: string): { text: string; urgent: boolean } | null {
  if (!examDate) return null;
  const days = daysBetween(today, examDate);
  if (days < 0) return { text: `Prova foi em ${formatDateBR(examDate)}`, urgent: false };
  if (days === 0) return { text: "Prova hoje", urgent: true };
  if (days === 1) return { text: "Prova amanhã", urgent: true };
  return { text: `Prova em ${days} dias`, urgent: days <= 7 };
}
