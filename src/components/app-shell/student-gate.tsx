import { requireStudent } from "@/lib/auth/session";

/**
 * Porta de entrada das páginas do app: exige sessão válida, conta ativa e
 * onboarding concluído antes de renderizar o conteúdo. Cada página ainda
 * autoriza seus próprios dados (RLS + verificação nas ações).
 */
export async function StudentGate({ children }: { children: React.ReactNode }) {
  await requireStudent();
  return <>{children}</>;
}
