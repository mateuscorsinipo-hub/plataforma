import { BookmarkIcon, HeartIcon } from "lucide-react";
import Link from "next/link";

import { MaterialCard, MaterialGrid } from "@/components/library/material-card";
import { SavedItemMenu } from "@/components/library/saved-item-menu";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { listFolderOptions } from "@/lib/data/folders";
import { listSavedMaterials } from "@/lib/data/library";
import { getSubjects } from "@/lib/data/subjects";

/** Lista pessoal de salvos ou favoritos (materiais que saíram do ar somem da lista). */
export async function SavedList({ kind }: { kind: "saved" | "favorite" }) {
  await requireStudent(kind === "saved" ? "/app/biblioteca/salvos" : "/app/biblioteca/favoritos");
  const [items, folders, subjects] = await Promise.all([listSavedMaterials(kind), kind === "saved" ? listFolderOptions() : [], getSubjects()]);
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const folderNames = new Map(folders.map((f) => [f.id, f.name]));

  if (!items.length) {
    return (
      <EmptyState
        icon={kind === "saved" ? BookmarkIcon : HeartIcon}
        title={kind === "saved" ? "Nada salvo ainda" : "Nenhum favorito ainda"}
        description={
          kind === "saved"
            ? "Salve materiais da biblioteca para revisar depois e organize em pastas."
            : "Toque em “Favoritar” nos materiais de que mais gostar para encontrá-los rápido."
        }
        action={
          <Button asChild>
            <Link href="/app/biblioteca">Explorar a biblioteca</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{items.length === 1 ? "1 material" : `${items.length} materiais`}</p>
      <MaterialGrid>
        {items.map((m) => (
          <div key={m.id} className="flex flex-col gap-1.5">
            <MaterialCard
              material={m}
              subject={subjectById.get(m.subjectId)}
              href={`/app/biblioteca/${m.slug}`}
              actions={<SavedItemMenu materialId={m.id} title={m.title} kind={kind} folderId={m.folderId} folders={folders} />}
            />
            {m.folderId && folderNames.has(m.folderId) ? (
              <Link href={`/app/pastas/${m.folderId}`} className="px-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">
                Na pasta {folderNames.get(m.folderId)}
              </Link>
            ) : null}
          </div>
        ))}
      </MaterialGrid>
    </div>
  );
}
