"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { deleteAccountCompletely } from "@/lib/data/account-deletion";
import { publicEnv } from "@/lib/env/public";
import { isServiceRoleConfigured } from "@/lib/env/server";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type ActionState, fieldErrorsOf, formDataToObject, toArray } from "@/lib/validation/common";
import {
  deleteAccountSchema,
  emailChangeSchema,
  passwordChangeSchema,
  preferencesSchema,
  privacySchema,
  profileSchema,
  readPreferencesForm,
  readProfileForm,
} from "@/lib/validation/settings";

const saved: ActionState = { ok: true, message: "Alterações salvas." };

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/app/configuracoes");
  const parsed = profileSchema.safeParse(readProfileForm(formData));
  if (!parsed.success) return { error: "Revise os campos destacados.", fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      username: parsed.data.username,
      bio: parsed.data.bio,
      school_stage: parsed.data.schoolStage,
      grade_year: parsed.data.schoolStage ? parsed.data.gradeYear : null,
    })
    .eq("id", user.id);
  if (error) {
    if (error.code === "23505") return { error: "Esse nome de usuário já está em uso.", fieldErrors: { username: ["Escolha outro nome de usuário."] } };
    if (error.code === "P0001") return { error: error.message, fieldErrors: { username: [error.message] } };
    if (error.code === "23514") return { error: "Nome de usuário inválido.", fieldErrors: { username: ["Formato inválido."] } };
    logger.error("settings.profile_failed", { code: error.code });
    return { error: "Não foi possível salvar o perfil." };
  }
  refresh();
  return saved;
}

export async function saveAvatar(): Promise<ActionState> {
  const user = await requireUser("/app/configuracoes");
  const supabase = await createSupabaseServerClient();
  const { data: objects } = await supabase.storage.from("avatars").list(user.id, { search: "avatar" });
  if (!objects?.some((object) => object.name === "avatar")) {
    return { error: "Envie a imagem antes de salvar." };
  }
  const { data } = supabase.storage.from("avatars").getPublicUrl(`${user.id}/avatar`);
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: `${data.publicUrl}?v=${Date.now()}` })
    .eq("id", user.id);
  if (error) return { error: "Não foi possível salvar a foto." };
  refresh();
  return { ok: true, message: "Foto atualizada." };
}

export async function removeAvatar(): Promise<ActionState> {
  const user = await requireUser("/app/configuracoes");
  const supabase = await createSupabaseServerClient();
  await supabase.storage.from("avatars").remove([`${user.id}/avatar`]);
  await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  refresh();
  return { ok: true, message: "Foto removida." };
}

export async function updateSubjects(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/app/configuracoes");
  const ids = toArray(formData.getAll("subjectIds")).slice(0, 20);
  const supabase = await createSupabaseServerClient();
  const { data: valid } = ids.length ? await supabase.from("subjects").select("id").in("id", ids) : { data: [] };
  const { error: deleteError } = await supabase.from("user_subjects").delete().eq("user_id", user.id);
  if (deleteError) return { error: "Não foi possível salvar as matérias." };
  if (valid?.length) {
    const { error } = await supabase.from("user_subjects").insert(valid.map((s) => ({ user_id: user.id, subject_id: s.id })));
    if (error) return { error: "Não foi possível salvar as matérias." };
  }
  refresh();
  return saved;
}

export async function updatePreferences(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/app/configuracoes");
  const parsed = preferencesSchema.safeParse(readPreferencesForm(formData));
  if (!parsed.success) return { error: "Revise os campos destacados.", fieldErrors: fieldErrorsOf(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("user_preferences")
    .update({
      daily_goal_minutes: parsed.data.dailyGoalMinutes,
      study_weekdays: [...new Set(parsed.data.studyWeekdays)].sort(),
      preferred_period: parsed.data.preferredPeriod,
      goals: parsed.data.goals,
      difficulties: parsed.data.difficulties,
      explanation_level: parsed.data.explanationLevel,
      timezone: parsed.data.timezone,
      email_reminders: parsed.data.emailReminders,
    })
    .eq("user_id", user.id);
  if (error) {
    logger.error("settings.preferences_failed", { code: error.code });
    return { error: "Não foi possível salvar as preferências." };
  }
  refresh();
  return saved;
}

export async function updatePrivacy(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/app/configuracoes");
  const parsed = privacySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: "Revise as opções." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      profile_visibility: parsed.data.profileVisibility,
      show_in_leaderboard: parsed.data.showInLeaderboard,
      show_stats_publicly: parsed.data.showStatsPublicly,
      show_achievements_publicly: parsed.data.showAchievementsPublicly,
    })
    .eq("id", user.id)
    .select("profile_visibility")
    .single();
  if (error) return { error: "Não foi possível salvar a privacidade." };
  refresh();
  if (parsed.data.profileVisibility === "public" && data.profile_visibility !== "public") {
    return {
      ok: true,
      message: "Salvo. Seu perfil continua privado: para menores de 16 anos, o perfil público exige autorização do responsável.",
    };
  }
  return saved;
}

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/app/configuracoes");
  const parsed = passwordChangeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: "Revise os campos destacados.", fieldErrors: fieldErrorsOf(parsed.error) };
  if (!user.email) return { error: "Sua conta não usa senha (login social)." };

  const supabase = await createSupabaseServerClient();
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.currentPassword });
  if (verifyError) return { error: "Senha atual incorreta.", fieldErrors: { currentPassword: ["Senha atual incorreta."] } };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) {
    if (error.code === "same_password") return { fieldErrors: { newPassword: ["Escolha uma senha diferente da atual."] }, error: "Revise os campos." };
    return { error: "Não foi possível trocar a senha." };
  }
  return { ok: true, message: "Senha alterada." };
}

export async function changeEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("/app/configuracoes");
  const parsed = emailChangeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: "Informe um e-mail válido.", fieldErrors: fieldErrorsOf(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=/app/configuracoes` },
  );
  if (error) {
    if (error.code === "email_exists") return { error: "Esse e-mail já está em uso por outra conta." };
    return { error: "Não foi possível pedir a troca de e-mail." };
  }
  return { ok: true, message: "Enviamos links de confirmação para o e-mail atual e para o novo. A troca vale depois das duas confirmações." };
}

export async function deleteAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/app/configuracoes");
  const parsed = deleteAccountSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: "Confirme a exclusão.", fieldErrors: fieldErrorsOf(parsed.error) };
  if (!isServiceRoleConfigured()) return { error: "A exclusão de contas não está configurada neste ambiente." };

  const supabase = await createSupabaseServerClient();
  const identities = (await supabase.auth.getUser()).data.user?.identities ?? [];
  const usesPassword = identities.some((identity) => identity.provider === "email");
  if (usesPassword) {
    if (!parsed.data.password || !user.email) return { fieldErrors: { password: ["Informe sua senha."] }, error: "Confirme com sua senha." };
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.password });
    if (error) return { fieldErrors: { password: ["Senha incorreta."] }, error: "Senha incorreta." };
  }

  const profile = await getCurrentProfile();
  const result = await deleteAccountCompletely(user.id);
  if (!result.ok) return { error: "Não foi possível excluir a conta agora. Tente novamente ou fale com o suporte." };
  logger.info("account.self_deleted", { hadProfile: Boolean(profile) });
  await supabase.auth.signOut({ scope: "local" });
  redirect("/?conta-excluida=1");
}
