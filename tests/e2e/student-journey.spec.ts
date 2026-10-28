import { expect, test } from "@playwright/test";

import { createStudent, deleteUser, login, trackErrors, type E2EUser } from "./support";

test.describe("jornada do estudante", () => {
  let user: E2EUser;
  test.beforeAll(async () => {
    user = await createStudent({ name: "Lara Mendes" });
  });
  test.afterAll(async () => deleteUser(user));

  test("cria baralho, revisa, organiza em pasta e escreve um material", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page, user);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Lara");

    // Flashcards: baralho com dois cartões e revisão completa.
    await page.goto("/app/flashcards");
    await page.getByRole("button", { name: "Novo baralho" }).first().click();
    await page.getByRole("dialog").getByLabel("Nome").fill("Citologia");
    await page.getByRole("dialog").getByRole("button", { name: "Criar baralho" }).click();
    await page.waitForURL(/\/app\/flashcards\/[0-9a-f-]{36}$/);
    const cards: [string, string][] = [
      ["O que é mitose?", "Divisão celular que gera duas células idênticas."],
      ["Onde ocorre a fotossíntese?", "Nos cloroplastos."],
    ];
    for (const [front, back] of cards) {
      await page.locator("#novo-frente").fill(front);
      await page.locator("#novo-verso").fill(back);
      await page.getByRole("button", { name: "Adicionar cartão" }).click();
      await expect(page.getByText(front)).toBeVisible();
      // O formulário se limpa quando a ação termina; só então dá para escrever o próximo.
      await expect(page.locator("#novo-frente")).toHaveValue("");
    }
    await page.getByRole("link", { name: /Revisar \(2\)/ }).click();
    // Cartões novos voltam na mesma sessão enquanto estão em aprendizado (FSRS).
    const done = page.getByRole("heading", { name: "Sessão concluída" });
    for (let i = 0; i < 10 && !(await done.isVisible()); i++) {
      await page.getByRole("button", { name: /Mostrar resposta/ }).click();
      await page.getByRole("button", { name: /^Bom/ }).click();
      await expect(page.getByRole("button", { name: /Mostrar resposta/ }).or(done)).toBeVisible();
    }
    await expect(done).toBeVisible();
    // O XP das revisões vem do servidor e aparece no topo.
    await expect(page.getByRole("link", { name: /pontos de experiência/ })).not.toHaveAccessibleName(/^0 XP/);

    // Pasta com o baralho.
    await page.goto("/app/pastas");
    await page.getByRole("button", { name: "Nova pasta" }).first().click();
    await page.locator("#pasta-nome").fill("Prova de Biologia");
    await page.getByRole("button", { name: "Criar pasta" }).click();
    await page.waitForURL(/\/app\/pastas\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: "Adicionar itens" }).click();
    await page.getByRole("dialog").getByText("Citologia").click();
    await page.getByRole("dialog").getByRole("button", { name: /Adicionar/ }).click();
    await expect(page.getByRole("heading", { name: /Baralhos/ })).toBeVisible();

    // Rascunho de material na comunidade.
    await page.goto("/app/materiais/novo");
    await page.locator("#mat-titulo").fill("Resumo de citologia para a prova");
    await page.locator("#mat-materia").selectOption({ label: "Biologia" });
    await page.locator("#mat-conteudo").fill("# Citologia\n\nA célula é a unidade básica da vida.");
    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    await page.waitForURL(/\/app\/materiais\/[0-9a-f-]{36}\/editar$/);
    await page.goto("/app/materiais");
    await expect(page.getByRole("link", { name: "Resumo de citologia para a prova" })).toBeVisible();
    await expect(page.getByText("Rascunho").first()).toBeVisible();

    expect(errors).toEqual([]);
  });
});
