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

Lembretes de eventos: o envio (no app e por e-mail, se configurado) é feito pela rotina agendada
`/api/cron/lembretes` (Fase 7).

## Fase 5 — Comunidade ✅

| Item | Estado | Validação |
| --- | --- | --- |
| Biblioteca pública e no app: busca sem acentos, filtros na URL, atalhos por matéria, paginação, estados vazios | pronto | navegador + testes de unidade |
| Página do material: Markdown com fórmulas, anexo (abrir/baixar por link temporário), relacionados, metadados e `noindex` quando não é público | pronto | navegador (desktop e 390 px) |
| Favoritar, salvar, avaliar, denunciar, compartilhar; contadores mantidos pelo banco | pronto | integração + navegador |
| Visualizações reais: uma por pessoa/visitante por dia, sem autor e sem robôs | pronto | navegador (contagem conferida no banco) |
| Publicação: rascunho, pré-visualização, anexo, etiquetas, visibilidade, autoria, envio, despublicar, excluir | pronto | integração + navegador |
| Moderação prévia ou posterior (configurável), volta para revisão ao editar, histórico sem expor moderadores | pronto | integração |
| XP por publicação (uma vez por material, com teto diário) e conquista "Primeira contribuição" | pronto | integração |
| Regra de idade/consentimento antecipada na tela e conferida no banco | pronto | integração + navegador |
| Minhas denúncias com andamento | pronto | navegador |
| Estudar com IA: cópia pessoal do material vira arquivo de estudo e abre o Estúdio já selecionado | pronto | integração + navegador |
| Perfis públicos respeitando privacidade; busca de pessoas restrita e com limite | pronto | integração + navegador |
| Pastas: criar, editar, excluir (sem apagar itens), adicionar e retirar itens de seis tipos, prova com contagem regressiva | pronto | integração + navegador |

Correções de segurança desta fase: `has_guardian_consent` deixou de revelar a qualquer visitante quais contas
têm consentimento de responsável (agora roda com o RLS de quem pergunta); a busca de perfis escapa curingas e não
lista perfis privados sem materiais; perfis privados não mostram conquistas nem data de entrada.

A fila de moderação (aprovar com XP e aviso ao autor, pedir ajustes, remover, resolver denúncias) entrou na Fase 7.

## Fase 6 — Engajamento ✅

| Item | Estado | Validação |
| --- | --- | --- |
| Página de conquistas: nível com XP para o próximo, sequência e recorde, meta do dia | pronto | navegador (desktop e 390 px) |
| Calendário de constância (4 semanas, dias com atividade e com meta cumprida) | pronto | navegador |
| Conquistas com progresso real (`my_achievements`) e data de desbloqueio | pronto | integração |
| Desafios semanais: 3 por semana em rodízio, metas ajustadas à meta diária, só atividade verificável, resgate idempotente | pronto | testes de unidade + integração + navegador |
| Liga semanal: posição, ranking só com quem permite, o próprio usuário sempre se vê | pronto | integração + navegador |
| Recomendações no painel: temas com mais erros, série, etapa, avaliação; exclui salvos; motivo visível | pronto | testes de unidade + navegador |

Antiabuso: XP só pelo servidor, com teto diário por atividade e um registro por evento; desafios usam só dados que
o usuário não grava diretamente (revisões, tentativas corrigidas pelo banco, sessões registradas pelo servidor);
tarefas do plano, autodeclaradas, não contam para desafios. Limitação conhecida: quizzes criados pela própria
pessoa contam (com o mínimo de 5 questões e os tetos diários de XP).

A virada semanal das ligas e o aviso de sequência em risco rodam nas rotinas agendadas da Fase 7
(`/api/cron/ligas` e `/api/cron/lembretes`), que precisam ser agendadas na hospedagem.

## Fase 7 — Monetização e administração ✅

| Item | Estado | Validação |
| --- | --- | --- |
| Página de assinatura: plano, situação, uso do período, comparação e histórico de consumo | pronto | navegador |
| Checkout e portal do Stripe (desligados sem credenciais; nenhuma cobrança simulada) | pronto, depende de credenciais | tipos; sem chamada real ao Stripe |
| Webhook com assinatura verificada, idempotência por evento e releitura da assinatura | pronto | integração com eventos assinados com segredo de teste e API simulada |
| Pro de cortesia (manual) e encerramento, com auditoria | pronto | integração |
| Área administrativa com papel lido do banco em cada página e ação | pronto | integração + navegador |
| Moderação (aprovar com XP e aviso, pedir ajustes, remover) e bloqueio de autoaprovação | pronto | integração + navegador |
| Denúncias (manter, arquivar, remover) com retorno ao ar do material escondido automaticamente | pronto | integração |
| Usuários: busca com e-mail só pela chave do servidor, suspensão com bloqueio de login, papéis | pronto | integração + navegador |
| Contato, matérias, configurações validadas e auditoria completa | pronto | integração + navegador |
| Rotinas: lembretes (no app e por e-mail), sequência em risco, limpeza, virada da liga idempotente | pronto | testes de unidade + integração |

**Não validado de ponta a ponta**: o pagamento real no Stripe (exige conta, preço e webhook configurados) e o envio
de e-mails pelo Resend. Os dois estão implementados e desligados até as credenciais existirem.

## Fase 8 — Qualidade ✅

| Item | Estado | Validação |
| --- | --- | --- |
| Ponta a ponta com Playwright em desktop e celular (Pixel 7), contra o build de produção | pronto | 26 testes |
| Acessibilidade: axe (WCAG 2.1 AA) em todas as páginas públicas e nas principais do app, sem rolagem lateral | pronto | e2e; corrigidos contraste, nomes acessíveis (WCAG 2.5.3), botões só com ícone e campos de arquivo sem rótulo |
| Links internos: todos os links das páginas públicas e do app seguidos atrás de 404 | pronto | e2e; corrigido um link morto no painel |
| Jornada do estudante: baralho, revisão até o fim, pasta e material | pronto | e2e |
| Proteção de rotas, redirecionamento aberto e página 404 | pronto | e2e |
| Auditoria automática do esquema: RLS, `search_path`, funções privilegiadas revisadas, views, escrita de clientes, colunas sensíveis, buckets | pronto | 9 testes; validada injetando 4 brechas (todas acusadas) |
| Endurecimento do banco: sem `TRUNCATE` para clientes, tabelas do servidor sem privilégio de escrita, preferências com colunas restritas | pronto | migração `20261028000300_security_review.sql` + auditoria |
| Login: limites por conta + IP, por conta (ataque distribuído) e por IP (alto, para escolas atrás de NAT) | pronto | testes de banco com a função real de rate limit |
| Busca de segredos no que vai para o navegador, ao fim de todo build | pronto | validada injetando uma chave falsa (acusada por valor e por formato) |
| Desempenho das páginas públicas: ~215 KB de JS comprimido, LCP ~1,0 s e CLS ≈ 0 no celular com 4G lento e CPU 4× | pronto | medição local no build de produção; login, cadastro e contato deixaram de carregar o cliente do Supabase e o zod (−98 KB no login) |
| CI no GitHub Actions: tipos, lint, unidade, banco do zero, build e e2e | pronto | arquivo versionado; a primeira execução depende do GitHub Actions habilitado no repositório |

**Limites desta validação**: o desempenho foi medido em localhost (sem latência real nem CDN) e não houve
auditoria com Lighthouse nem teste de carga. Os testes ponta a ponta rodam sem IA, Stripe e Resend
configurados: cobrem os estados "desligado" dessas integrações, não as chamadas reais.

## Integrações que dependem de credenciais

- **IA**: `ANTHROPIC_API_KEY` (ou provedor compatível). Sem chave, os recursos de IA ficam desativados com aviso.
- **E-mail transacional** (Resend): lembretes e convite a responsáveis.
- **Stripe**: assinatura Pro e webhooks.
- **Google OAuth**: precisa ser ativado no Supabase.
