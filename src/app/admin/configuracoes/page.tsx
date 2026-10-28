import type { Metadata } from "next";
import { Suspense } from "react";

import { Alert, PageHeader } from "@/components/ui/feedback";
import { requireStaff } from "@/lib/auth/session";
import { listSettings } from "@/lib/data/admin";

import { SettingsForm, type SettingsValues } from "../_components/settings-form";
import { AdminSkeleton } from "../_components/admin-skeleton";

export const metadata: Metadata = { title: "Configurações" };

export default function SettingsAdminPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <SettingsAdminPageContent />
    </Suspense>
  );
}

async function SettingsAdminPageContent() {
  await requireStaff("admin");
  const rows = await listSettings();
  const value = (key: string) => rows.find((r) => r.key === key)?.value;
  const num = (key: string, fallback: number) => {
    const n = Number(value(key));
    return Number.isInteger(n) ? n : fallback;
  };
  const initial: SettingsValues = {
    moderation_mode: value("moderation_mode") === "post" ? "post" : "pre",
    report_auto_hide_threshold: num("report_auto_hide_threshold", 3),
    community_min_age_without_guardian: num("community_min_age_without_guardian", 16),
    child_age_limit: num("child_age_limit", 12),
  };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configurações"
        description="Regras do produto aplicadas pelo banco. Cada alteração fica na auditoria com os valores anteriores."
      />
      <Alert tone="warning" title="Regras de idade têm efeito legal">
        Mudar idades altera quem precisa de consentimento do responsável. Confirme com o jurídico antes de alterar.
      </Alert>
      <SettingsForm initial={initial} />
    </div>
  );
}
