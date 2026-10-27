/** Leitura tolerante de JSON devolvido por modelos (remove cercas de código) com validação. */
type SafeParser<T> = {
  safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { message: string } };
};

export function safeJson<T>(text: string, schema: SafeParser<T>): { ok: true; data: T } | { ok: false; error: string } {
  let value: unknown;
  try {
    value = JSON.parse(stripCodeFence(text));
  } catch {
    return { ok: false, error: "JSON inválido" };
  }
  const result = schema.safeParse(value);
  return result.success ? { ok: true, data: result.data } : { ok: false, error: result.error.message.slice(0, 500) };
}

export function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fence?.[1] ?? trimmed;
}
