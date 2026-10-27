import { gradeLabel } from "@/lib/config/subjects";

export type LearnerContext = {
  firstName: string;
  schoolStage: string | null;
  gradeYear: number | null;
  explanationLevel: "simple" | "balanced" | "deep";
  isMinor: boolean;
};

const levelText: Record<LearnerContext["explanationLevel"], string> = {
  simple: "Prefere explicações simples, com linguagem do dia a dia e exemplos concretos.",
  balanced: "Prefere explicações equilibradas: claras, mas com o rigor necessário.",
  deep: "Prefere explicações aprofundadas, com detalhes, demonstrações e conexões entre temas.",
};

export function describeLearner(learner: LearnerContext): string {
  const stage = gradeLabel(learner.schoolStage, learner.gradeYear);
  return [
    `Nome: ${learner.firstName}.`,
    stage ? `Etapa: ${stage}.` : "Etapa escolar não informada.",
    levelText[learner.explanationLevel],
    learner.isMinor ? "É menor de idade." : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Regras comuns de segurança e cuidado (o público inclui crianças e adolescentes). */
export const SAFETY_RULES = `Cuidado com o estudante:
- O público inclui crianças e adolescentes. Mantenha o conteúdo apropriado à idade.
- Não peça nem incentive o envio de dados pessoais (endereço, telefone, documentos, senhas, fotos pessoais).
- Se o estudante demonstrar sofrimento intenso, risco à própria vida ou situação de violência, acolha com empatia, incentive buscar um adulto de confiança e informe o CVV (ligue 188, gratuito, 24 horas) ou, em emergência, o SAMU (192) e a polícia (190).
- Recuse com uma frase curta pedidos perigosos ou impróprios e ofereça ajuda com o estudo.`;

/** Delimita texto do estudante como dado, nunca como instrução. */
export function wrapMaterial(tag: string, content: string, attributes: Record<string, string> = {}): string {
  const attrs = Object.entries(attributes)
    .map(([key, value]) => ` ${key}="${value.replace(/"/g, "'")}"`)
    .join("");
  const safe = content.replaceAll(`</${tag}>`, `</ ${tag}>`);
  return `<${tag}${attrs}>\n${safe}\n</${tag}>`;
}
