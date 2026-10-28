-- Revisão de segurança (Fase 8). Nada aqui libera acesso: só fecha privilégios que
-- sobravam. O teste tests/db/security-audit.test.ts verifica estas regras em todo o esquema.

-- 1. TRUNCATE ignora a RLS. Nenhum papel de cliente precisa dele (a API nem o expõe),
--    então sai de tudo que existe e do que for criado depois.
revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate on tables from authenticated;

-- 2. Tabelas que só o servidor altera (com a chave de serviço ou funções privilegiadas).
--    A RLS já bloqueia, porque não há política de escrita para clientes; sem o privilégio,
--    uma política criada por engano no futuro também não basta para abrir a escrita.
--    app_settings foi criada antes da revogação padrão e ainda tinha escrita para anon.
revoke insert, update, delete on
  public.achievements,
  public.admin_audit_logs,
  public.app_settings,
  public.billing_customers,
  public.billing_events,
  public.contact_messages,
  public.guardian_consents,
  public.leaderboard_entries,
  public.league_rollovers,
  public.material_views,
  public.rate_limits,
  public.reminder_deliveries,
  public.subjects,
  public.user_roles
from anon, authenticated;

-- 3. Preferências: a pessoa altera só os campos do formulário, não a chave nem as datas
--    (updated_at continua sendo preenchido pelo gatilho).
revoke update on public.user_preferences from authenticated;
grant update (timezone, daily_goal_minutes, study_weekdays, preferred_period, goals, difficulties, explanation_level, email_reminders)
  on public.user_preferences to authenticated;

-- 4. can_answer_attempt só aparece em políticas de quem está logado.
revoke execute on function public.can_answer_attempt(uuid, uuid) from public, anon;
grant execute on function public.can_answer_attempt(uuid, uuid) to authenticated;
