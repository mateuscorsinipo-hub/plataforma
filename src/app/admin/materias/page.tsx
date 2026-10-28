import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/ui/feedback";
import { requireStaff } from "@/lib/auth/session";
import { listAllSubjects } from "@/lib/data/admin";

import { SubjectList } from "../_components/subject-editor";
import { AdminSkeleton } from "../_components/admin-skeleton";

export const metadata: Metadata = { title: "Matérias" };

export default function SubjectsAdminPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <SubjectsAdminPageContent />
    </Suspense>
  );
}

async function SubjectsAdminPageContent() {
  await requireStaff("admin");
  const subjects = await listAllSubjects();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Matérias" description="Categorias usadas na biblioteca, nos filtros e nos formulários de estudo." />
      <SubjectList subjects={subjects} />
    </div>
  );
}
