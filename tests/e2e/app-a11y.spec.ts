import { test } from "@playwright/test";

import { createStudent, deleteUser, expectAccessible, expectNoHorizontalOverflow, login, type E2EUser } from "./support";

const screens = [
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
  "/app/materiais/novo",
  "/app/assinatura",
  "/app/configuracoes",
  "/app/notificacoes",
];

test.describe("telas do app @celular", () => {
  let user: E2EUser;
  test.beforeAll(async () => {
    user = await createStudent({ name: "Teste de Acessibilidade" });
  });
  test.afterAll(async () => deleteUser(user));

  test("sem violações sérias de acessibilidade e sem rolagem lateral", async ({ page }) => {
    await login(page, user);
    for (const path of screens) {
      await test.step(path, async () => {
        await page.goto(path, { waitUntil: "networkidle" });
        await expectNoHorizontalOverflow(page);
        await expectAccessible(page);
      });
    }
  });
});
