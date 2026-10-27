# Estado do desenvolvimento

Atualizado a cada fase. "Validado" significa coberto por teste automatizado ou verificado no navegador
contra o Supabase local.

## Fase 1 — Fundação ✅

| Item | Estado | Validação |
| --- | --- | --- |
| Next.js 16 + TS estrito + Tailwind 4 + componentes shadcn/Radix | pronto | `typecheck`, `lint`, `build` |
| Identidade visual Grifo (tokens, fontes self-hosted, logotipo, ícones PWA) | pronto | revisão visual |
| Schema completo com RLS, FKs compostas, privilégios de coluna e funções de servidor | pronto | 36 testes em `tests/db` |
| Cadastro com data de nascimento, aceite de termos e fluxo de responsável (< 12) | pronto | fluxo no navegador + testes |
| Login, logout, confirmação de e-mail, recuperação e redefinição de senha | pronto | fluxo no navegador (Mailpit) |
| Proteção de rotas (proxy) + verificação perto dos dados (DAL) | pronto | redirecionamento testado |
| Landing, termos, privacidade, contato (com fila no banco), planos | pronto | navegador, sem overflow em 390 px |
| PWA (manifest, ícones, service worker com página offline) | pronto | build |

## Fase 2 — Experiência do estudante (em andamento)

| Item | Estado |
| --- | --- |
| Onboarding em 6 etapas (opcionais puláveis, provas no calendário) | pronto, validado no navegador |
| Dashboard com dados reais e estados (novo, sem plano, com histórico) | pronto, validado no navegador |
| Perfil, preferências, privacidade, exportação e exclusão de conta | próximo |

## Integrações que dependem de credenciais

- **IA**: `ANTHROPIC_API_KEY` (ou provedor compatível). Sem chave, os recursos de IA ficam desativados com aviso.
- **E-mail transacional** (Resend): lembretes e convite a responsáveis.
- **Stripe**: assinatura Pro e webhooks.
- **Google OAuth**: precisa ser ativado no Supabase.
