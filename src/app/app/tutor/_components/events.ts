/**
 * Avisos entre o chat e a lista de conversas (mesma página, componentes diferentes).
 * Evita recarregar a rota a cada resposta, o que remontaria o chat.
 */
export type TutorActivity = {
  conversationId: string;
  title?: string;
  usage?: { used: number; limit: number };
  removed?: boolean;
};

const EVENT = "grifo:tutor-activity";

export function emitTutorActivity(detail: TutorActivity) {
  window.dispatchEvent(new CustomEvent<TutorActivity>(EVENT, { detail }));
}

export function onTutorActivity(handler: (detail: TutorActivity) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<TutorActivity>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
