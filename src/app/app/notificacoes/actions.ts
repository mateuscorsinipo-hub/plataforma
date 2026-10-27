"use server";

import { refresh } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";

export async function markNotificationRead(formData: FormData): Promise<void> {
  const user = await requireUser("/app/notificacoes");
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id.data).eq("user_id", user.id);
  refresh();
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireUser("/app/notificacoes");
  const supabase = await createSupabaseServerClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  refresh();
}
