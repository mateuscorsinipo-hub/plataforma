# Estado do desenvolvimento

Atualizado a cada fase. "Validado" significa coberto por teste automatizado ou verificado no navegador
contra o Supabase local.

## Fase 1 — Fundação ✅

| Item | Estado | Validação |
| --- | --- | --- |
| Next.js 16 + TS estrito + Tailwind 4 + componentes shadcn/Radix | pronto | `typecheck`, `lint`, `build` |
| Identidade visual Grifo (tokens, fontes self-hosted, logotipo, ícones PWA) | pronto | revisão visual |
| Schema completo com RLS, FKs compostas, privilégios de coluna e funções de servidor | pronto | testes em `tests/db` |
| Cadastro com data de nascimento, aceite de termos e fluxo de responsável (< 12) | pronto | fluxo no navegador + testes |
| Login, logout, confirmação de e-mail, recuperação e redefinição de senha | pronto | fluxo no navegador (Mailpit) |
| Proteção de rotas (proxy) + verificação perto dos dados (DAL) | pronto | redirecionamento testado |
| Landing, termos, privacidade, contato (com fila no banco), planos | pronto | navegador, sem overflow em 390 px |
| PWA (manifest, ícones, service worker com página offline) | pronto | build |

## Fase 2 — Experiência do estudante ✅

| Item | Estado |
| --- | --- |
| Onboarding em 6 etapas (opcionais puláveis, provas no calendário) | pronto, validado no navegador |
| Dashboard com dados reais e estados (novo, sem plano, com histórico) | pronto, validado no navegador |
| Perfil, preferências, privacidade, exportação (JSON) e exclusão de conta | pronto, validado no navegador |
| Notificações | pronto |

## Fase 3 — Inteligência artificial ✅

| Item | Estado | Validação |
| --- | --- | --- |
| Camada de IA central (Anthropic padrão; OpenAI-compatível opcional), erros tipados, esforço por tarefa | pronto | tipos + testes de unidade |
| Envio por URL assinada, detecção de tipo real, extração PDF/DOCX/PPTX/TXT, fatiamento com páginas | pronto | navegador + `tests/db/ai-flows` |
| OCR de fotos e PDFs digitalizados (precisa de provedor com visão) | pronto | teste com provedor substituído |
| Tutor: streaming, cancelamento, histórico, anexar documentos/fotos, citações verificadas, renomear, resumir, excluir | pronto | testes de integração + interface no navegador com respostas interceptadas |
| Estúdio: 10 ferramentas, opções de dificuldade/tamanho/quantidade/foco, progresso por etapas, condensação de material longo | pronto | testes de integração |
| Material gerado: visualização por tipo, edição em Markdown, exportação `.md`, impressão/PDF, renomear, excluir | pronto | navegador |
| Consumo com reserva atômica e estorno em falha; limites centralizados por plano | pronto | testes de integração |

**Não validado com IA real**: este ambiente não tem chave de provedor. Os fluxos foram testados com o provedor
substituído nos testes automatizados e com respostas interceptadas no navegador; a primeira execução com chave
real deve ser acompanhada (qualidade das respostas, tempos e custo).

## Fase 4 — Aprendizagem ✅

| Item | Estado | Validação |
| --- | --- | --- |
| Flashcards com FSRS (agendamento no servidor, revisão atômica, recusa de revisão concorrente) | pronto | testes de unidade + integração + navegador |
| Baralhos: criar, editar, suspender, importar lista (Anki/Quizlet), salvar a partir do estúdio | pronto | integração + navegador |
| Revisão rápida, completa e por matéria, com atalhos de teclado e reaparição de cartões errados | pronto | navegador |
| Quizzes: editor (múltipla escolha, V ou F, abertas), tentativas, correção no banco, revisão comentada | pronto | integração + navegador |
| Simulados: cronômetro com compensação de relógio, navegação, marcação, salvamento automático, prazo no banco | pronto | integração + navegador |
| Montagem de simulado com questões próprias (sem IA) e a partir do estúdio | pronto | navegador |
| Abertas: correção por IA rotulada como automática; sem IA ou sem cota, autoavaliação | pronto | integração (autoavaliação) |
| Relatório por tema, erros recorrentes, histórico de tentativas | pronto | navegador |
| Plano de estudos: gerador com revisões espaçadas e reta final com simulados; reorganização de atrasos | pronto | testes de unidade + integração + navegador |
| Cronômetro de foco com início gravado no servidor | pronto | navegador |
| Calendário: recorrência, fuso, choque de horário, provas do plano, tarefas do dia | pronto | testes de unidade + integração + navegador |
| Desempenho: indicadores, gráficos por dia, acertos por matéria, pontos fracos, tabela acessível | pronto | navegador |
| XP no servidor com teto diário e idempotência; meta diária; conquistas | pronto | integração |

Lembretes de eventos: o horário fica gravado; o envio (no app e por e-mail, se configurado) é feito pela rotina
agendada da Fase 7.

## Integrações que dependem de credenciais

- **IA**: `ANTHROPIC_API_KEY` (ou provedor compatível). Sem chave, os recursos de IA ficam desativados com aviso.
- **E-mail transacional** (Resend): lembretes e convite a responsáveis.
- **Stripe**: assinatura Pro e webhooks.
- **Google OAuth**: precisa ser ativado no Supabase.
