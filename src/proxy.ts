import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tudo, exceto arquivos estáticos, imagens otimizadas, ícones, service worker,
    // webhooks e rotas de agendamento (que não usam a sessão do navegador).
    "/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|api/billing/webhook|api/cron/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
