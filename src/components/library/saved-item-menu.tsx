"use client";

import { BookmarkXIcon, CheckIcon, EllipsisVerticalIcon, FolderIcon, HeartOffIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { toggleMaterialSave } from "@/app/(public)/biblioteca/actions";
import { moveToFolder } from "@/app/app/pastas/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Menu de um material salvo ou favoritado: guardar em pasta e remover da lista. */
export function SavedItemMenu({
  materialId,
  title,
  kind,
  folderId,
  folders,
}: {
  materialId: string;
  title: string;
  kind: "saved" | "favorite";
  folderId: string | null;
  folders: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  function move(target: string | null) {
    startTransition(async () => {
      const result = await moveToFolder("material", materialId, target);
      if (result.ok) toast.success(target ? "Guardado na pasta." : "Retirado da pasta.");
      else toast.error(result.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await toggleMaterialSave(materialId, kind);
      if (result.ok) toast.success(kind === "saved" ? "Removido dos salvos." : "Removido dos favoritos.");
      else toast.error(result.error);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Opções de “${title}”`} disabled={pending}>
          <EllipsisVerticalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {kind === "saved" ? (
          <>
            <DropdownMenuLabel>Guardar na pasta</DropdownMenuLabel>
            {folders.length ? (
              <>
                {folders.map((folder) => (
                  <DropdownMenuItem key={folder.id} onSelect={() => move(folder.id)} disabled={folder.id === folderId}>
                    {folder.id === folderId ? <CheckIcon /> : <FolderIcon />}
                    <span className="truncate">{folder.name}</span>
                  </DropdownMenuItem>
                ))}
                {folderId ? <DropdownMenuItem onSelect={() => move(null)}>Tirar da pasta</DropdownMenuItem> : null}
              </>
            ) : (
              <p className="px-2.5 pb-2 text-sm text-muted-foreground">Crie uma pasta em “Pastas” para organizar.</p>
            )}
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem destructive onSelect={remove}>
          {kind === "saved" ? <BookmarkXIcon /> : <HeartOffIcon />}
          {kind === "saved" ? "Remover dos salvos" : "Remover dos favoritos"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
