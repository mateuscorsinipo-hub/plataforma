import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Testes ponta a ponta contra o app rodando e o Supabase local (`npx supabase start`).
 * Sem E2E_BASE_URL, sobe `npm run start` (rode `npm run build` antes) ou reaproveita o
 * servidor que já estiver em http://localhost:3000.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 7"] }, grep: /@celular/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run start", url: baseURL, reuseExistingServer: true, timeout: 180_000 },
});
