import { z } from "zod";

export { type ActionState, initialActionState } from "@/lib/validation/action-state";

export function fieldErrorsOf(error: z.ZodError): Record<string, string[] | undefined> {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

/** Converte FormData em objeto simples (campos repetidos viram arrays). */
export function formDataToObject(formData: FormData): Record<string, FormDataEntryValue | FormDataEntryValue[]> {
  const result: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    const current = result[key];
    if (current === undefined) result[key] = value;
    else if (Array.isArray(current)) current.push(value);
    else result[key] = [current, value];
  }
  return result;
}

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((value) => (value.length ? value : null))
    .nullable()
    .optional()
    .transform((value) => value ?? null);

export const uuidSchema = z.uuid({ error: "Identificador inválido." });

export const checkboxSchema = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal(""), z.boolean()])
  .optional()
  .transform((value) => value === true || value === "on" || value === "true");

export function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.length) return [value];
  return [];
}
