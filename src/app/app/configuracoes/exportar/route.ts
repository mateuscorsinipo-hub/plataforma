import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Tabelas exportadas (direito de acesso e portabilidade, LGPD art. 18). Lidas com o RLS do usuário. */
const tables = [
  "profiles",
  "user_preferences",
  "user_subjects",
  "guardian_consents",
  "folders",
  "uploaded_files",
  "study_materials",
  "material_saves",
  "material_ratings",
  "material_reports",
  "ai_conversations",
  "ai_messages",
  "ai_generations",
  "flashcard_decks",
  "flashcards",
  "flashcard_reviews",
  "quizzes",
  "quiz_questions",
  "quiz_attempts",
  "quiz_answers",
  "study_plans",
  "study_plan_tasks",
  "study_sessions",
  "calendar_events",
  "user_stats",
  "xp_transactions",
  "user_achievements",
  "notifications",
  "subscriptions",
  "usage_records",
] as const;

const ownerColumn: Partial<Record<(typeof tables)[number], string>> = {
  profiles: "id",
  study_materials: "author_id",
  material_reports: "reporter_id",
};

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await checkRateLimit(`export:${user.id}`, { limit: 5, windowSeconds: 3600 }))) {
    return NextResponse.json({ error: "Muitas exportações seguidas. Tente novamente em uma hora." }, { status: 429 });
  }

  const supabase = await createSupabaseServerClient();
  const result: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email },
  };
  for (const table of tables) {
    const column = ownerColumn[table] ?? "user_id";
    const rows: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq(column, user.id)
        .range(from, from + 999);
      if (error || !data) break;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    result[table] = table === "guardian_consents"
      ? rows.map((row) => ({ ...(row as Record<string, unknown>), token_hash: undefined }))
      : rows;
  }

  return new NextResponse(JSON.stringify(result, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="grifo-dados-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
