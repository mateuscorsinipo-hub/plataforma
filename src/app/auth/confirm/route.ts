import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/supabase/proxy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedTypes: EmailOtpType[] = ["signup", "email", "recovery", "email_change", "invite", "magiclink"];

/** Links de e-mail com token_hash (confirmação de conta, recuperação, troca de e-mail). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"), "/app");

  if (tokenHash && type && allowedTypes.includes(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }
  return NextResponse.redirect(new URL("/entrar?erro=link", origin));
}
