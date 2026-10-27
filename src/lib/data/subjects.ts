import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { isSupabaseConfigured } from "@/lib/env/public";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export type Subject = Pick<
  Database["public"]["Tables"]["subjects"]["Row"],
  "id" | "slug" | "name" | "color" | "icon" | "kind" | "sort_order"
>;

/**
 * Disciplinas ativas. Dados públicos e estáveis: ficam em cache no servidor e
 * são invalidados pela tag "subjects" quando a administração edita a lista.
 */
export async function getSubjects(): Promise<Subject[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("subjects");
  if (!isSupabaseConfigured()) return [];
  const { data } = await createSupabasePublicClient()
    .from("subjects")
    .select("id, slug, name, color, icon, kind, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}

export async function getSubjectMap(): Promise<Map<string, Subject>> {
  const subjects = await getSubjects();
  return new Map(subjects.map((subject) => [subject.id, subject]));
}
