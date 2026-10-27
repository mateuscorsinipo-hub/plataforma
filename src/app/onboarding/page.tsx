import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/feedback";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { OnboardingWizard } from "./onboarding-wizard";

export const metadata: Metadata = { title: "Primeiros passos", robots: { index: false } };

export default function OnboardingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4 sm:px-6">
          <Link href="/" className="rounded-lg" aria-label="Grifo, página inicial">
            <Logo size={28} />
          </Link>
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Suspense fallback={<Skeleton className="h-[540px] rounded-3xl" />}>
          <OnboardingLoader />
        </Suspense>
      </main>
    </div>
  );
}

async function OnboardingLoader() {
  const user = await requireUser("/onboarding");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/entrar?erro=perfil");
  if (profile.account_status === "pending_guardian") redirect("/responsavel/pendente");
  if (profile.account_status === "suspended") redirect("/conta-suspensa");
  if (profile.onboarding_completed_at) redirect("/app");

  const supabase = await createSupabaseServerClient();
  const [{ data: subjects }, { data: prefs }, { data: mySubjects }] = await Promise.all([
    supabase.from("subjects").select("id, name, color, icon, kind").eq("is_active", true).order("sort_order"),
    supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_subjects").select("subject_id").eq("user_id", user.id),
  ]);

  return (
    <OnboardingWizard
      subjects={subjects ?? []}
      defaults={{
        displayName: profile.display_name,
        hasBirthDate: Boolean(profile.birth_date),
        hasAcceptedTerms: Boolean(profile.terms_accepted_at),
        schoolStage: profile.school_stage,
        gradeYear: profile.grade_year,
        subjectIds: (mySubjects ?? []).map((row) => row.subject_id),
        goals: prefs?.goals ?? [],
        difficulties: prefs?.difficulties ?? [],
        dailyGoalMinutes: prefs?.daily_goal_minutes ?? 30,
        studyWeekdays: prefs?.study_weekdays ?? [1, 2, 3, 4, 5],
        preferredPeriod: prefs?.preferred_period ?? null,
      }}
    />
  );
}
