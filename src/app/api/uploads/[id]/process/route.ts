import { checkSameOrigin, jsonError, requireApiStudent } from "@/lib/api/guard";
import { getPlanForUser, getUserTimezone } from "@/lib/billing/entitlements";
import { processUploadedFile } from "@/lib/documents/pipeline";
import { toFileSummary } from "@/lib/documents/summary";
import { checkRateLimit, rateLimits } from "@/lib/security/rate-limit";
import { uuidSchema } from "@/lib/validation/common";

export const maxDuration = 300;

export async function POST(request: Request, ctx: RouteContext<"/api/uploads/[id]/process">) {
  const blocked = checkSameOrigin(request);
  if (blocked) return blocked;
  const auth = await requireApiStudent();
  if (!auth.ok) return auth.response;
  const { user } = auth.ctx;

  const { id } = await ctx.params;
  const fileId = uuidSchema.safeParse(id);
  if (!fileId.success) return jsonError(400, "Arquivo inválido.");
  if (!(await checkRateLimit(`process:${user.id}`, rateLimits.upload))) {
    return jsonError(429, "Muitos arquivos em pouco tempo. Aguarde alguns minutos.");
  }

  const [plan, timezone] = await Promise.all([getPlanForUser(user.id), getUserTimezone(user.id)]);
  const result = await processUploadedFile({ fileId: fileId.data, userId: user.id, plan, timezone, signal: request.signal });
  if (!result.ok) return jsonError(result.status, result.message, { code: result.code });
  return Response.json({ file: toFileSummary(result.file) }, { headers: { "Cache-Control": "no-store" } });
}
