# Grifo — plataforma de estudos com IA

Aplicação web (PWA) para estudantes brasileiros: tutor de IA, estúdio que transforma material em resumos,
flashcards e quizzes, repetição espaçada, simulados, planos de estudo, calendário, biblioteca da comunidade
com moderação, gamificação e planos Grátis/Pro.

> Estado do desenvolvimento por fase: veja [docs/STATUS.md](docs/STATUS.md).

## Stack

| Camada | Tecnologia |
| --- | --- |
| Front-end e servidor | Next.js 16 (App Router, Cache Components, Server Actions), React 19, TypeScript estrito |
| UI | Tailwind CSS 4, componentes no padrão shadcn/ui sobre Radix, ícones Lucide |
| Banco, auth e arquivos | Supabase (PostgreSQL 17, Auth, Storage) com Row Level Security |
| IA | Anthropic (padrão, SDK oficial) ou provedor compatível com a API da OpenAI |
| Testes | Vitest (unidade + integração com o banco), Playwright (ponta a ponta) |

## Requisitos

- Node.js 22 ou superior e npm 10
- Docker (para o Supabase local)
- Conta no Supabase para produção; chave de API do provedor de IA para os recursos de IA

## Instalação

```bash
npm install
cp .env.example .env.local
```

## Supabase local

```bash
npx supabase start          # sobe Postgres, Auth, Storage, REST e Mailpit
npx supabase status         # mostra URL e chaves locais
```

Copie para o `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL` → `API_URL` (padrão `http://127.0.0.1:54321`)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → `PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` → `SECRET_KEY`

Os e-mails de confirmação e recuperação ficam no Mailpit: <http://127.0.0.1:54324>.

> Se o Docker Hub/ECR limitar downloads, use `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start`.
> O `supabase start` deste repositório exclui serviços não usados:
> `npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,postgres-meta`.

### Migrações

As migrações versionadas ficam em `supabase/migrations/` e são aplicadas pelo `supabase start`.
Para recriar o banco local do zero:

```bash
npm run db:reset
npm run db:types   # regenera src/lib/supabase/database.types.ts
```

Em produção: `npx supabase link --project-ref <id>` e `npx supabase db push`.

### Primeiro administrador

O papel administrativo é lido da tabela `user_roles` (nunca do navegador). Depois de criar a conta:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'voce@exemplo.com';
```

## Execução

```bash
npm run dev     # http://localhost:3000
```

## Testes e verificações

```bash
npm run typecheck   # next typegen + tsc
npm run lint
npm test            # unidade + integração com o banco (requer supabase start)
npm run test:e2e    # Playwright (requer app e Supabase rodando)
```

Os testes de banco (`tests/db`) criam usuários reais no Supabase local e verificam isolamento entre
usuários (RLS), privilégios de coluna, funções exclusivas do servidor (XP, consumo, visualizações),
moderação, correção de quizzes e prazos de simulado. Sem o Supabase local eles são pulados.

## Build de produção

```bash
npm run build && npm start
```

## Implantação (Vercel + Supabase)

1. Crie o projeto no Supabase e aplique as migrações (`supabase db push`).
2. Em **Authentication → URL Configuration**, defina o Site URL e as Redirect URLs (`https://seu-dominio/**`).
3. Em **Authentication → Email Templates**, use os modelos de `supabase/templates/` (apontam para `/auth/confirm`).
4. Configure um SMTP próprio no Supabase (o padrão tem limite baixo de envio).
5. Cadastre as variáveis de `.env.example` no provedor de hospedagem.

## Configurações opcionais

| Recurso | Variáveis | Sem configurar |
| --- | --- | --- |
| IA (tutor, estúdio, correções) | `AI_PROVIDER`, `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY`/`OPENAI_BASE_URL`, `AI_MODEL` | Recursos de IA mostram aviso e ficam desativados |
| E-mails (lembretes, responsáveis) | `RESEND_API_KEY`, `EMAIL_FROM` | Lembretes por e-mail e cadastro de menores de 12 anos ficam indisponíveis |
| Pagamentos (Pro) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `NEXT_PUBLIC_PRO_PRICE_CENTS` | Plano Pro aparece como indisponível |
| Login com Google | `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` + provedor ativo no Supabase | Botão não aparece |

## Estrutura

```
src/
  app/                 rotas (público, auth, onboarding, app, admin, api)
  components/          ui (primitivos), brand, site, app-shell, por domínio
  lib/
    auth/              sessão, papéis, consentimento de responsáveis
    config/            marca, planos e limites (fonte única), disciplinas
    data/              consultas por tela (camada de acesso a dados)
    domain/            regras puras e testáveis (datas, XP, plano de estudos...)
    env/               variáveis públicas e de servidor
    security/          rate limiting, hashing, IP
    supabase/          clientes (navegador, servidor, admin, proxy) e tipos gerados
    validation/        esquemas zod das fronteiras
supabase/
  migrations/          esquema, RLS, funções e dados de referência
  templates/           e-mails de autenticação em português
tests/
  unit/  db/  e2e/
```

## Segurança e privacidade

- RLS em todas as tabelas; tabelas filhas usam FKs compostas `(id, user_id)` para impedir vínculos entre usuários.
- Colunas sensíveis (status de conta, contadores, status de moderação, notas) não são graváveis pelo cliente.
- XP, consumo de IA, visualizações e moderação só por funções executáveis com a chave secreta, no servidor.
- Arquivos em bucket privado; envio apenas por URL assinada emitida pelo servidor.
- Menores: perfil privado por padrão, publicação e perfil público exigem 16 anos ou consentimento;
  abaixo de 12 anos a conta só é liberada com autorização do responsável (LGPD, art. 14).
- Logs estruturados sem dados pessoais; CSP e cabeçalhos de segurança em `next.config.ts`.
