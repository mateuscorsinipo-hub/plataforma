import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";

import { loadEditorContext } from "../_components/editor-data";
import { MaterialEditor } from "../_components/material-editor";

export const metadata: Metadata = { title: "Novo material" };

export default function NewMaterialPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/app/materiais" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden="true" /> Meus materiais
      </Link>
      <PageHeader title="Novo material" description="Escreva com suas palavras. Materiais copiados de livros, apostilas ou provas são removidos." />
      <Suspense fallback={<EditorSkeleton />}>
        <NewMaterial />
      </Suspense>
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" aria-busy="true" aria-label="Carregando editor">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-11" />
        <Skeleton className="h-20" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
      <Skeleton className="h-[32rem] rounded-2xl" />
    </div>
  );
}

async function NewMaterial() {
  const { user, profile } = await requireStudent("/app/materiais/novo");
  const context = await loadEditorContext(user.id, profile);
  return (
    <MaterialEditor
      material={null}
      initial={{
        title: "",
        description: "",
        subjectId: "",
        schoolStage: profile.school_stage ?? "",
        gradeYear: profile.grade_year ? String(profile.grade_year) : "",
        topic: "",
        tags: "",
        materialType: "summary",
        content: "",
        fileId: null,
        visibility: "public",
        copyright: false,
      }}
      subjects={context.subjects}
      files={context.files}
      canPublish={context.canPublish}
      minAge={context.minAge}
      moderationMode={context.moderationMode}
      maxUploadBytes={context.maxUploadBytes}
      events={[]}
    />
  );
}
