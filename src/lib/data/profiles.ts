import "server-only";

import { createSupabasePublicClient } from "@/lib/supabase/public";

export type PublicProfile = {
  id: string;
  username: string;
  isPublic: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  memberSince: string | null;
  subjects: { slug: string; name: string; color: string }[];
  stats: { level: number; xpTotal: number; longestStreak: number } | null;
  achievements: { code: string; title: string; icon: string; unlockedAt: string }[];
  materialsCount: number;
};

type RawProfile = {
  id: string;
  username: string;
  is_public: boolean;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  member_since: string | null;
  subjects: { slug: string; name: string; color: string }[] | null;
  stats: { level: number; xp_total: number; longest_streak: number } | null;
  achievements: { code: string; title: string; icon: string; unlocked_at: string }[] | null;
  materials_count: number;
};

/**
 * Perfil público pelo @. A função do banco já aplica as escolhas de privacidade
 * (perfil privado só mostra o @ e os materiais públicos). Sem cache: uma mudança
 * para privado precisa valer na hora.
 */
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const clean = username.toLowerCase();
  if (!/^[a-z0-9][a-z0-9_.]{1,22}[a-z0-9]$/.test(clean)) return null;
  const { data } = await createSupabasePublicClient().rpc("get_public_profile", { p_username: clean });
  if (!data || typeof data !== "object") return null;
  const raw = data as unknown as RawProfile;
  return {
    id: raw.id,
    username: raw.username,
    isPublic: raw.is_public,
    displayName: raw.display_name || null,
    avatarUrl: raw.avatar_url,
    bio: raw.bio,
    memberSince: raw.member_since,
    subjects: raw.subjects ?? [],
    stats: raw.stats ? { level: raw.stats.level, xpTotal: raw.stats.xp_total, longestStreak: raw.stats.longest_streak } : null,
    achievements: (raw.achievements ?? []).map((a) => ({ code: a.code, title: a.title, icon: a.icon, unlockedAt: a.unlocked_at })),
    materialsCount: Number(raw.materials_count ?? 0),
  };
}

export type ProfileSearchResult = { username: string; displayName: string | null; avatarUrl: string | null; materialsCount: number };

export async function searchProfiles(query: string): Promise<ProfileSearchResult[]> {
  const q = query.trim().replace(/^@/, "").slice(0, 40);
  if (q.length < 2) return [];
  const { data } = await createSupabasePublicClient().rpc("search_profiles", { p_query: q, p_limit: 30 });
  return (data ?? []).map((p) => ({
    username: p.username,
    displayName: p.display_name || null,
    avatarUrl: p.avatar_url,
    materialsCount: Number(p.materials_count),
  }));
}
