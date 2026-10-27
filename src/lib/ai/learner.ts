import "server-only";

import type { LearnerContext } from "@/lib/ai/prompts/shared";
import type { ProfileRow } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ageOn } from "@/lib/validation/auth";

export async function loadLearnerContext(profile: ProfileRow): Promise<LearnerContext> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("user_preferences").select("explanation_level").eq("user_id", profile.id).maybeSingle();
  const level = data?.explanation_level;
  return {
    firstName: (profile.display_name || profile.username).split(" ")[0] ?? "Estudante",
    schoolStage: profile.school_stage,
    gradeYear: profile.grade_year,
    explanationLevel: level === "simple" || level === "deep" ? level : "balanced",
    isMinor: profile.birth_date ? ageOn(profile.birth_date) < 18 : false,
  };
}
