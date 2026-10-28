import { getSessionUser } from "@/lib/auth/session";
import { localDateString } from "@/lib/domain/dates";
import { isServiceRoleConfigured } from "@/lib/env/server";
import { anonymousVisitorKey, isLikelyBot } from "@/lib/security/request";
import { checkRateLimit, rateLimits } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation/common";

/**
 * Registra uma visualização: no máximo uma por pessoa (ou visitante anônimo) por dia,
 * sem contar o autor nem robôs. A chave anônima é um hash diário; IPs não são guardados.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/materials/[id]/view">) {
  const { id } = await ctx.params;
  const materialId = uuidSchema.safeParse(id);
  if (!materialId.success || !isServiceRoleConfigured()) return new Response(null, { status: 204 });
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return new Response(null, { status: 204 });
  if (await isLikelyBot()) return new Response(null, { status: 204 });

  const user = await getSessionUser();
  const today = localDateString("America/Sao_Paulo");
  const viewerKey = user ? `user:${user.id}` : await anonymousVisitorKey(today);
  if (!(await checkRateLimit(`view:${viewerKey}`, rateLimits.materialView))) return new Response(null, { status: 204 });

  const admin = createSupabaseAdminClient();
  await admin.rpc("record_material_view", { p_material_id: materialId.data, p_viewer_key: viewerKey.slice(0, 80), p_viewer_id: user?.id ?? (null as unknown as string) });
  return new Response(null, { status: 204 });
}
