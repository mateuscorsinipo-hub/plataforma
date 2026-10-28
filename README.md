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
6. Defina `CRON_SECRET` (32+ caracteres aleatórios). O `vercel.json` agenda as rotinas e a Vercel envia o
   segredo no cabeçalho `Authorization`. No plano Hobby da Vercel só há execução diária: os lembretes do
   calendário (a cada 10 min) exigem o plano Pro ou outro agendador chamando `GET /api/cron/lembretes` com
   `Authorization: Bearer <CRON_SECRET>`.

### Rotinas agendadas

| Rotina | Quando | O que faz |
| --- | --- | --- |
| `/api/cron/lembretes` | a cada 10 min | Lembretes de eventos do calendário (no app; por e-mail se a pessoa ativou e o Resend estiver configurado) e aviso de sequência em risco entre 19h e 22h no fuso de cada pessoa |
| `/api/cron/limpeza` | diária | Limites de requisição vencidos, visualizações antigas, consentimentos expirados, envios abandonados, imagens do chat sem mensagem e notificações lidas há mais de 180 dias |
| `/api/cron/ligas` | segunda, 00h10 (Brasília) | Virada da liga da semana anterior (uma única vez por semana) e aviso a quem subiu ou desceu |

### Pagamentos (Stripe)

1. Crie um produto com preço mensal recorrente em BRL e copie o ID do preço para `STRIPE_PRICE_PRO_MONTHLY`.
2. Crie um endpoint de webhook para `https://seu-dominio/api/billing/webhook` com os eventos
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted` e `invoice.payment_failed`; copie o segredo para `STRIPE_WEBHOOK_SECRET`.
3. Ative o portal do cliente (Customer Portal) no painel do Stripe para troca de cartão e cancelamento.
4. Defina `NEXT_PUBLIC_PRO_PRICE_CENTS` com o mesmo valor do preço (é só o texto exibido).

O plano muda apenas quando o webhook (com assinatura verificada) confirma a assinatura; cada evento é processado
uma vez e a assinatura é relida na API do Stripe, então a ordem de chegada dos eventos não importa.

## Configurações opcionais

| Recurso | Variáveis | Sem configurar |
| --- | --- | --- |
| IA (tutor, estúdio, correções) | `AI_PROVIDER`, `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY`/`OPENAI_BASE_URL`, `AI_MODEL` | Recursos de IA mostram aviso e ficam desativados |
| E-mails (lembretes, responsáveis) | `RESEND_API_KEY`, `EMAIL_FROM` | Lembretes por e-mail e cadastro de menores de 12 anos ficam indisponíveis |
| Pagamentos (Pro) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `NEXT_PUBLIC_PRO_PRICE_CENTS` | Plano Pro aparece como indisponível |
| Login com Google | `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` + provedor ativo no Supabase | Botão não aparece |

## Inteligência artificial

Toda chamada ao modelo passa por `src/lib/ai` (nenhuma página usa SDK diretamente). Trocar de provedor é só
variável de ambiente.

| Variável | Uso |
| --- | --- |
| `AI_PROVIDER` | `anthropic` (padrão) ou `openai_compatible` (OpenAI, Maritaca, Groq, Ollama, vLLM…) |
| `ANTHROPIC_API_KEY` | chave da Anthropic, só no servidor |
| `AI_MODEL` / `AI_MODEL_LIGHT` | modelo principal (padrão `claude-opus-5-5`) e opcional para tarefas leves |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_VISION` | provedor compatível; `OPENAI_VISION=true` se o modelo aceitar imagens |
| `AI_REQUEST_TIMEOUT_MS` | tempo máximo de cada chamada (padrão 120 s) |

Como funciona:

- **Tutor** (`/api/ai/chat`): resposta em streaming (NDJSON), cancelável; histórico limitado por orçamento de
  caracteres; documentos anexados viram trechos recuperados por busca textual em português e numerados — só
  números realmente usados na resposta e existentes nas fontes são salvos como citação.
- **Estúdio** (`/api/ai/generate`): 10 ferramentas com saída estruturada (JSON validado com Zod e conferido:
  gabarito válido, alternativas únicas, quantidade pedida). Material acima de ~90 mil caracteres é condensado em
  partes antes da geração. O progresso é transmitido em etapas.
- **Arquivos**: o navegador envia direto ao Storage por URL assinada; o servidor confere o tipo real pelos bytes,
  extrai texto de PDF, DOCX, PPTX e TXT/MD localmente, e usa o modelo apenas para fotos e PDFs digitalizados
  (até 20 páginas). Fotos são regravadas sem metadados (EXIF/GPS).
- **Consumo**: cada recurso reserva crédito antes de chamar a IA (`consume_usage`, transação com trava) e devolve
  o crédito se a operação falhar sem entregar resultado. Limites por plano ficam só em `src/lib/config/plans.ts`.
- **Sem chave configurada** as telas continuam funcionando e mostram que a IA está desativada; nada é simulado.
- **Custo**: o padrão é o modelo mais capaz. Revise `AI_MODEL`, os limites em `plans.ts` e o esforço por tarefa
  em `src/lib/ai/config.ts` conforme o seu orçamento.

## Aprendizagem

- **Flashcards** usam FSRS (`ts-fsrs`): o servidor calcula o próximo agendamento com o próprio relógio e grava com
  `apply_flashcard_review`, que recusa revisões fora de sequência (outra aba).
- **Quizzes e simulados** compartilham as mesmas tabelas (`quizzes.kind`). A nota objetiva é calculada no banco
  (`submit_quiz_attempt`); o prazo do simulado é conferido pelo RLS a cada resposta.
- **XP** só é concedido pelo servidor (`award_xp`), com teto diário por tipo de atividade e um registro por evento.
- **Tempo de estudo** vem de atividades verificáveis (revisões, tentativas e cronômetro de foco com início gravado
  no servidor); concluir uma tarefa do plano rende XP, mas não soma minutos.

## Comunidade e organização

- **Biblioteca** (`/biblioteca`, pública e indexável; `/app/biblioteca` dentro do app): busca sem acentos com
  `search_materials`, filtros na URL (matéria, etapa, série, tipo, tema, ordem), paginação e materiais relacionados.
- **Publicação** (`/app/materiais`): rascunho, pré-visualização em Markdown, anexo (passa pelo mesmo processamento
  dos envios, com fotos regravadas sem metadados), etiquetas, visibilidade (pública, por link, privada) e declaração
  de autoria. `submit_material` confere tudo de novo no banco, inclusive a idade mínima ou o consentimento do
  responsável. O modo de moderação (`moderation_mode` em `app_settings`) decide se o envio vai para revisão
  (`pre`, padrão) ou publica na hora (`post`); editar conteúdo publicado no modo `pre` volta para revisão.
- **Histórico** de cada material em `material_events` (o autor vê os passos, nunca quem moderou).
- **Interações**: favoritar, salvar, avaliar (1–5, nunca o próprio), denunciar (uma denúncia aberta por pessoa;
  três pessoas diferentes tiram o material do ar até a revisão) e compartilhar. Visualizações são contadas pelo
  servidor, uma por pessoa ou visitante por dia, sem o autor e sem robôs; nenhum número é inventado.
- **Estudar com IA**: cria uma cópia pessoal do material (texto e anexo) entre os arquivos de estudo e abre o
  Estúdio com ela escolhida.
- **Perfis** (`/u/<usuario>`): perfil privado mostra só o @ e os materiais públicos; nome, foto, bio, matérias,
  estatísticas e conquistas dependem das escolhas de privacidade. Perfis não são indexados por buscadores e a busca
  de pessoas só encontra perfis públicos ou quem já assina materiais públicos.
- **Pastas** (`/app/pastas`): juntam arquivos, itens do Estúdio, baralhos, quizzes, conversas e materiais salvos,
  com matéria e contagem regressiva para a prova. Excluir a pasta não apaga os itens.

## Engajamento

- **XP e níveis**: concedidos só no servidor (`award_xp`), com teto diário por atividade e um registro por evento.
  Nível n exige 50·(n−1)² XP.
- **Sequência**: dias seguidos com alguma atividade concluída; o calendário de constância mostra as últimas
  quatro semanas e os dias em que a meta diária foi cumprida.
- **Desafios semanais** (`src/lib/domain/challenges.ts`): três por semana, os mesmos para todos, em rodízio. As
  métricas vêm de `weekly_activity`, que só lê dados gravados pelo servidor; o resgate recalcula o progresso e é
  idempotente.
- **Liga**: XP da semana (segunda a domingo, horário de Brasília). O ranking mostra só o @ de quem permite
  aparecer; cada pessoa sempre vê a própria posição (`my_league_status`).
- **Recomendações** (`src/lib/domain/recommendations.ts`): materiais dos temas com mais erros primeiro, depois
  série, etapa e avaliação, sem repetir o que já foi salvo; o motivo aparece na tela.

## Administração

A área `/admin` (papéis `moderator` e `admin`, lidos de `user_roles` a cada página e ação) tem:

- **Visão geral** com indicadores lidos do banco e o estado das integrações (sem exibir segredos).
- **Moderação** da fila de materiais: aprovar (publica, avisa o autor e concede o XP), pedir ajustes ou remover
  com motivo obrigatório. Ninguém aprova o próprio material.
- **Denúncias** agrupadas por material: manter (devolve ao ar o que saiu por denúncias), arquivar ou remover.
- **Usuários**: busca por @, nome ou e-mail; suspender e reativar (bloqueia também o login no Supabase Auth),
  papéis de moderação e Pro de cortesia (só admin). Moderadores não agem sobre a equipe nem sobre si mesmos.
- **Contato**, **Matérias**, **Configurações** (moderação prévia/posterior, limite de denúncias, idades) e
  **Auditoria** com todas as ações administrativas (quem, o quê, em quem e por quê).

## Estrutura

```
src/
  app/                 rotas (público, auth, onboarding, app, admin, api)
  components/          ui (primitivos), brand, site, app-shell, por domínio
  lib/
    ai/                provedores, prompts, tutor, estúdio (esquemas, normalização, geração)
    api/               proteção das rotas de API (sessão, origem, JSON)
    auth/              sessão, papéis, consentimento de responsáveis
    billing/           plano efetivo, reserva e estorno de consumo
    config/            marca, planos e limites (fonte única), disciplinas
    data/              consultas por tela (camada de acesso a dados)
    documents/         detecção de tipo, extração, OCR, fatiamento e pipeline de processamento
    domain/            regras puras e testáveis (datas, XP, FSRS, gerador de plano, recorrência...)
    progress/          XP, sessões de estudo, meta diária e conquistas (servidor)
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
- Arquivos em bucket privado; envio apenas por URL assinada emitida pelo servidor; tipo real conferido pelos
  bytes, proteção contra ZIP malicioso e limite de páginas, texto e pixels.
- Rotas de API com cookie de sessão exigem JSON e mesma origem (CSRF); limites de requisição por usuário.
- Texto de documentos vai ao modelo delimitado como dado, com instrução para ignorar comandos embutidos.
- Menores: perfil privado por padrão, publicação e perfil público exigem 16 anos ou consentimento;
  abaixo de 12 anos a conta só é liberada com autorização do responsável (LGPD, art. 14). Ninguém consegue
  consultar se outra conta tem consentimento de responsável (a função roda com o RLS de quem pergunta).
- Fotos de perfil só são exibidas quando vêm do bucket de avatares do próprio projeto (o campo é editável e uma
  URL externa serviria para rastrear quem abre o perfil); a CSP bloqueia outras origens.
- Arquivos anexados a materiais saem por link temporário, emitido depois de conferir a visibilidade com a sessão
  de quem pede, com limite de downloads por pessoa.
- Logs estruturados sem dados pessoais; CSP e cabeçalhos de segurança em `next.config.ts`.
