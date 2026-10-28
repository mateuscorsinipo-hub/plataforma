import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { getUserTimezone } from "@/lib/billing/entitlements";
import { getMyMaterial, listMaterialEvents } from "@/lib/data/library";

import { loadEditorContext, toEditorEvents } from "../../_components/editor-data";
import { MaterialEditor } from "../../_components/material-editor";

export const metadata: Metadata = { title: "Editar material" };

export default function EditMaterialPage({ params }: PageProps<"/app/materiais/[id]/editar">) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/app/materiais" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden="true" /> Meus materiais
      </Link>
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando editor">
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        }
      >
        <EditMaterial params={params} />
      </Suspense>
    </div>
  );
}

async function EditMaterial({ params }: { params: PageProps<"/app/materiais/[id]/editar">["params"] }) {
  const { id } = await params;
  const { user, profile } = await requireStudent(`/app/materiais/${id}/editar`);
  const material = await getMyMaterial(id, user.id);
  if (!material) notFound();
  if (material.status === "removed") redirect(`/app/biblioteca/${material.slug}`);
  const [context, events, timezone] = await Promise.all([loadEditorContext(user.id, profile), listMaterialEvents(material.id), getUserTimezone(user.id)]);

  return (
    <>
      <PageHeader
        title="Editar material"
        description={material.title}
        actions={
          <Button asChild variant="outline">
            <Link href={`/app/biblioteca/${material.slug}`}>
              <ExternalLinkIcon className="size-4" /> Ver página
            </Link>
          </Button>
        }
      />
      <MaterialEditor
        material={{ id: material.id, slug: material.slug, status: material.status, moderationNote: material.moderation_note }}
        initial={{
          title: material.title,
          description: material.description,
          subjectId: material.subject_id,
          schoolStage: material.school_stage ?? "",
          gradeYear: material.grade_year ? String(material.grade_year) : "",
          topic: material.topic ?? "",
          tags: material.tags.join(", "),
          materialType: material.material_type,
          content: material.content,
          fileId: material.file_id,
          visibility: material.visibility,
          copyright: Boolean(material.copyright_declared_at),
        }}
        subjects={context.subjects}
        files={context.files}
        canPublish={context.canPublish}
        minAge={context.minAge}
        moderationMode={context.moderationMode}
        maxUploadBytes={context.maxUploadBytes}
        events={toEditorEvents(events, timezone)}
      />
    </>
  );
}
