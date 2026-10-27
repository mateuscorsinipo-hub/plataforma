import { aiAvailability } from "@/lib/ai";
import { loadLearnerContext } from "@/lib/ai/learner";
import type { GenerateStreamEvent } from "@/lib/ai/studio/events";
import { runGeneration } from "@/lib/ai/studio/generate";
import { kindByName, maxCountFor } from "@/lib/ai/studio/kinds";
import { aiErrorMessages } from "@/lib/ai/types";
import { checkSameOrigin, jsonError, readJson, requireApiStudent } from "@/lib/api/guard";
import { getPlanForUser, getUserTimezone } from "@/lib/billing/entitlements";
import { getReadyFiles } from "@/lib/data/files";
import { logger } from "@/lib/logger";
import { checkRateLimit, rateLimits } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateRequestSchema } from "@/lib/validation/ai";

export const maxDuration = 300;

export async function POST(request: Request) {
  const blocked = checkSameOrigin(request);
  if (blocked) return blocked;
  const auth = await requireApiStudent();
  if (!auth.ok) return auth.response;
  const { user, profile } = auth.ctx;

  const availability = aiAvailability();
  if (!availability.available) return jsonError(503, aiErrorMessages.not_configured, { code: "not_configured" });
  if (!(await checkRateLimit(`generate:${user.id}`, rateLimits.aiGeneration))) {
    return jsonError(429, "Muitas gerações em pouco tempo. Aguarde um minuto.");
  }

  let body: unknown;
  try {
    body = await readJson(request, 16 * 1024);
  } catch {
    return jsonError(400, "Requisição inválida.");
  }
  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const input = parsed.data;

  const [plan, timezone, learner] = await Promise.all([getPlanForUser(user.id), getUserTimezone(user.id), loadLearnerContext(profile)]);
  const uniqueIds = [...new Set(input.fileIds)];
  if (uniqueIds.length > plan.maxSourcesPerSession) {
    return jsonError(400, `O plano ${plan.name} permite até ${plan.maxSourcesPerSession} arquivos por geração.`);
  }
  const files = await getReadyFiles(uniqueIds);
  if (files.length !== uniqueIds.length) {
    return jsonError(404, "Algum arquivo escolhido não está disponível ou ainda está sendo processado.");
  }

  const supabase = await createSupabaseServerClient();
  if (input.folderId) {
    const { data } = await supabase.from("folders").select("id").eq("id", input.folderId).maybeSingle();
    if (!data) return jsonError(404, "Pasta não encontrada.");
  }
  if (input.subjectId) {
    const { data } = await supabase.from("subjects").select("id").eq("id", input.subjectId).maybeSingle();
    if (!data) return jsonError(404, "Matéria não encontrada.");
  }

  const definition = kindByName[input.kind];
  const max = maxCountFor(input.kind, plan);
  const count = definition.count ? Math.min(max, Math.max(definition.count.min, input.count ?? definition.count.default)) : 0;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: GenerateStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // O navegador fechou a conexão; a geração já foi interrompida pelo sinal.
        }
      };
      try {
        const result = await runGeneration({
          userId: user.id,
          plan,
          timezone,
          learner,
          kind: input.kind,
          files,
          options: {
            difficulty: input.difficulty,
            length: input.length,
            count,
            focus: input.focus || null,
            examStyle: input.examStyle,
            allowOpen: input.kind === "mock_exam" ? input.examStyle === "school" && input.allowOpen : input.allowOpen,
          },
          title: input.title || null,
          folderId: input.folderId ?? null,
          subjectId: input.subjectId ?? null,
          signal: request.signal,
          onStage: (stage) => send({ type: "stage", ...stage }),
        });
        send(result.ok ? { type: "done", id: result.id } : { type: "error", message: result.message, code: result.code, id: result.id });
      } catch (error) {
        logger.error("studio.route_exception", { name: error instanceof Error ? error.name : "unknown" });
        send({ type: "error", message: "A geração falhou. Tente novamente.", code: "unexpected" });
      } finally {
        try {
          controller.close();
        } catch {
          // já fechado
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
