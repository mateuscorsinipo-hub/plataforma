import "server-only";

import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Remove todos os objetos do usuário nos buckets privados e de avatar. */
export async function deleteUserStorage(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const paths: string[] = [];

  const { data: files } = await admin.from("uploaded_files").select("storage_path").eq("user_id", userId);
  for (const file of files ?? []) paths.push(file.storage_path);

  // Também varre a pasta do usuário, para objetos que não tenham registro.
  const { data: folders } = await admin.storage.from("uploads").list(userId, { limit: 1000 });
  for (const entry of folders ?? []) {
    const { data: inner } = await admin.storage.from("uploads").list(`${userId}/${entry.name}`, { limit: 1000 });
    if (inner?.length) {
      for (const item of inner) paths.push(`${userId}/${entry.name}/${item.name}`);
    } else {
      paths.push(`${userId}/${entry.name}`);
    }
  }

  const unique = [...new Set(paths)];
  for (let i = 0; i < unique.length; i += 100) {
    const { error } = await admin.storage.from("uploads").remove(unique.slice(i, i + 100));
    if (error) logger.warn("account.storage_remove_failed", { code: error.name });
  }
  await admin.storage.from("avatars").remove([`${userId}/avatar`]);
}

/**
 * Exclusão definitiva: arquivos primeiro, depois o usuário de autenticação.
 * As tabelas do app têm ON DELETE CASCADE a partir de profiles → auth.users.
 */
export async function deleteAccountCompletely(userId: string): Promise<{ ok: boolean }> {
  try {
    await deleteUserStorage(userId);
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      logger.error("account.delete_failed", { code: error.code ?? "unknown" });
      return { ok: false };
    }
    logger.info("account.deleted");
    return { ok: true };
  } catch (error) {
    logger.error("account.delete_exception", { name: error instanceof Error ? error.name : "unknown" });
    return { ok: false };
  }
}
