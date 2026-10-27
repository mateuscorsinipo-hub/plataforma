"use server";

import { redirect } from "next/navigation";

import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { zonedTimeToUtc } from "@/lib/domain/dates";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type ActionState, fieldErrorsOf } from "@/lib/validation/common";
import { onboardingSchema, readOnboardingForm } from "@/lib/validation/onboarding";

export async function completeOnboarding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/onboarding");
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Perfil não encontrado. Entre novamente." };

  const schema = onboardingSchema({
    needsBirthDate: !profile.birth_date,
    needsTerms: !profile.terms_accepted_at,
  });
  const parsed = schema.safeParse(readOnboardingForm(formData));
  if (!parsed.success) {
    return { error: "Revise as informações destacadas.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const input = parsed.data;
  const supabase = await createSupabaseServerClient();

  const referencedSubjects = [
    ...new Set([...input.subjectIds, ...input.exams.map((exam) => exam.subjectId).filter((id): id is string => Boolean(id))]),
  ];
  const { data: subjectRows } = referencedSubjects.length
    ? await supabase.from("subjects").select("id").in("id", referencedSubjects)
    : { data: [] as { id: string }[] };
  const validSubjects = new Set((subjectRows ?? []).map((row) => row.id));

  const profileUpdate: Database["public"]["Tables"]["profiles"]["Update"] = {
    display_name: input.displayName,
    school_stage: input.schoolStage,
    grade_year: input.gradeYear,
    onboarding_completed_at: new Date().toISOString(),
  };
  if (!profile.birth_date && input.birthDate) profileUpdate.birth_date = input.birthDate;
  if (!profile.terms_accepted_at) {
    profileUpdate.terms_accepted_at = new Date().toISOString();
    profileUpdate.privacy_accepted_at = new Date().toISOString();
  }

  const { error: profileError } = await supabase.from("profiles").update(profileUpdate).eq("id", user.id);
  if (profileError) {
    logger.error("onboarding.profile_failed", { code: profileError.code });
    return { error: profileError.code === "P0001" ? profileError.message : "Não foi possível salvar seu perfil." };
  }

  const { error: prefsError } = await supabase
    .from("user_preferences")
    .update({
      timezone: input.timezone,
      daily_goal_minutes: input.dailyGoalMinutes,
      study_weekdays: input.studyWeekdays,
      preferred_period: input.preferredPeriod,
      goals: input.goals,
      difficulties: input.difficulties,
    })
    .eq("user_id", user.id);
  if (prefsError) {
    logger.error("onboarding.prefs_failed", { code: prefsError.code });
    return { error: "Não foi possível salvar suas preferências." };
  }

  await supabase.from("user_subjects").delete().eq("user_id", user.id);
  const subjects = input.subjectIds.filter((id) => validSubjects.has(id));
  if (subjects.length) {
    await supabase.from("user_subjects").insert(subjects.map((subject_id) => ({ user_id: user.id, subject_id })));
  }

  if (input.exams.length) {
    const events = input.exams.map((exam) => ({
      user_id: user.id,
      title: exam.title,
      event_type: "exam",
      subject_id: exam.subjectId && validSubjects.has(exam.subjectId) ? exam.subjectId : null,
      starts_at: zonedTimeToUtc(exam.date, "00:00", input.timezone).toISOString(),
      ends_at: zonedTimeToUtc(exam.date, "23:59", input.timezone).toISOString(),
      all_day: true,
      timezone: input.timezone,
      reminder_minutes: 1440,
    }));
    const { error: eventsError } = await supabase.from("calendar_events").insert(events);
    if (eventsError) {
      logger.warn("onboarding.exams_failed", { code: eventsError.code });
    }
  }

  // Data de nascimento abaixo do limite deixa a conta pendente de responsável (regra no banco).
  const { data: refreshed } = await supabase.from("profiles").select("account_status").eq("id", user.id).single();
  if (refreshed?.account_status === "pending_guardian") {
    redirect("/responsavel/pendente");
  }
  redirect("/app?bem-vindo=1");
}
