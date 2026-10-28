import { ScrollTextIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireStaff } from "@/lib/auth/session";
import { listAuditLogs } from "@/lib/data/admin";

import { AdminSkeleton } from "../_components/admin-skeleton";

export const metadata: Metadata = { title: "Auditoria" };

const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" });

const actionLabels: Record<string, string> = {
  "material.approve": "Aprovou material",
  "material.request_changes": "Pediu ajustes",
  "material.remove": "Removeu material",
  "report.keep": "Manteve material denunciado",
  "report.dismiss": "Arquivou denúncias",
  "user.suspend": "Suspendeu conta",
  "user.reactivate": "Reativou conta",
  "role.grant": "Concedeu papel",
  "role.revoke": "Removeu papel",
  "plan.grant_manual": "Concedeu Pro de cortesia",
  "plan.revoke_manual": "Encerrou Pro de cortesia",
  "contact.status": "Atualizou mensagem de contato",
  "subject.create": "Criou matéria",
  "subject.update": "Editou matéria",
  "settings.update": "Alterou configurações",
};

export default function AuditPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AuditPageContent />
    </Suspense>
  );
}

async function AuditPageContent() {
  await requireStaff("admin");
  const logs = await listAuditLogs();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Auditoria" description="As 200 ações administrativas mais recentes: quem fez, o quê, em quem e por quê." />
      {logs.length ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Registro de auditoria</caption>
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Quando
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Quem
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Ação
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Detalhes
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border align-top last:border-b-0">
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground tabular-nums">{when.format(new Date(log.created_at))}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{log.actor ? `@${log.actor}` : "sistema"}</td>
                  <td className="px-4 py-2.5">
                    {actionLabels[log.action] ?? log.action}
                    <span className="block text-xs text-muted-foreground">
                      {log.target_type}
                      {log.target_id ? ` · ${log.target_id}` : ""}
                    </span>
                  </td>
                  <td className="max-w-md px-4 py-2.5">
                    <code className="block text-xs break-all whitespace-pre-wrap text-ink-2">{JSON.stringify(log.details)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={ScrollTextIcon} title="Nada registrado ainda" description="Toda ação administrativa aparece aqui." />
      )}
    </div>
  );
}
