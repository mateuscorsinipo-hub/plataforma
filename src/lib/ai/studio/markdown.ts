import type { GenerationContent, NormalizedQuestion } from "@/lib/ai/studio/content";
import { difficultyLabels } from "@/lib/ai/studio/kinds";

/**
 * Converte o conteúdo estruturado em Markdown: é o texto exibido, editado e exportado.
 * Para quizzes e flashcards, o gabarito vai no final (para não "entregar" a resposta).
 */
function list(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function questionBlock(question: NormalizedQuestion, index: number): string {
  const lines = [`### ${index + 1}. ${question.prompt}`];
  if (question.type === "multiple_choice") {
    lines.push("", ...question.options.map((option) => `${option.id.toUpperCase()}) ${option.text}`));
  } else if (question.type === "true_false") {
    lines.push("", "( ) Verdadeiro   ( ) Falso");
  } else {
    lines.push("", "_Resposta dissertativa._");
  }
  lines.push("", `_${difficultyLabels[question.difficulty]} · ${question.topic}_`);
  return lines.join("\n");
}

function answerKey(questions: NormalizedQuestion[]): string {
  return questions
    .map((question, index) => {
      let answer: string;
      if (question.type === "multiple_choice") {
        const correct = question.options.find((option) => option.id === question.correctOptionId);
        answer = `**${question.correctOptionId?.toUpperCase()}**${correct ? ` — ${correct.text}` : ""}`;
      } else if (question.type === "true_false") {
        answer = question.correctOptionId === "true" ? "**Verdadeiro**" : "**Falso**";
      } else {
        answer = `Resposta esperada: ${question.referenceAnswer ?? ""}`;
      }
      return `**${index + 1}.** ${answer}${question.explanation ? `\n\n${question.explanation}` : ""}`;
    })
    .join("\n\n");
}

export function contentToMarkdown(content: GenerationContent): string {
  switch (content.kind) {
    case "summary_quick":
    case "summary_detailed":
      return [
        `# ${content.title}`,
        content.overview,
        ...content.sections.map((s) => `## ${s.heading}\n\n${s.body}`),
        content.keyPoints.length ? `## Para memorizar\n\n${list(content.keyPoints)}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    case "study_guide":
      return [
        `# ${content.title}`,
        content.objectives.length ? `## Objetivos\n\n${list(content.objectives)}` : "",
        ...content.sections.map(
          (s) =>
            `## ${s.heading}\n\n${s.body}${s.checkQuestions.length ? `\n\n**Confira se entendeu:**\n\n${list(s.checkQuestions)}` : ""}`,
        ),
        content.tips.length ? `## Dicas\n\n${list(content.tips)}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    case "key_concepts":
      return [
        `# ${content.title}`,
        ...content.concepts.map((c) => `## ${c.term}\n\n${c.explanation}${c.example ? `\n\n**Exemplo:** ${c.example}` : ""}`),
      ].join("\n\n");
    case "glossary":
      return [`# ${content.title}`, ...content.terms.map((t) => `**${t.term}** — ${t.definition}`)].join("\n\n");
    case "flashcards":
      return [
        `# ${content.title}`,
        ...content.cards.map(
          (c, i) => `**${i + 1}. ${c.front}**\n\n${c.back}${c.hint ? `\n\n_Dica: ${c.hint}_` : ""}`,
        ),
      ].join("\n\n");
    case "quiz":
      return [
        `# ${content.title}`,
        ...content.questions.map(questionBlock),
        `## Gabarito comentado\n\n${answerKey(content.questions)}`,
      ].join("\n\n");
    case "mock_exam":
      return [
        `# ${content.title}`,
        `**Tempo sugerido:** ${content.durationMinutes} minutos`,
        content.instructions,
        ...content.questions.map(questionBlock),
        `## Gabarito comentado\n\n${answerKey(content.questions)}`,
      ]
        .filter(Boolean)
        .join("\n\n");
    case "essay_questions":
      return [
        `# ${content.title}`,
        ...content.questions.map((q, i) => `### ${i + 1}. ${q.prompt}`),
        `## Respostas esperadas`,
        ...content.questions.map(
          (q, i) => `**${i + 1}.** Pontos esperados:\n\n${list(q.expectedPoints)}\n\n**Resposta modelo:**\n\n${q.modelAnswer}`,
        ),
      ].join("\n\n");
    case "explanation":
      return [
        `# ${content.title}`,
        content.explanation,
        content.examples.length ? `## Exemplos\n\n${content.examples.join("\n\n")}` : "",
        content.commonMistakes.length ? `## Erros comuns\n\n${list(content.commonMistakes)}` : "",
        content.practice.length
          ? `## Pratique\n\n${content.practice.map((p, i) => `**${i + 1}.** ${p.question}`).join("\n\n")}\n\n### Respostas\n\n${content.practice
              .map((p, i) => `**${i + 1}.** ${p.answer}`)
              .join("\n\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
  }
}
