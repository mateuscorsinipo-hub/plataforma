// Sem zod de propósito: o formulário de cadastro usa no navegador.
import { brand } from "@/lib/config/brand";

export const CHILD_AGE_LIMIT = brand.minimumAge;

/** Idade completa em anos numa data de referência (padrão: hoje, UTC). */
export function ageOn(birthDate: string, reference = new Date()): number {
  const [y, m, d] = birthDate.split("-").map((part) => Number.parseInt(part, 10));
  if (!y || !m || !d) return Number.NaN;
  let age = reference.getUTCFullYear() - y;
  const monthDiff = reference.getUTCMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && reference.getUTCDate() < d)) age -= 1;
  return age;
}
