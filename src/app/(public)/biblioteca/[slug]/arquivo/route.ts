import { getSessionUser } from "@/lib/auth/session";
import { getVisibleMaterial } from "@/lib/data/library";
import { localDateString } from "@/lib/domain/dates";
import { isServiceRoleConfigured } from "@/lib/env/server";
import { checkRateLimit, rateLimits } from "@/lib/security/rate-limit";
import { anonymousVisitorKey } from "@/lib/security/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Arquivo anexado a um material: o bucket é privado, então só emitimos um link
 * temporário depois de confirmar (com o RLS de quem pede) que o material é visível.
 * `?modo=ver` abre no navegador; sem ele, o arquivo é baixado.
 */
export async function GET(request: Request, ctx: RouteContext<"/biblioteca/[slug]/arquivo">) {
  const { slug } = await ctx.params;
  if (!isServiceRoleConfigured()) return new Response("Arquivos indisponíveis nesta instalação.", { status: 503 });
  const user = await getSessionUser();
  const requester = user ? `user:${user.id}` : await anonymousVisitorKey(localDateString("America/Sao_Paulo"));
  if (!(await checkRateLimit(`download:${requester}`, rateLimits.materialDownload))) {
    return new Response("Muitos downloads em pouco tempo. Tente de novo em alguns minutos.", { status: 429 });
  }
  const material = await getVisibleMaterial(slug);
  if (!material?.file_id) return new Response("Arquivo não encontrado.", { status: 404 });
  const admin = createSupabaseAdminClient();
  const { data: file } = await admin
    .from("uploaded_files")
    .select("storage_path, original_name, status")
    .eq("id", material.file_id)
    .eq("user_id", material.author_id)
    .maybeSingle();
  if (!file || file.status !== "ready") return new Response("Arquivo não encontrado.", { status: 404 });
  const inline = new URL(request.url).searchParams.get("modo") === "ver";
  const { data: signed } = await admin.storage
    .from("uploads")
    .createSignedUrl(file.storage_path, 300, inline ? undefined : { download: file.original_name });
  if (!signed?.signedUrl) return new Response("Arquivo indisponível.", { status: 502 });
  return new Response(null, {
    status: 302,
    headers: { Location: signed.signedUrl, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
