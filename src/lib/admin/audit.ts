import "server-only";

import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Registro de auditoria de toda ação administrativa (quem, o quê, em quem e por quê).
 * Só o servidor escreve e lê (a tabela não tem política para o cliente).
 */
export async function audit(params: {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, Json | undefined>;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const details = Object.fromEntries(Object.entries(params.details ?? {}).filter(([, v]) => v !== undefined)) as Record<string, Json>;
  const { error } = await admin.from("admin_audit_logs").insert({
    actor_id: params.actorId,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId ?? null,
    details,
  });
  if (error) logger.error("admin.audit_failed", { action: params.action, code: error.code });
}

/** Aviso dentro do app para quem foi afetado por uma decisão da moderação. */
export async function notifyUser(userId: string, notification: { type: string; title: string; body?: string; link?: string }): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    type: notification.type,
    title: notification.title.slice(0, 120),
    body: notification.body?.slice(0, 500) ?? null,
    link: notification.link ?? null,
  });
  if (error) logger.warn("admin.notify_failed", { code: error.code });
}
