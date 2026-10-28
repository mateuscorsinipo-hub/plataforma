import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { createStudent, deleteUser, login, type E2EUser } from "./support";

/**
 * Nenhum link morto: percorre os links internos a partir das páginas principais
 * (como visitante e logado) e confere que todos respondem sem erro.
 */
const SKIP = [/^\/auth\//, /^\/api\//, /\/arquivo(\?|$)/, /^\/sair/];

async function internalLinks(page: Page): Promise<string[]> {
  const hrefs = await page.$$eval("a[href]", (anchors) => anchors.map((a) => a.getAttribute("href") ?? ""));
  return hrefs
    .filter((href) => href.startsWith("/") && !href.startsWith("//"))
    .map((href) => href.split("#")[0]!)
    .filter((href) => href && !SKIP.some((re) => re.test(href)));
}

async function crawl(page: Page, request: APIRequestContext, seeds: string[], limit: number) {
  const seen = new Set<string>();
  const broken: string[] = [];
  const queue = [...seeds];
  while (queue.length && seen.size < limit) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const response = await request.get(path, { maxRedirects: 5 });
    if (response.status() >= 400) {
      broken.push(`${path} → ${response.status()}`);
      continue;
    }
    if ((response.headers()["content-type"] ?? "").includes("text/html") && seeds.includes(path)) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      for (const link of await internalLinks(page)) if (!seen.has(link)) queue.push(link);
    }
  }
  return { broken, checked: seen.size };
}

test("links públicos levam a páginas existentes", async ({ page, request }) => {
  const { broken, checked } = await crawl(page, request, ["/", "/biblioteca", "/planos", "/contato", "/termos", "/privacidade"], 80);
  expect(checked).toBeGreaterThan(10);
  expect(broken).toEqual([]);
});

test.describe("logado", () => {
  let user: E2EUser;
  test.beforeAll(async () => {
    user = await createStudent({ name: "Explorador de Links" });
  });
  test.afterAll(async () => deleteUser(user));

  test("todos os links do app levam a páginas existentes", async ({ page }) => {
    await login(page, user);
    const seeds = [
      "/app",
      "/app/tutor",
      "/app/estudio",
      "/app/pastas",
      "/app/flashcards",
      "/app/quizzes",
      "/app/simulados",
      "/app/plano",
      "/app/calendario",
      "/app/desempenho",
      "/app/conquistas",
      "/app/biblioteca",
      "/app/materiais",
      "/app/assinatura",
      "/app/configuracoes",
      "/app/notificacoes",
    ];
    const { broken, checked } = await crawl(page, page.request, seeds, 120);
    expect(checked).toBeGreaterThanOrEqual(seeds.length);
    expect(broken).toEqual([]);
  });
});
