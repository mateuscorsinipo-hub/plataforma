"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { folderItemKinds, folderSchema, type FolderInput, type FolderItemKind } from "@/lib/validation/materials";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const MAX_FOLDERS = 200;

export async function saveFolder(id: string | null, input: FolderInput): Promise<Result<{ id: string }>> {
  const user = await requireUser("/app/pastas");
  const parsed = folderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const supabase = await createSupabaseServerClient();
  const values = {
    name: parsed.data.name,
    color: parsed.data.color,
    subject_id: parsed.data.subjectId,
    exam_date: parsed.data.examDate,
  };

  if (id) {
    const folderId = uuidSchema.safeParse(id);
    if (!folderId.success) return { ok: false, error: "Pasta inválida." };
    const { data, error } = await supabase.from("folders").update(values).eq("id", folderId.data).select("id").maybeSingle();
    if (error?.code === "23505") return { ok: false, error: "Você já tem uma pasta com esse nome." };
    if (error || !data) return { ok: false, error: "Não foi possível salvar a pasta." };
    refresh();
    return { ok: true, id: data.id };
  }

  const { count } = await supabase.from("folders").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_FOLDERS) return { ok: false, error: `Você chegou ao limite de ${MAX_FOLDERS} pastas.` };
  const { data, error } = await supabase
    .from("folders")
    .insert({ ...values, user_id: user.id })
    .select("id")
    .single();
  if (error?.code === "23505") return { ok: false, error: "Você já tem uma pasta com esse nome." };
  if (error || !data) return { ok: false, error: "Não foi possível criar a pasta." };
  refresh();
  return { ok: true, id: data.id };
}

/** Excluir a pasta não apaga os itens: eles só saem da pasta (FK com SET NULL). */
export async function deleteFolder(id: string): Promise<Result> {
  await requireUser("/app/pastas");
  const folderId = uuidSchema.safeParse(id);
  if (!folderId.success) return { ok: false, error: "Pasta inválida." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("folders").delete().eq("id", folderId.data).select("id");
  if (error || !data?.length) return { ok: false, error: "Não foi possível excluir a pasta." };
  redirect("/app/pastas?pasta-excluida=1");
}

const moveSchema = z.object({
  kind: z.enum(folderItemKinds),
  itemId: z.uuid(),
  folderId: z.uuid().nullable(),
});

const tables = {
  file: "uploaded_files",
  generation: "ai_generations",
  deck: "flashcard_decks",
  quiz: "quizzes",
  conversation: "ai_conversations",
} as const;

async function moveOne(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  kind: FolderItemKind,
  itemId: string,
  folderId: string | null,
): Promise<boolean> {
  if (kind === "material") {
    // Guardar um material numa pasta é o mesmo que salvá-lo (o RLS só aceita materiais publicados).
    if (folderId) {
      const { data: updated } = await supabase
        .from("material_saves")
        .update({ folder_id: folderId })
        .eq("user_id", userId)
        .eq("material_id", itemId)
        .eq("kind", "saved")
        .select("material_id");
      if (updated?.length) return true;
      const { error } = await supabase.from("material_saves").insert({ user_id: userId, material_id: itemId, kind: "saved", folder_id: folderId });
      return !error;
    }
    const { data } = await supabase
      .from("material_saves")
      .update({ folder_id: null })
      .eq("user_id", userId)
      .eq("material_id", itemId)
      .eq("kind", "saved")
      .select("material_id");
    return Boolean(data?.length);
  }
  // O RLS limita ao que é do usuário; a FK composta (folder_id, user_id) impede pastas alheias.
  const { data } = await supabase.from(tables[kind]).update({ folder_id: folderId }).eq("id", itemId).select("id");
  return Boolean(data?.length);
}

export async function moveToFolder(kind: FolderItemKind, itemId: string, folderId: string | null): Promise<Result> {
  const user = await requireUser("/app/pastas");
  const parsed = moveSchema.safeParse({ kind, itemId, folderId });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const supabase = await createSupabaseServerClient();
  if (parsed.data.folderId) {
    const { data: folder } = await supabase.from("folders").select("id").eq("id", parsed.data.folderId).maybeSingle();
    if (!folder) return { ok: false, error: "Pasta não encontrada." };
  }
  const moved = await moveOne(supabase, user.id, parsed.data.kind, parsed.data.itemId, parsed.data.folderId);
  if (!moved) return { ok: false, error: "Não foi possível mover este item." };
  refresh();
  return { ok: true };
}

const addSchema = z.object({
  folderId: z.uuid(),
  items: z.array(z.object({ kind: z.enum(folderItemKinds), id: z.uuid() })).min(1, "Escolha pelo menos um item.").max(100),
});

export async function addItemsToFolder(folderId: string, items: { kind: FolderItemKind; id: string }[]): Promise<Result<{ moved: number }>> {
  const user = await requireUser("/app/pastas");
  const parsed = addSchema.safeParse({ folderId, items });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const supabase = await createSupabaseServerClient();
  const { data: folder } = await supabase.from("folders").select("id").eq("id", parsed.data.folderId).maybeSingle();
  if (!folder) return { ok: false, error: "Pasta não encontrada." };
  let moved = 0;
  for (const item of parsed.data.items) {
    if (await moveOne(supabase, user.id, item.kind, item.id, parsed.data.folderId)) moved += 1;
  }
  refresh();
  if (!moved) return { ok: false, error: "Nenhum item pôde ser adicionado." };
  return { ok: true, moved };
}
