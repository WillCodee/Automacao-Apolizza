# PRD-010 — Solicitacoes da Diretoria (Abril 2026)

**Status:** Analise Concluida
**Data:** 2026-04-20
**Origem:** Diretoria Apolizza
**Analista:** Morgan (@pm)

---

## Contexto

A diretoria enviou uma lista de solicitacoes cobrindo 7 areas do CRM. Abaixo, cada item foi analisado contra o estado atual do sistema, categorizado por tipo (bug fix, melhoria, feature nova, teste/validacao) e priorizado.

---

## 1. Tela de Inicio

| # | Solicitacao | Tipo | Estado Atual | Acao Necessaria |
|---|-------------|------|--------------|-----------------|
| 1.1 | Testar rotas e mudanca de status das tarefas | Teste | Funcional — status Pendente/Em Andamento/Concluida/Cancelada ja implementados via `/api/tarefas/[id]/status` | **QA:** Roteiro de teste manual/automatizado |
| 1.2 | Marcacao de conclusao de tarefas | Teste | Funcional — checklist em `/api/tarefas/[id]/checklist` | **QA:** Validar que conclusao atualiza metricas |
| 1.3 | Troca para salvar foto no icone de perfil | Bug/UX | Endpoint existe (`/api/users/[id]/photo` POST) — suporta JPG/PNG/WebP ate 5MB via Vercel Blob | **Investigar:** Se o frontend esta chamando o endpoint corretamente. Pode ser bug de UI (botao nao aparece ou nao salva) |

**Prioridade:** Media — funcionalidades existem, precisa validacao e possivel fix de UX.

---

## 2. Dashboard

| # | Solicitacao | Tipo | Estado Atual | Acao Necessaria |
|---|-------------|------|--------------|-----------------|
| 2.1 | Validar precisao dos dados (metas, status, cotacoes, perdas, valores) | Teste/Bug | Acabamos de aplicar PRD-009 (normalizacao de tipos MySQL) — todos os campos DECIMAL agora retornam `number` | **QA:** Validar com dados reais que KPIs, status breakdown, monthly trend e cotadores exibem valores corretos. Comparar com query direta no MySQL |

**Prioridade:** Alta — acabou de ser refatorado (PRD-009), precisa validacao imediata.

---

## 3. Cotacoes

| # | Solicitacao | Tipo | Estado Atual | Acao Necessaria |
|---|-------------|------|--------------|-----------------|
| 3.1 | Arrumar visualizacao de exportacao CSV | Bug | Endpoint `/api/cotacoes/export` existe e funciona com BOM UTF-8 para Excel PT-BR | **Investigar:** Qual o bug especifico? Encoding? Campos faltando? Layout? |
| 3.2 | Exportacao em PDF | Feature Nova | **NAO EXISTE** — apenas CSV disponivel | **Desenvolver:** Gerar PDF com layout profissional (usar `@react-pdf/renderer` ou `puppeteer`) |
| 3.3 | Edicoes registradas no historico | Teste | Funcional — audit trail field-level em `/api/cotacoes/[id]/history` com old/new values | **QA:** Validar que TODOS os campos editaveis geram registro no historico |
| 3.4 | Datas de entrega automaticas (por produto/cliente) | Feature Nova/Melhoria | **NAO EXISTE** — nao ha logica de data de entrega automatica baseada em produto ou tipo de cliente | **Spec necessaria:** Definir regras (ex: Auto 7 dias, Vida 15 dias, Saude 10 dias?) |

**Prioridade:** Alta — PDF e datas automaticas sao features novas que precisam de spec.

---

## 4. Novo Pedido

| # | Solicitacao | Tipo | Estado Atual | Acao Necessaria |
|---|-------------|------|--------------|-----------------|
| 4.1 | Link publico para cotacoes rapidas sem login | Melhoria | **PARCIALMENTE EXISTE** — `/api/pedido` POST aceita dados sem auth, mas nao ha pagina frontend publica | **Desenvolver:** Criar pagina `/pedido` (ou `/solicitar`) publica com formulario. Corrigir seguranca (AUDIT-001 C1: adicionar CAPTCHA + rate limit) |
| 4.2 | Cotacoes caem direto no sistema para o responsavel | Melhoria | Parcial — cria cotacao com status "nao iniciado" mas nao atribui responsavel automaticamente | **Spec necessaria:** Regra de atribuicao automatica (round-robin? por produto? por grupo?) |
| 4.3 | Notificacao no Telegram | Teste | Funcional — ja envia notificacao via Telegram ao criar pedido | **QA:** Validar que notificacao chega com dados corretos |

**Prioridade:** Alta — link publico e a feature principal pedida. Seguranca e critica (ver AUDIT-001 C1).

---

## 5. Tarefas

| # | Solicitacao | Tipo | Estado Atual | Acao Necessaria |
|---|-------------|------|--------------|-----------------|
| 5.1 | Testar rota do dashboard de metricas | Teste | Funcional — `/api/tarefas/metricas` retorna KPIs via view SQL `vw_tarefas_metricas` | **QA:** Validar que a view existe no MySQL, que os dados batem, e que o frontend consome corretamente |

**Prioridade:** Baixa — e teste de funcionalidade existente.

---

## 6. Administracao e Auditoria

| # | Solicitacao | Tipo | Estado Atual | Acao Necessaria |
|---|-------------|------|--------------|-----------------|
| 6.1 | Melhorar impressao/exportacao de relatorios gerenciais | Melhoria | `/api/relatorios` retorna dados. Frontend em `/relatorios`. Nao ha funcao de impressao/PDF dedicada | **Desenvolver:** Botao "Imprimir" com CSS print-friendly + opcao de exportar PDF |
| 6.2 | Reenvio de e-mails pela hospedagem atual | Feature Nova | Usa Resend API (resend.com), nao o SMTP da HostGator | **Decisao:** Continuar com Resend ou migrar para SMTP HostGator? Resend e mais confiavel para serverless |
| 6.3 | Mensagem HTML caso Telegram falhe | Melhoria | `.catch(() => {})` silencia falhas do Telegram (AUDIT-001 L2) | **Desenvolver:** Fallback: se Telegram falhar, enviar email HTML como backup |
| 6.4 | Validar CRONs (8h e 15h) | Teste | CRONs configurados em `vercel.json`: manha 11:00 UTC (08:00 BRT) e tarde 18:00 UTC (15:00 BRT) | **QA:** Verificar logs na Vercel que CRONs estao executando nos horarios corretos |
| 6.5 | Tema claro/escuro | Teste | Funcional — 5 temas de cor + light/dark mode via CSS vars + localStorage | **QA:** Testar em todas as paginas que o dark mode nao quebra layout |
| 6.6 | Edicao de usuarios nao esta salvando | Bug | Endpoint PUT `/api/users/[id]` parece funcional no backend | **Investigar:** Bug provavelmente no frontend — form nao enviando PUT ou nao mostrando feedback de sucesso |
| 6.7 | Edicao de status nao esta salvando | Bug | Endpoint PUT `/api/status-config/[id]` parece funcional no backend | **Investigar:** Mesmo pattern — verificar frontend |

**Prioridade:** Alta — bugs 6.6/6.7 afetam operacao diaria. Fallback email (6.3) e importante para confiabilidade.

---

## 7. Responsividade e TV

| # | Solicitacao | Tipo | Estado Atual | Acao Necessaria |
|---|-------------|------|--------------|-----------------|
| 7.1 | Melhorar layout para notebooks/desktops/celulares/tablets | Melhoria | Tailwind responsive ja implementado (sm/md/lg breakpoints) mas pode precisar de ajustes finos | **Desenvolver:** Audit de responsividade em cada pagina, ajustar breakpoints problematicos |
| 7.2 | Painel TV (3 partes: cotacoes, grupos, graficos de metas) | Feature Nova | **NAO EXISTE** | **Desenvolver:** Pagina `/tv` fullscreen com 3 paineis, auto-refresh, sem interacao. Layout otimizado para 1920x1080 |

**Prioridade:** Media (responsividade) / Alta (painel TV — visibilidade para diretoria).

---

## Resumo Consolidado

### Por Tipo

| Tipo | Qtd | IDs |
|------|-----|-----|
| Feature Nova | 4 | 3.2 (PDF), 3.4 (datas auto), 7.2 (painel TV), 6.2 (email SMTP) |
| Melhoria | 5 | 4.1 (link publico), 4.2 (atribuicao auto), 6.1 (impressao), 6.3 (fallback email), 7.1 (responsividade) |
| Bug Fix | 3 | 1.3 (foto perfil), 6.6 (edicao usuarios), 6.7 (edicao status) |
| Teste/QA | 7 | 1.1, 1.2, 2.1, 3.3, 4.3, 5.1, 6.4, 6.5 |
| **Total** | **19** | |

### Priorizacao Recomendada (Waves)

#### Wave 1 — Bugs e Validacao (imediato)

| ID | Item | Justificativa |
|----|------|---------------|
| 6.6 | Fix edicao de usuarios | Bloqueia operacao diaria |
| 6.7 | Fix edicao de status | Bloqueia operacao diaria |
| 1.3 | Fix foto de perfil | Pedido direto da diretoria |
| 2.1 | Validar dados dashboard | Pos PRD-009, precisa confirmacao |
| 3.1 | Fix exportacao CSV | Bug reportado |

#### Wave 2 — Features Criticas + Seguranca

| ID | Item | Justificativa |
|----|------|---------------|
| 4.1 | Pagina publica de pedido + CAPTCHA + rate limit | Pedido da diretoria + AUDIT-001 C1/C2/C3 |
| 3.2 | Exportacao PDF | Gap funcional importante |
| 6.3 | Fallback Telegram → Email | Confiabilidade de notificacoes |
| 6.1 | Impressao de relatorios | Pedido da diretoria |

#### Wave 3 — Features Novas

| ID | Item | Justificativa |
|----|------|---------------|
| 7.2 | Painel TV | Alta visibilidade para diretoria |
| 3.4 | Datas de entrega automaticas | Precisa spec de regras |
| 4.2 | Atribuicao automatica de responsavel | Precisa spec de regras |

#### Wave 4 — Polish e QA

| ID | Item | Justificativa |
|----|------|---------------|
| 7.1 | Audit de responsividade | Melhoria incremental |
| 6.5 | Teste dark mode | QA em todas as paginas |
| 1.1, 1.2, 3.3, 4.3, 5.1, 6.4 | Testes diversos | Roteiro de QA completo |

---

## Dependencias com Auditorias Anteriores

| Item PRD-010 | Relacao com AUDIT-001 |
|--------------|----------------------|
| 4.1 (link publico) | C1 (endpoint aberto), C3 (blob publico), H5 (rate limiting) |
| 6.3 (fallback email) | L2 (.catch vazio silenciando falhas Telegram) |
| 6.6/6.7 (edicao nao salva) | H2 (falta Zod validation nos PUTs) |

## Decisoes Pendentes para Diretoria

1. **Regras de data de entrega automatica (3.4):** Quais prazos por produto? (ex: Auto 7d, Vida 15d?)
2. **Atribuicao automatica de pedidos (4.2):** Round-robin entre cotadores? Por produto? Por grupo?
3. **Email (6.2):** Manter Resend ou migrar para SMTP HostGator?
4. **Painel TV (7.2):** Quais metricas exatas nos 3 paineis? Auto-refresh a cada quantos segundos?
