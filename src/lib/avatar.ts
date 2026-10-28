import { publicEnv } from "@/lib/env/public";

/**
 * Fotos de perfil só são exibidas quando vêm do bucket de avatares do próprio Supabase.
 * O campo é editável pelo usuário; uma URL externa serviria para rastrear quem vê o perfil
 * (a CSP também bloqueia outras origens, isto é a segunda barreira).
 */
export function safeAvatarUrl(url: string | null | undefined): string | null {
  if (!url || !publicEnv.supabaseUrl) return null;
  return url.startsWith(`${publicEnv.supabaseUrl}/storage/v1/object/public/avatars/`) ? url : null;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}
