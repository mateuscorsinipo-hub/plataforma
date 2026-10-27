import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { GuardianInviteForm } from "@/app/responsavel/pendente/invite-form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { getSubjects } from "@/lib/data/subjects";
import { isEmailConfigured } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ageOn } from "@/lib/validation/auth";

import { AvatarUploader } from "./avatar-uploader";
import {
  DeleteAccountForm,
  EmailForm,
  ExportDataButton,
  PasswordForm,
  PreferencesForm,
  PrivacyForm,
  ProfileForm,
  SubjectsForm,
} from "./settings-forms";

export const metadata: Metadata = { title: "Configurações" };

const sections = [
  { id: "perfil", label: "Perfil" },
  { id: "materias", label: "Matérias" },
  { id: "preferencias", label: "Preferências" },
  { id: "privacidade", label: "Privacidade" },
  { id: "conta", label: "Conta e dados" },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configurações" description="Perfil, preferências de estudo, privacidade e dados da sua conta." />
      <nav aria-label="Seções" className="flex gap-2 overflow-x-auto pb-1">
        {sections.map((section) => (
          <Link
            key={section.id}
            href={`#${section.id}`}
            className="shrink-0 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-semibold text-ink-2 hover:text-foreground"
          >
            {section.label}
          </Link>
        ))}
      </nav>
      <Suspense fallback={<Skeleton className="h-[900px]" />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

async function SettingsContent() {
  const { user, profile } = await requireStudent("/app/configuracoes");
  const supabase = await createSupabaseServerClient();
  const [subjects, { data: prefs }, { data: mySubjects }, { data: consent }, { data: authUser }] = await Promise.all([
    getSubjects(),
    supabase.from("user_preferences").select("*").eq("user_id", user.id).single(),
    supabase.from("user_subjects").select("subject_id").eq("user_id", user.id),
    supabase.from("guardian_consents").select("status").eq("user_id", user.id).eq("status", "granted").limit(1).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const age = profile.birth_date ? ageOn(profile.birth_date) : null;
  const restricted = (age === null || age < 16) && !consent;
  const usesPassword = (authUser.user?.identities ?? []).some((identity) => identity.provider === "email");

  return (
    <div className="flex flex-col gap-6">
      <Card id="perfil" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Como você aparece no Grifo.</CardDescription>
        </CardHeader>
        <AvatarUploader userId={user.id} displayName={profile.display_name || profile.username} avatarUrl={profile.avatar_url} />
        <ProfileForm
          defaults={{
            displayName: profile.display_name,
            username: profile.username,
            bio: profile.bio,
            schoolStage: profile.school_stage,
            gradeYear: profile.grade_year,
          }}
        />
      </Card>

      <Card id="materias" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Matérias de interesse</CardTitle>
          <CardDescription>Usadas no painel, nas recomendações e no plano de estudos.</CardDescription>
        </CardHeader>
        <SubjectsForm subjects={subjects} selected={(mySubjects ?? []).map((row) => row.subject_id)} />
      </Card>

      <Card id="preferencias" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Preferências de estudo</CardTitle>
          <CardDescription>Meta diária, rotina e como o tutor explica.</CardDescription>
        </CardHeader>
        <PreferencesForm
          defaults={{
            dailyGoalMinutes: prefs?.daily_goal_minutes ?? 30,
            studyWeekdays: prefs?.study_weekdays ?? [1, 2, 3, 4, 5],
            preferredPeriod: prefs?.preferred_period ?? null,
            goals: prefs?.goals ?? [],
            difficulties: prefs?.difficulties ?? [],
            explanationLevel: prefs?.explanation_level ?? "balanced",
            timezone: prefs?.timezone ?? "America/Sao_Paulo",
            emailReminders: prefs?.email_reminders ?? false,
            emailAvailable: isEmailConfigured(),
          }}
        />
      </Card>

      <Card id="privacidade" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Privacidade</CardTitle>
          <CardDescription>Seu e-mail e sua data de nascimento nunca aparecem para outras pessoas.</CardDescription>
        </CardHeader>
        <PrivacyForm
          restricted={restricted}
          defaults={{
            profileVisibility: profile.profile_visibility,
            showInLeaderboard: profile.show_in_leaderboard,
            showStatsPublicly: profile.show_stats_publicly,
            showAchievementsPublicly: profile.show_achievements_publicly,
          }}
        />
        {restricted && age !== null && age >= 12 ? (
          <div className="rounded-2xl bg-background p-4">
            <p className="mb-3 text-sm leading-relaxed text-ink-2">
              Quer publicar materiais na biblioteca ou ter perfil público? Peça a autorização de um responsável.
            </p>
            <GuardianInviteForm hasPending={false} />
          </div>
        ) : null}
      </Card>

      <Card id="conta" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Conta e dados</CardTitle>
          <CardDescription>Acesso, exportação (portabilidade) e exclusão, conforme a LGPD.</CardDescription>
        </CardHeader>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h3 className="font-bold">E-mail</h3>
            <EmailForm currentEmail={user.email} />
          </div>
          {usesPassword ? (
            <div className="flex flex-col gap-3">
              <h3 className="font-bold">Senha</h3>
              <PasswordForm />
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-5">
          <h3 className="font-bold">Exportar dados</h3>
          <p className="text-sm text-ink-2">Baixe um arquivo com tudo o que está associado à sua conta.</p>
          <ExportDataButton />
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-5">
          <h3 className="font-bold text-destructive-text">Excluir conta</h3>
          <DeleteAccountForm usesPassword={usesPassword} />
        </div>
      </Card>
    </div>
  );
}
