import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/supabase/proxy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Troca do código PKCE (login social e links de e-mail no modelo padrão do Supabase). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"), "/app");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }
  const reason = searchParams.get("error") ? "oauth" : "link";
  return NextResponse.redirect(new URL(`/entrar?erro=${reason}`, origin));
}
