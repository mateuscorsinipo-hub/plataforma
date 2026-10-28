#!/usr/bin/env node
/**
 * Procura segredos no que o build entrega ao navegador: JavaScript e CSS do cliente
 * (.next/static) e páginas pré-renderizadas (HTML e payloads RSC em .next/server).
 * Roda depois do `next build` (postbuild) e falha o build se achar algo.
 *
 * Duas checagens: (1) o valor real de cada variável só de servidor presente no ambiente
 * do build; (2) formatos conhecidos de chaves secretas, mesmo que estejam na variável errada.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const serverOnlyVars = [
  "SUPABASE_SECRET_KEY",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "APP_HASH_SECRET",
  "CRON_SECRET",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

const patterns = [
  { name: "chave secreta do Supabase", regex: /sb_secret_[A-Za-z0-9_-]{16,}/ },
  { name: "JWT com papel service_role", regex: /InJvbGUiOiJzZXJ2aWNlX3JvbGUi|"role"\s*:\s*"service_role"/ },
  { name: "chave secreta do Stripe", regex: /\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,}/ },
  { name: "segredo de webhook do Stripe", regex: /whsec_[A-Za-z0-9]{16,}/ },
  { name: "chave da Anthropic", regex: /sk-ant-[A-Za-z0-9_-]{20,}/ },
];

const roots = [
  { dir: ".next/static", include: /\.(?:js|mjs|css|json|map|txt)$/ },
  { dir: ".next/server/app", include: /\.(?:html|rsc|body|meta|txt)$/ },
  { dir: ".next/server/pages", include: /\.html$/ },
];

if (!existsSync(".next/static")) {
  console.error("check-client-secrets: rode `next build` antes (pasta .next/static não encontrada).");
  process.exit(1);
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const secrets = serverOnlyVars
  .map((name) => ({ name, value: process.env[name]?.trim() ?? "" }))
  .filter((s) => s.value.length >= 8);

const findings = [];
let scanned = 0;
for (const { dir, include } of roots) {
  if (!existsSync(dir)) continue;
  for (const file of walk(dir)) {
    if (!include.test(file)) continue;
    scanned++;
    const text = readFileSync(file, "utf8");
    for (const { name, value } of secrets) {
      if (text.includes(value)) findings.push(`${relative(".", file)}: valor de ${name}`);
    }
    for (const { name, regex } of patterns) {
      if (regex.test(text)) findings.push(`${relative(".", file)}: ${name}`);
    }
  }
}

if (findings.length > 0) {
  console.error(`check-client-secrets: ${findings.length} possível(is) segredo(s) no que vai para o navegador:`);
  for (const finding of findings) console.error(`  - ${finding}`);
  process.exit(1);
}
console.log(`check-client-secrets: ${scanned} arquivos entregues ao navegador, nenhum segredo (${secrets.length} variáveis de servidor conferidas).`);
