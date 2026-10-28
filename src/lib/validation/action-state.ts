// Sem zod de propósito: os formulários importam daqui e isto vai para o navegador.

/** Estado padrão devolvido por Server Actions usadas com useActionState. */
export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialActionState: ActionState = {};
