import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getActivePlan() {
  const supabase = await createSupabaseServerClient();
  const { data: plan } = await supabase
    .from("study_plans")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!plan) return null;
  const { data: tasks } = await supabase
    .from("study_plan_tasks")
    .select("id, scheduled_date, task_type, subject_id, topic, title, description, estimated_minutes, priority, status, original_date, position, completed_at")
    .eq("plan_id", plan.id)
    .order("scheduled_date")
    .order("position")
    .limit(2000);
  return { plan, tasks: tasks ?? [] };
}

export async function listOtherPlans(excludeId?: string) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("study_plans").select("id, title, status, exam_date, created_at").order("created_at", { ascending: false }).limit(20);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;
  return data ?? [];
}

export async function getFocusTimer() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("focus_timers").select("started_at, subject_id, task_id").maybeSingle();
  return data;
}
