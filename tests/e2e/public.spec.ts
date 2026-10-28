import { expect, test } from "@playwright/test";

import { createStudent, deleteUser, expectAccessible, expectNoHorizontalOverflow, trackErrors } from "./support";

const pages = [
  { path: "/", heading: /./ },
  { path: "/biblioteca", heading: /Materiais feitos por estudantes/ },
  { path: "/biblioteca/pessoas", heading: /Encontrar pessoas/ },
  { path: "/planos", heading: /Planos/ },
  { path: "/termos", heading: /Termos/ },
  { path: "/privacidade", heading: /Privacidade|privacidade/ },
  { path: "/contato", heading: /Contato|contato|Fale/ },
  { path: "/entrar", heading: /./ },
  { path: "/cadastro", heading: /./ },
];

for (const { path, heading } of pages) {
  test(`página pública ${path} carrega sem erros, acessível e sem rolagem lateral @celular`, async ({ page }) => {
    const errors = trackErrors(page);
    const response = await page.goto(path, { waitUntil: "networkidle" });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page);
    expect(errors).toEqual([]);
  });
}

test("área do app exige login e volta para a página pedida", async ({ page }) => {
  await page.goto("/app/flashcards");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fapp%2Fflashcards/);
});

test("login ignora destino externo no parâmetro next (sem redirecionamento aberto)", async ({ page, baseURL }) => {
  const user = await createStudent({ name: "Teste de Redirecionamento" });
  try {
    await page.goto("/entrar?next=https://exemplo.com/roubo");
    await page.fill("#email", user.email);
    await page.fill("#password", user.password);
    await page.click("button[type=submit]");
    await page.waitForURL(/\/app/);
    expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
  } finally {
    await deleteUser(user);
  }
});

test("página inexistente responde 404", async ({ page }) => {
  const response = await page.goto("/pagina-que-nao-existe");
  expect(response?.status()).toBe(404);
});
