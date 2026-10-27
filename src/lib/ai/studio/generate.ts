import "server-only";

import { getAIProvider } from "@/lib/ai";
import type { GenerationStage } from "@/lib/ai/studio/events";
import { aiTasks, contextBudget, type AITaskName } from "@/lib/ai/config";
import { condensePrompt, condenseSystemPrompt, studioPrompt, studioSystemPrompt, type StudioOptions } from "@/lib/ai/prompts/studio";
import type { LearnerContext } from "@/lib/ai/prompts/shared";
import { loadFullText } from "@/lib/ai/sources";
import { contentToMarkdown } from "@/lib/ai/studio/markdown";
import { EmptyGenerationError, normalizeOutput } from "@/lib/ai/studio/normalize";
import { outputSchemas } from "@/lib/ai/studio/schemas";
import type { GenerationKind } from "@/lib/ai/studio/kinds";
import { AIError, addUsage, aiErrorMessages, emptyUsage, type Usage } from "@/lib/ai/types";
import { annotateUsage, consumeFeature, refundUsage } from "@/lib/billing/entitlements";
import type { PlanDefinition } from "@/lib/config/plans";
import type { FileSummary } from "@/lib/documents/summary";
import { logger } from "@/lib/logger";
import type { Json } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type GenerationResult =
  | { ok: true; id: string }
  | { ok: false; status: number; code: string; message: string; id?: string };

const taskForKind: Record<GenerationKind, AITaskName> = {
  summary_quick: "summaryQuick",
  summary_detailed: "summaryDetailed",
  study_guide: "studyGuide",
  key_concepts: "keyConcepts",
  glossary: "glossary",
  flashcards: "flashcards",
  quiz: "quiz",
  mock_exam: "mockExam",
  essay_questions: "essayQuestions",
  explanation: "explanation",
};

/** Agrupa partes em blocos de até `size` caracteres. */
export function groupParts(parts: string[], size: number, maxGroups: number): string[] {
  const groups: string[] = [];
  let current = "";
  for (const part of parts) {
    if (current && current.length + part.length + 2 > size) {
      groups.push(current);
      current = part;
    } else {
      current = current ? `${current}\n\n${part}` : part;
    }
  }
  if (current) groups.push(current);
  if (groups.length <= maxGroups) return groups;
  // Material maior que o previsto: junta grupos vizinhos para caber no limite.
  const factor = Math.ceil(groups.length / maxGroups);
  const merged: string[] = [];
  for (let i = 0; i < groups.length; i += factor) merged.push(groups.slice(i, i + factor).join("\n\n"));
  return merged;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Gera um material do estúdio. Ordem: valida fontes → reserva consumo → cria o
 * registro → (condensa material extenso em partes) → gera saída estruturada →
 * confere o conteúdo → salva. Qualquer falha devolve o crédito ao estudante.
 */
export async function runGeneration(params: {
  userId: string;
  plan: PlanDefinition;
  timezone: string;
  learner: LearnerContext;
  kind: GenerationKind;
  files: FileSummary[];
  options: StudioOptions;
  title: string | null;
  folderId: string | null;
  subjectId: string | null;
  signal: AbortSignal;
  onStage: (stage: GenerationStage) => void;
}): Promise<GenerationResult> {
  const supabase = await createSupabaseServerClient();
  const provider = getAIProvider();

  params.onStage({ stage: "reading" });
  const source = await loadFullText(params.files, params.plan.maxSourceCharsPerGeneration);
  if (source.chars < 200) {
    return { ok: false, status: 422, code: "too_little_text", message: "O material selecionado tem pouco texto para gerar este conteúdo." };
  }

  const consumption = await consumeFeature({
    userId: params.userId,
    plan: params.plan,
    feature: "ai_generation",
    timezone: params.timezone,
    metadata: { kind: params.kind },
  });
  if (!consumption.ok) {
    return {
      ok: false,
      status: 429,
      code: "limit_reached",
      message: `Você usou as ${consumption.limit} gerações do estúdio disponíveis ${consumption.window === "day" ? "hoje" : "neste mês"}.`,
    };
  }

  const { data: row, error: insertError } = await supabase
    .from("ai_generations")
    .insert({
      user_id: params.userId,
      kind: params.kind,
      title: (params.title || "Gerando…").slice(0, 160),
      folder_id: params.folderId,
      subject_id: params.subjectId,
      params: { ...params.options, truncated: source.truncated } as unknown as { [key: string]: Json },
      source_chars: source.chars,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError || !row) {
    await refundUsage(consumption.recordId);
    logger.error("studio.insert_failed", { code: insertError?.code ?? "unknown" });
    return { ok: false, status: 500, code: "db_error", message: "Não foi possível iniciar a geração. Tente novamente." };
  }
  const generationId = row.id;
  if (params.files.length) {
    await supabase
      .from("ai_generation_sources")
      .insert(params.files.map((file) => ({ generation_id: generationId, file_id: file.id, user_id: params.userId })));
  }

  let usage: Usage = emptyUsage;
  let model = "";
  try {
    let material = source.text;
    let condensed = false;
    if (source.chars > contextBudget.directGenerationChars) {
      const groups = groupParts(source.parts, contextBudget.condenseGroupChars, contextBudget.maxCondenseGroups);
      let done = 0;
      params.onStage({ stage: "condensing", done, total: groups.length });
      const notes = await mapWithConcurrency(groups, 4, async (group, index) => {
        const result = await provider.generateText({
          ...aiTasks.condenseNotes,
          system: condenseSystemPrompt(params.kind),
          prompt: condensePrompt(group, index, groups.length),
          signal: params.signal,
        });
        usage = addUsage(usage, result.usage);
        done += 1;
        params.onStage({ stage: "condensing", done, total: groups.length });
        return result.text.trim();
      });
      material = notes.map((note, index) => `### Parte ${index + 1}\n\n${note}`).join("\n\n");
      condensed = true;
    }

    params.onStage({ stage: "generating" });
    const task = aiTasks[taskForKind[params.kind]];
    const result = await provider.generateObject({
      effort: task.effort,
      maxTokens: task.maxTokens,
      system: studioSystemPrompt(params.learner),
      prompt: studioPrompt({ kind: params.kind, options: params.options, material, condensed, truncated: source.truncated }),
      schema: outputSchemas[params.kind] as never,
      schemaName: params.kind,
      signal: params.signal,
    });
    usage = addUsage(usage, result.usage);
    model = result.model;

    params.onStage({ stage: "saving" });
    const content = normalizeOutput(params.kind, result.data, {
      count: params.options.count,
      title: params.title ?? "",
      allowOpen: params.options.allowOpen,
    });
    const markdown = contentToMarkdown(content);
    const { error: updateError } = await supabase
      .from("ai_generations")
      .update({
        title: content.title,
        content: content as unknown as Json,
        content_markdown: markdown,
        status: "completed",
        model,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        error_message: null,
      })
      .eq("id", generationId);
    if (updateError) throw new Error(`update_failed:${updateError.code}`);

    await annotateUsage(consumption.recordId, {
      generation_id: generationId,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      model,
    });
    logger.info("studio.generated", { kind: params.kind, condensed, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens });
    return { ok: true, id: generationId };
  } catch (error) {
    await refundUsage(consumption.recordId);
    const aiError = error instanceof AIError ? error : null;
    const message =
      error instanceof EmptyGenerationError
        ? aiErrorMessages.invalid_output
        : aiError
          ? aiErrorMessages[aiError.code]
          : "A geração falhou. Tente novamente.";
    if (!aiError || aiError.code !== "cancelled") {
      logger.error("studio.generation_failed", { kind: params.kind, code: aiError?.code ?? (error instanceof Error ? error.name : "unknown") });
    }
    await supabase
      .from("ai_generations")
      .update({
        status: "failed",
        title: params.title || "Geração com falha",
        error_message: message,
        model: model || null,
        input_tokens: usage.inputTokens || null,
        output_tokens: usage.outputTokens || null,
      })
      .eq("id", generationId);
    const status = aiError?.code === "rate_limited" ? 429 : aiError?.code === "not_configured" ? 503 : 502;
    return { ok: false, status, code: aiError?.code ?? "generation_failed", message, id: generationId };
  }
}
