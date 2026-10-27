import { contentToMarkdown } from "@/lib/ai/studio/markdown";
import { getSessionUser } from "@/lib/auth/session";
import { getGeneration } from "@/lib/data/studio";
import { uuidSchema } from "@/lib/validation/common";

function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "material"
  );
}

/** Baixa o material em Markdown (abre em qualquer editor e no Notion/Obsidian). */
export async function GET(_request: Request, ctx: RouteContext<"/app/estudio/[id]/exportar">) {
  const user = await getSessionUser();
  if (!user) return new Response("Faça login para baixar este material.", { status: 401 });
  const { id } = await ctx.params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return new Response("Material não encontrado.", { status: 404 });
  const generation = await getGeneration(parsed.data);
  if (!generation || generation.status !== "completed") return new Response("Material não encontrado.", { status: 404 });

  const body = generation.markdown?.trim() || (generation.content ? contentToMarkdown(generation.content) : "");
  const footer = "\n\n---\n_Gerado com IA no Grifo a partir do material do estudante. Confira informações importantes._\n";
  return new Response(body + footer, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(generation.title)}.md"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
