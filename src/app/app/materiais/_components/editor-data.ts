import "server-only";

import type { ProfileRow } from "@/lib/auth/session";
import { getPlanForUser } from "@/lib/billing/entitlements";
import { listStudyFiles } from "@/lib/data/files";
import { getPublishEligibility, type MaterialEvent } from "@/lib/data/library";
import { getSubjects } from "@/lib/data/subjects";

import type { EditorEvent } from "./material-editor";

const eventLabels: Record<string, string> = {
  created: "Rascunho criado",
  submitted: "Enviado para revisão",
  published: "Publicado",
  returned_to_review: "Voltou para revisão",
  rejected: "Moderação pediu ajustes",
  removed: "Removido pela moderação",
  withdrawn: "Voltou a ser rascunho",
  restored: "Restaurado pela moderação",
};

export function toEditorEvents(events: MaterialEvent[], timezone: string): EditorEvent[] {
  const format = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: timezone });
  return events.map((e) => ({
    id: e.id,
    label: eventLabels[e.event] ?? "Atualizado",
    note: e.event === "returned_to_review" && !e.note ? "Depois de uma edição no conteúdo." : e.note,
    when: format.format(new Date(e.createdAt)),
  }));
}

/** Dados comuns do editor: matérias, arquivos prontos, limite de envio e regra de idade. */
export async function loadEditorContext(userId: string, profile: ProfileRow) {
  const [subjects, files, plan, eligibility] = await Promise.all([
    getSubjects(),
    listStudyFiles({ limit: 100 }),
    getPlanForUser(userId),
    getPublishEligibility(profile),
  ]);
  return {
    subjects: subjects.map((s) => ({ id: s.id, name: s.name })),
    files,
    maxUploadBytes: plan.maxUploadBytes,
    canPublish: eligibility.allowed,
    minAge: eligibility.settings.minAgeWithoutGuardian,
    moderationMode: eligibility.settings.moderationMode,
  };
}
