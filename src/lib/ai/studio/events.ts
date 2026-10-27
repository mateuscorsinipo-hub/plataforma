/** Eventos de progresso do estúdio (compartilhados entre a rota e a interface). */
export type GenerationStage =
  | { stage: "reading" }
  | { stage: "condensing"; done: number; total: number }
  | { stage: "generating" }
  | { stage: "saving" };

export type GenerateStreamEvent =
  | ({ type: "stage" } & GenerationStage)
  | { type: "done"; id: string }
  | { type: "error"; message: string; code: string; id?: string };
