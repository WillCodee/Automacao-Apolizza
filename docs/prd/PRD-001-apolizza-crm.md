# PRD-001 — Apolizza CRM: Sistema de Gestao de Cotacoes

## Metadata

| Campo | Valor |
|-------|-------|
| **PRD ID** | PRD-001 |
| **Titulo** | Apolizza CRM — Sistema Proprio de Gestao de Cotacoes e Renovacoes |
| **Autor** | @pm (Morgan) |
| **Status** | Em Desenvolvimento |
| **Criado em** | 2026-03-27 |
| **Prioridade** | Alta |
| **Tipo** | Brownfield (evolucao de sistema existente) |

---

## 1. Visao Geral

### 1.1 Problema

A corretora Apolizza hoje depende 100% do ClickUp como sistema de gestao de cotacoes. Essa dependencia gera:

- **Risco de plataforma:** Mudancas na API, limites de rate, alteracoes de plano podem paralisar a operacao
- **Custo crescente:** Licencas ClickUp escalam com a equipe
- **Limitacoes funcionais:** Campos obrigatorios por status, automacoes nativas e regras de negocio sao workarounds
- **Dados presos:** 3.279+ cotacoes e historico vivem no ClickUp — cancelar = perder tudo
- **Performance:** Dashboard puxa 33 paginas de API (3.279 tasks) a cada carregamento
- **Proxy obrigatorio:** CORS exige servidor Python intermediario

### 1.2 Solucao Proposta

Criar um **CRM especializado para corretora de seguros** que substitua o ClickUp como sistema de gestao de cotacoes. Nao e um "clone do ClickUp" — e um sistema vertical, otimizado para o fluxo de trabalho especifico de cotacao e renovacao de seguros.

### 1.3 Visao do Produto

> Um sistema web completo onde cotadores gerenciam cotacoes de seguros do inicio ao fim, com KPIs em tempo real, alertas automaticos e acompanhamento de metas — sem depender de ferramentas externas.

---

## 2. Contexto Atual (As-Is)

### 2.1 Stack Atual

| Componente | Tecnologia | Papel |
|-----------|-----------|-------|
| Frontend | `dashboard.html` (3.137 linhas, vanilla JS + Chart.js) | Dashboard SPA monolitico |
| Backend | `server.py` (Python proxy) | Resolve CORS com ClickUp API |
| Database | ClickUp API v2 | Armazenamento de todas as cotacoes |
| Automacoes | N8N Cloud (5 workflows) | Alertas e status automatico |
| Persistencia local | localStorage | Metas e perfis de cotadores |

### 2.2 Dados Existentes

- **3.279 tasks** na lista de Cotacoes (ID: 900701916229)
- **19 custom fields** mapeados
- **12+ status** diferentes no workflow
- **Space de Renovacao** separado (ID: 90070369721)

### 2.3 Funcionalidades Ja Implementadas (Dashboard v1)

| Funcionalidade | Story | Status |
|---------------|-------|--------|
| KPIs Financeiros (A Receber, Valor Perda, Conversao) | 1.1 | Implementado |
| Breakdown de Status por Cotacao | 1.2 | Implementado |
| Indicador de Campos Incompletos | 1.3 | Implementado |
| Auto Status ATRASADO (N8N) | 2.1 | Implementado |
| Alertas N8N (4 workflows) | 2.2 | Implementado |
| View de Alertas no Dashboard | 3.1 | Implementado |
| View de Metas da Corretora | 4.1 | Implementado |
| Cards de Desempenho por Cotador | 4.2 | Implementado |
| Busca rapida de cotacoes | — | Implementado |
| Mobile sidebar responsiva | — | Implementado |
| Auto-refresh 5 min | — | Implementado |
| Print/PDF styles | — | Implementado |

---

## 3. Solucao Proposta (To-Be)

### 3.1 Arquitetura Alvo

```
┌──────────────────────────────────────────────┐
│              FRONTEND + API                   │
│          Next.js 14 (App Router)              │
│     React 18 │ Server Components │ RSC        │
│         Deploy: Vercel (Free Tier)            │
├──────────────────────────────────────────────┤
│               AUTH LAYER                      │
│        Auth.js v5 + Credentials               │
│    Drizzle Adapter │ JWT Sessions             │
│   Middleware: protecao de rotas server-side   │
├──────────────────────────────────────────────┤
│              DATABASE                         │
│        Neon (PostgreSQL Serverless)            │
│   ORM: Drizzle │ Driver: @neondatabase/serverless │
│   Connection: WebSocket (otimizado serverless)│
├──────────────────────────────────────────────┤
│              STORAGE                          │
│           Vercel Blob (256MB free)             │
│        CDN automatico │ SDK nativo            │
├──────────────────────────────────────────────┤
│            AUTOMACOES                         │
│     N8N Cloud (5 workflows existentes)        │
│   Adaptados: ClickUp API → Neon SQL direto    │
├──────────────────────────────────────────────┤
│           NOTIFICACOES                        │
│    In-App (badges/toasts) + Email (Resend)    │
│          3.000 emails/mes gratis              │
└──────────────────────────────────────────────┘
```

### 3.1.1 Estrutura de Diretorios

```
apolizza-crm/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout com auth check
│   │   ├── page.tsx                # Redirect → /dashboard
│   │   ├── login/page.tsx          # Tela de login
│   │   ├── dashboard/page.tsx      # Dashboard principal
│   │   ├── cotacoes/
│   │   │   ├── page.tsx            # Lista de cotacoes
│   │   │   ├── new/page.tsx        # Criar cotacao
│   │   │   └── [id]/page.tsx       # Editar cotacao
│   │   ├── metas/page.tsx          # Metas e desempenho
│   │   ├── alertas/page.tsx        # View de alertas
│   │   ├── admin/
│   │   │   └── users/page.tsx      # Gestao de usuarios (admin only)
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── cotacoes/route.ts
│   │       ├── cotacoes/[id]/route.ts
│   │       ├── kpis/route.ts
│   │       └── metas/route.ts
│   ├── lib/
│   │   ├── db.ts                   # Drizzle + Neon connection
│   │   ├── schema.ts               # Drizzle schema (todas as tabelas)
│   │   └── auth.ts                 # Auth.js config
│   └── components/                 # Componentes React reutilizaveis
├── drizzle/
│   └── migrations/                 # SQL migrations versionadas
├── public/
│   └── dashboard-legacy.html       # Dashboard atual (fase transicao)
├── drizzle.config.ts
├── next.config.ts
└── package.json
```

### 3.2 Decisoes Tecnicas (Resolvidas por @architect)

| Decisao | Escolha | Justificativa |
|---------|---------|---------------|
| **Database** | Neon (PostgreSQL Serverless) | Escolha do cliente. Scale-to-zero, branching para dev, PostgreSQL nativo |
| **ORM** | Drizzle ORM + `@neondatabase/serverless` | Type-safe, leve, migrations nativas, WebSocket driver otimizado para serverless |
| **Auth** | Auth.js v5 + Drizzle Adapter + Credentials Provider | Integra nativamente com Next.js App Router, middleware server-side, JWT sessions |
| **Frontend** | Next.js 14+ (App Router) | API Routes integradas, middleware auth, Server Components, deploy unificado Vercel |
| **API** | Next.js API Routes (Route Handlers) | Zero infra separada, substitui server.py, serverless nativo |
| **Storage** | Vercel Blob (256MB free tier) | SDK nativo Next.js, CDN automatico, zero config. Fallback: Cloudflare R2 se crescer |
| **Deploy** | Vercel (frontend + API unificados) + Neon (DB) | Free tier generoso, deploy = git push, preview deploys por PR |
| **Automacoes** | N8N (manter 5 workflows) + cron interno | N8N ja configurado, adaptar de ClickUp API para Neon SQL direto |
| **Notificacoes** | In-App (badges/toasts) + Email (Resend, 3k/mes free) | In-app como MUST fase 1, email como SHOULD fase 2 |

### 3.3 Estrategia de Migracao

**Operacao paralela (dual-read):**

```
FASE 1-2: Dashboard le do Neon, ClickUp continua como backup
FASE 3:   Dashboard le/escreve no Neon, ClickUp somente leitura
FASE 4:   ClickUp desligado, Neon e a unica fonte
```

---

## 4. Modelo de Dados

### 4.1 Tabelas Principais

#### `users` — Usuarios do sistema

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | Identificador unico |
| email | VARCHAR(255) UNIQUE | Email de login |
| name | VARCHAR(255) | Nome completo |
| username | VARCHAR(100) UNIQUE | Username (match com ClickUp) |
| password_hash | TEXT | Senha hasheada (bcrypt) |
| role | ENUM('admin', 'cotador') | Papel no sistema |
| photo_url | TEXT | URL da foto de perfil |
| is_active | BOOLEAN DEFAULT true | Usuario ativo |
| created_at | TIMESTAMPTZ | Data de criacao |
| updated_at | TIMESTAMPTZ | Ultima atualizacao |

**Regra:** 3 usuarios com role `admin` tem acesso total. Cotadores veem apenas suas proprias cotacoes.

#### `cotacoes` — Cotacoes de seguros (substitui tasks do ClickUp)

| Coluna | Tipo | Campo ClickUp Original | Descricao |
|--------|------|----------------------|-----------|
| id | UUID (PK) | task.id | Identificador unico |
| clickup_id | VARCHAR(20) | task.id | ID original do ClickUp (migracao) |
| name | VARCHAR(500) | task.name | Nome do cliente / descricao da cotacao |
| status | VARCHAR(50) | task.status.status | Status atual do workflow |
| priority | VARCHAR(20) | task.priority | Prioridade (urgent, high, normal, low) |
| due_date | TIMESTAMPTZ | task.due_date | Data limite |
| assignee_id | UUID (FK → users) | task.assignees[0] | Cotador responsavel |
| tipo_cliente | VARCHAR(50) | TIPO CLIENTE | NOVO/CASA, NOVO, RENOVACAO |
| contato_cliente | VARCHAR(50) | CONTATO CLIENTE | Telefone do cliente |
| seguradora | VARCHAR(255) | SEGURADORA | Nome da seguradora |
| produto | VARCHAR(255) | PRODUTO | Tipo de produto (AUTO, SAUDE PF, etc.) |
| situacao | VARCHAR(50) | SITUACAO | IMPLANTACAO, COTAR, CLIENTE, RAUT, FECHADO, PERDA/RESGATE |
| indicacao | VARCHAR(255) | INDICACAO | Fonte de indicacao |
| inicio_vigencia | DATE | INICIO VIGENCIA | Data inicio da apolice |
| fim_vigencia | DATE | FIM VIGENCIA | Data fim da apolice |
| primeiro_pagamento | DATE | PRIMEIRO PAGAMENTO | Data do primeiro pagamento |
| parcelado_em | INTEGER | PARCELADO EM | Numero de parcelas |
| premio_sem_iof | DECIMAL(12,2) | PREMIO SEM IOF | Valor do premio sem IOF |
| comissao | DECIMAL(12,2) | COMISSAO | Valor da comissao |
| a_receber | DECIMAL(12,2) | A RECEBER | Valor a receber (lucro) |
| valor_perda | DECIMAL(12,2) | VALOR EM PERDA | Valor da perda |
| proxima_tratativa | DATE | PROXIMA TRATATIVA | Data da proxima tratativa |
| observacao | TEXT | OBSERVACAO | Observacoes livres |
| mes_referencia | VARCHAR(3) | MES | Mes de referencia (JAN-DEZ) |
| ano_referencia | INTEGER | ANO | Ano de referencia |
| tags | JSONB | task.tags | Tags da cotacao |
| is_renovacao | BOOLEAN DEFAULT false | — | Flag se e renovacao |
| created_at | TIMESTAMPTZ | task.date_created | Data de criacao |
| updated_at | TIMESTAMPTZ | task.date_updated | Ultima atualizacao |

#### `cotacao_docs` — Documentos anexados

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | Identificador unico |
| cotacao_id | UUID (FK → cotacoes) | Cotacao relacionada |
| file_name | VARCHAR(255) | Nome do arquivo |
| file_url | TEXT | URL do arquivo no storage |
| file_size | INTEGER | Tamanho em bytes |
| mime_type | VARCHAR(100) | Tipo MIME |
| uploaded_by | UUID (FK → users) | Quem enviou |
| created_at | TIMESTAMPTZ | Data de upload |

#### `metas` — Metas da corretora e individuais

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | Identificador unico |
| user_id | UUID (FK → users) NULL | NULL = meta global da corretora |
| ano | INTEGER | Ano da meta |
| mes | INTEGER (1-12) | Mes da meta |
| meta_valor | DECIMAL(12,2) | Meta em R$ |
| meta_qtd_cotacoes | INTEGER | Meta quantidade de cotacoes |
| meta_renovacoes | INTEGER | Meta de renovacoes |
| created_at | TIMESTAMPTZ | Data de criacao |
| updated_at | TIMESTAMPTZ | Ultima atualizacao |

**Constraint:** UNIQUE(user_id, ano, mes) — uma meta por usuario por mes.

#### `cotacao_history` — Historico de alteracoes (audit trail)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | Identificador unico |
| cotacao_id | UUID (FK → cotacoes) | Cotacao alterada |
| user_id | UUID (FK → users) | Quem alterou |
| field_name | VARCHAR(100) | Campo alterado |
| old_value | TEXT | Valor anterior |
| new_value | TEXT | Novo valor |
| changed_at | TIMESTAMPTZ | Quando mudou |

#### `status_config` — Configuracao de status e campos obrigatorios

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | Identificador unico |
| status_name | VARCHAR(50) UNIQUE | Nome do status |
| display_label | VARCHAR(100) | Label de exibicao |
| color | VARCHAR(7) | Cor hex (#27ae60) |
| icon | VARCHAR(10) | Emoji/icone |
| order_index | INTEGER | Ordem de exibicao |
| required_fields | JSONB | Array de campos obrigatorios |
| is_terminal | BOOLEAN DEFAULT false | Status terminal (fechado, perda) |

### 4.2 Views SQL (para KPIs)

```sql
-- View: KPIs financeiros do mes atual
CREATE VIEW vw_kpis_mensal AS
SELECT
  DATE_TRUNC('month', due_date) AS mes,
  COUNT(*) FILTER (WHERE status = 'fechado') AS qtd_fechadas,
  COUNT(*) FILTER (WHERE status = 'perda') AS qtd_perda,
  COUNT(*) AS total_cotacoes,
  SUM(a_receber) FILTER (WHERE status = 'fechado') AS total_a_receber,
  SUM(valor_perda) FILTER (WHERE status = 'perda') AS total_valor_perda,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'fechado')::DECIMAL /
    NULLIF(COUNT(*), 0) * 100, 1
  ) AS taxa_conversao
FROM cotacoes
GROUP BY DATE_TRUNC('month', due_date);

-- View: Desempenho por cotador
CREATE VIEW vw_desempenho_cotador AS
SELECT
  u.id AS user_id,
  u.name,
  u.username,
  u.photo_url,
  COUNT(c.id) AS total_cotacoes,
  COUNT(c.id) FILTER (WHERE c.status = 'fechado') AS fechadas,
  COUNT(c.id) FILTER (WHERE c.status = 'perda') AS perdas,
  SUM(c.a_receber) FILTER (WHERE c.status = 'fechado') AS faturamento,
  ROUND(
    COUNT(c.id) FILTER (WHERE c.status = 'fechado')::DECIMAL /
    NULLIF(COUNT(c.id), 0) * 100, 1
  ) AS taxa_conversao
FROM users u
LEFT JOIN cotacoes c ON c.assignee_id = u.id
WHERE u.role = 'cotador'
GROUP BY u.id, u.name, u.username, u.photo_url;
```

### 4.3 RLS (Row Level Security)

```sql
-- Cotadores veem apenas suas cotacoes
ALTER TABLE cotacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY cotador_own_cotacoes ON cotacoes
  FOR ALL
  USING (
    assignee_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins veem tudo
CREATE POLICY admin_all_cotacoes ON cotacoes
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## 5. Funcionalidades (Requisitos Funcionais)

### 5.1 Autenticacao e Autorizacao

| ID | Requisito | Prioridade |
|----|-----------|------------|
| FR-AUTH-01 | Login com email + senha | MUST |
| FR-AUTH-02 | 2 roles: admin (3 contas) e cotador (N contas) | MUST |
| FR-AUTH-03 | Admin acessa todas as cotacoes e configuracoes | MUST |
| FR-AUTH-04 | Cotador acessa apenas suas proprias cotacoes | MUST |
| FR-AUTH-05 | Sessao persistente (JWT + refresh token) | MUST |
| FR-AUTH-06 | Tela de login responsiva | MUST |
| FR-AUTH-07 | Admin pode criar/desativar usuarios | SHOULD |
| FR-AUTH-08 | Recuperacao de senha por email | COULD |

### 5.2 CRUD de Cotacoes

| ID | Requisito | Prioridade |
|----|-----------|------------|
| FR-CRUD-01 | Criar nova cotacao com todos os 19 campos | MUST |
| FR-CRUD-02 | Editar cotacao existente | MUST |
| FR-CRUD-03 | Validacao de campos obrigatorios por status | MUST |
| FR-CRUD-04 | Mudar status com validacao automatica | MUST |
| FR-CRUD-05 | Excluir cotacao (soft delete, somente admin) | SHOULD |
| FR-CRUD-06 | Formulario com campos tipados (date picker, currency mask, dropdown) | MUST |
| FR-CRUD-07 | Upload de documentos (DOCS field) | SHOULD |
| FR-CRUD-08 | Historico de alteracoes (audit trail) | SHOULD |
| FR-CRUD-09 | Duplicar cotacao existente | COULD |
| FR-CRUD-10 | Importacao em lote (CSV/Excel) | COULD |

### 5.3 Campos Obrigatorios por Status (Modulo 1 do Briefing)

| Status | Campos Obrigatorios |
|--------|-------------------|
| **Nao Iniciado** | Fim Vigencia, Inicio Vigencia, Indicacao, Produto, Seguradora, Situacao, Tipo de Cliente |
| **Fechado** | Comissao, Primeiro Pagamento, A Receber, Parcelado Em, Premio Sem IOF |
| **Perda** | Valor em Perda |

| ID | Requisito | Prioridade |
|----|-----------|------------|
| FR-VALID-01 | Bloquear mudanca de status se campos obrigatorios estao vazios | MUST |
| FR-VALID-02 | Mostrar quais campos estao faltando antes de permitir mudanca | MUST |
| FR-VALID-03 | Configuracao de campos obrigatorios editavel pelo admin | COULD |

### 5.4 Dashboard e KPIs (Modulo 2 do Briefing)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| FR-DASH-01 | KPIs no topo: A Receber, Valor Perda, Total Cotacoes, Taxa Conversao | MUST |
| FR-DASH-02 | Breakdown visual de status (pills coloridos) | MUST |
| FR-DASH-03 | Colunas Kanban: Atraso, Perda, Em Andamento, Fechado | MUST |
| FR-DASH-04 | Filtros: ano, mes, cotador, status, busca | MUST |
| FR-DASH-05 | Graficos: pizza status, barras mensal, barras por cotador | MUST |
| FR-DASH-06 | Indicador de campos incompletos | MUST |
| FR-DASH-07 | Auto-refresh periodico | SHOULD |
| FR-DASH-08 | Dados carregam do banco proprio (nao mais ClickUp) | MUST |

### 5.5 Alertas e Automacoes (Modulo 3 do Briefing)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| FR-ALERT-01 | View de alertas: atrasados, vencendo hoje, proximos 7 dias | MUST |
| FR-ALERT-02 | Auto-status ATRASADO quando due_date passa | MUST |
| FR-ALERT-03 | Alerta prazo diario 15h/16h | SHOULD |
| FR-ALERT-04 | Alerta fim de vigencia | SHOULD |
| FR-ALERT-05 | Alerta proxima tratativa | SHOULD |
| FR-ALERT-06 | Notificacao in-app (badge na sidebar) | MUST |
| FR-ALERT-07 | Notificacao por email | COULD |
| FR-ALERT-08 | Notificacao Telegram/WhatsApp | COULD |

### 5.6 Metas e Desempenho (Modulo 4 do Briefing)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| FR-META-01 | Meta global da corretora (valor R$, qtd cotacoes, renovacoes) | MUST |
| FR-META-02 | Meta individual por cotador | MUST |
| FR-META-03 | Barras de progresso com % atingimento | MUST |
| FR-META-04 | Cards por cotador (foto, nome, metricas) | MUST |
| FR-META-05 | Seletor de mes para metas | MUST |
| FR-META-06 | Grafico de evolucao mensal | SHOULD |
| FR-META-07 | Exportar resumo de metas | SHOULD |
| FR-META-08 | Metas persistidas no banco (nao localStorage) | MUST |

### 5.7 Renovacoes

| ID | Requisito | Prioridade |
|----|-----------|------------|
| FR-RENOV-01 | View separada para renovacoes | MUST |
| FR-RENOV-02 | Flag `is_renovacao` na cotacao | MUST |
| FR-RENOV-03 | Filtro de situacao especifico (COTAR, IMPLANTACAO, etc.) | MUST |
| FR-RENOV-04 | KPIs especificos de renovacao | SHOULD |

---

## 6. Requisitos Nao Funcionais

| ID | Requisito | Meta |
|----|-----------|------|
| NFR-01 | Tempo de carregamento inicial | < 2s (vs 10-15s atual com ClickUp API) |
| NFR-02 | Tempo de resposta de API | < 200ms para queries simples |
| NFR-03 | Disponibilidade | 99.5% (Neon + Vercel SLA) |
| NFR-04 | Dados de 3.279+ cotacoes migrados | 100% sem perda |
| NFR-05 | Compatibilidade mobile | Responsivo, funcional em celular |
| NFR-06 | Seguranca | HTTPS, bcrypt, JWT, RLS |
| NFR-07 | Backup | Neon point-in-time recovery |
| NFR-08 | Custo mensal | < R$50 (free tier Neon + Vercel) |

---

## 7. Migracao de Dados

### 7.1 Plano de Migracao

| Etapa | Acao | Risco |
|-------|------|-------|
| 1 | Criar schema no Neon | Baixo |
| 2 | Script de extracao: ClickUp API → JSON | Baixo |
| 3 | Script de transformacao: JSON → SQL INSERT | Medio (mapeamento de campos) |
| 4 | Migrar users (assignees do ClickUp → tabela users) | Baixo |
| 5 | Migrar cotacoes (3.279 tasks → tabela cotacoes) | Medio |
| 6 | Migrar renovacoes (space separado) | Medio |
| 7 | Validar contagens e somas | Critico |
| 8 | Periodo de operacao paralela (1-2 semanas) | Baixo |
| 9 | Desligar ClickUp | Baixo (apos validacao) |

### 7.2 Mapeamento de Migracao

```
ClickUp task.id          → cotacoes.clickup_id
ClickUp task.name        → cotacoes.name
ClickUp task.status      → cotacoes.status (normalizar lowercase)
ClickUp task.priority    → cotacoes.priority
ClickUp task.due_date    → cotacoes.due_date (ms → timestamp)
ClickUp task.assignees   → cotacoes.assignee_id (lookup users por username)
ClickUp FIELD_*          → cotacoes.campo_correspondente
ClickUp task.date_created → cotacoes.created_at
```

---

## 8. Roadmap de Execucao

### Fase 0 — Fundacao (Semana 1)
> Setup do ambiente, banco de dados e autenticacao

| Story | Descricao | Prioridade |
|-------|-----------|------------|
| 0.1 | Setup Neon + Drizzle ORM + schema inicial | MUST |
| 0.2 | Auth: login, roles (admin/cotador), JWT | MUST |
| 0.3 | API base: endpoints REST para cotacoes | MUST |
| 0.4 | Tela de login no frontend | MUST |

### Fase 1 — CRUD + Migracao (Semanas 2-3)
> Sistema funcional de cadastro com dados reais

| Story | Descricao | Prioridade |
|-------|-----------|------------|
| 1.1 | Formulario de criacao de cotacao (19 campos) | MUST |
| 1.2 | Formulario de edicao de cotacao | MUST |
| 1.3 | Validacao de campos obrigatorios por status | MUST |
| 1.4 | Script de migracao ClickUp → Neon | MUST |
| 1.5 | Migrar 3.279 cotacoes + validar | MUST |

### Fase 2 — Dashboard Proprio (Semanas 3-4)
> Dashboard consumindo dados do Neon

| Story | Descricao | Prioridade |
|-------|-----------|------------|
| 2.1 | Adaptar dashboard.html para consumir API propria | MUST |
| 2.2 | KPIs calculados por views SQL (performance) | MUST |
| 2.3 | Metas persistidas no banco (migrar de localStorage) | MUST |
| 2.4 | Upload de documentos (storage) | SHOULD |

### Fase 3 — Automacoes + Polish (Semanas 4-5)
> Alertas, automacoes e refinamentos

| Story | Descricao | Prioridade |
|-------|-----------|------------|
| 3.1 | Adaptar N8N workflows para consultar Neon | MUST |
| 3.2 | Cron job: auto-status ATRASADO | MUST |
| 3.3 | Audit trail (historico de alteracoes) | SHOULD |
| 3.4 | Admin: gestao de usuarios | SHOULD |

### Fase 4 — Desligamento ClickUp (Semana 6)
> Cortar dependencia

| Story | Descricao | Prioridade |
|-------|-----------|------------|
| 4.1 | Periodo de operacao paralela (validacao) | MUST |
| 4.2 | Remover codigo ClickUp do dashboard | MUST |
| 4.3 | Documentacao final do sistema | SHOULD |

---

## 9. Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| Perda de dados na migracao | Baixa | Critico | Script com validacao de contagem + backup pre-migracao |
| Neon fora do ar | Muito Baixa | Alto | Point-in-time recovery, monitoramento |
| Equipe resiste a mudanca | Media | Medio | Operacao paralela, treinamento, UI familiar |
| Escopo cresce (feature creep) | Alta | Medio | PRD como contrato, MVP primeiro |
| Performance com volume crescente | Baixa | Medio | Views SQL, indices, paginacao server-side |
| Auth/seguranca | Baixa | Critico | Usar lib madura (Auth.js), RLS no Neon |

---

## 10. Metricas de Sucesso

| Metrica | Alvo | Como medir |
|---------|------|-----------|
| Tempo de carregamento | < 2s (vs 10-15s atual) | Performance profiling |
| Dados migrados | 100% (3.279 cotacoes) | Contagem + soma financeira |
| Uptime | 99.5% | Monitoring |
| Adocao pela equipe | 100% em 2 semanas | Tracking de uso |
| Custo mensal | < R$50 | Dashboard Neon + Vercel |
| Bugs criticos pos-lancamento | 0 | Issue tracking |

---

## 11. Fora de Escopo (v1)

- App mobile nativo (web responsivo e suficiente)
- Integracao com seguradoras (cotacao automatica)
- Chat interno / comentarios em cotacoes
- Relatorios PDF automaticos
- Multi-corretora (SaaS)
- Integracao contabil/fiscal

---

## 12. Decisoes Resolvidas

| # | Decisao | Escolha | Justificativa | Resolvido por |
|---|---------|---------|---------------|---------------|
| D1 | Framework frontend | **Next.js 14+ (App Router)** | Auth middleware server-side, API Routes integradas, deploy Vercel unificado. Migracao gradual do dashboard.html | @architect |
| D2 | Auth library | **Auth.js v5 + Drizzle Adapter** | Integracao nativa Next.js, Credentials Provider para email+senha, JWT sessions. Lucia descontinuada em Mar/2025 | @architect |
| D3 | Storage para documentos | **Vercel Blob** (256MB free) | Zero config, SDK nativo, CDN automatico. Fallback: Cloudflare R2 se crescer | @architect |
| D4 | Canal de notificacao | **In-App + Email (Resend)** | In-app MUST (fase 1), Email SHOULD (fase 2, 3k/mes gratis). Telegram como COULD futuro | @architect |
| D5 | Hosting da API | **Vercel Serverless** | Deploy = git push, Edge Functions para auth (0ms cold start), integracao nativa Neon via WebSocket | @architect |

---

## 13. Dropdown Values (referencia para implementacao)

### TIPO CLIENTE
- NOVO/CASA
- NOVO
- RENOVACAO

### SITUACAO
- IMPLANTACAO
- COTAR
- CLIENTE
- RAUT
- FECHADO
- PERDA/RESGATE

### STATUS (workflow)
- nao iniciado
- em andamento
- fechado
- perda
- atrasado
- pendencia
- implantando
- venda parada
- aguardando
- aprovado
- cancelado
- em analise

### PRODUTO (49 opcoes)
AUTO, SAUDE PF, VIDA PJ, RESIDENCIAL, EMPRESARIAL, RESPONSABILIDADE CIVIL, TRANSPORTE, CONDOMINIO, EQUIPAMENTOS, RURAL, GARANTIA, FIANCA LOCATICIA, VIAGEM, PET, BIKE, CELULAR, ODONTO, PREVIDENCIA, CAPITALIZACAO, CONSORCIO, e outros.

### ANO
2024, 2025, 2026, 2027

### MES
JAN, FEV, MAR, ABR, MAI, JUN, JUL, AGO, SET, OUT, NOV, DEZ

---

## 14. Status de Implementacao (atualizado 2026-03-28)

### Fase 0 — Fundacao: CONCLUIDA

| Story | Descricao | Status |
|-------|-----------|--------|
| 5.1 | Setup Neon + Drizzle ORM + schema (6 tabelas) | DONE |
| 5.2 | Auth.js v5 + login + roles (admin/cotador) + proxy middleware | DONE |
| 5.3 | API REST cotacoes (CRUD completo + paginacao + filtros) | DONE |
| 5.4 | Tela de login frontend (dark gradient, Poppins, Apolizza brand) | DONE |

### Fase 1 — CRUD + Migracao: PARCIALMENTE CONCLUIDA

| Story | Descricao | Status |
|-------|-----------|--------|
| 6.1 | Formulario de criacao de cotacao (19 campos tipados) | DONE |
| 6.2 | Formulario de edicao de cotacao | DONE |
| 6.3 | Validacao de campos obrigatorios por status (status_config) | DONE |
| 6.4 | Script de migracao ClickUp → Neon (3.279 cotacoes) | PENDENTE |
| 6.5 | Execucao da migracao + validacao de integridade | PENDENTE |

### Fase 2 — Dashboard Proprio: CONCLUIDA

| Story | Descricao | Status |
|-------|-----------|--------|
| 7.1 | Dashboard consumindo API propria (Neon, nao mais ClickUp) | DONE |
| 7.2 | KPIs calculados por 4 views SQL (vw_kpis, vw_status_breakdown, vw_cotadores, vw_monthly_trend) | DONE |
| 7.3 | Metas persistidas no banco (API /api/metas, MetasCard com barras de progresso) | DONE |
| 7.4 | Upload de documentos (Vercel Blob, /api/cotacoes/[id]/docs) | DONE |

### Fase 3 — Automacoes + Polish: PARCIALMENTE CONCLUIDA

| Story | Descricao | Status |
|-------|-----------|--------|
| 8.1 | Adaptar N8N workflows para consultar Neon | PENDENTE |
| 8.2 | Cron job: auto-status ATRASADO (/api/cron/atrasados) | DONE |
| 8.3 | Audit trail — historico de alteracoes (field-level tracking) | DONE |
| 8.4 | Admin: gestao de usuarios (criar/editar/desativar) | DONE |

### Fase 4 — Desligamento ClickUp: NAO INICIADA

| Story | Descricao | Status |
|-------|-----------|--------|
| 9.1 | Periodo de operacao paralela (dual-read, validacao) | PENDENTE |
| 9.2 | Remover codigo ClickUp do dashboard | PENDENTE |
| 9.3 | Documentacao final do sistema | PENDENTE |

### Extras Realizados (fora do PRD original)

| Item | Descricao | Status |
|------|-----------|--------|
| UX Overhaul | Identidade visual Apolizza aplicada em todos os componentes (Poppins, #03a4ed, #ff695f, gradients, dark header) | DONE |
| Seed Demo | 10 cotacoes realistas para apresentacao a diretoria | DONE |
| Login flexivel | Login aceita username OU email | DONE |

### O que falta fazer (proxima sessao)

1. **Story 6.4 + 6.5 — Migracao ClickUp → Neon** (3.279 cotacoes)
   - Script que puxa dados da API ClickUp, transforma e insere no Neon
   - Validacao de contagem e somas financeiras
   - Mapeamento de assignees para users existentes

2. **Story 8.1 — Adaptar N8N workflows**
   - Os 5 workflows existentes no N8N Cloud precisam trocar de ClickUp API para queries SQL diretas no Neon
   - Workflows: alerta prazo, alerta vigencia, alerta tratativa, status atrasado, resumo diario

3. **Story 9.1 — Operacao paralela**
   - Periodo de 1-2 semanas onde ambos (ClickUp e Neon) rodam juntos
   - Validacao cruzada de dados

4. **Story 9.2 — Remover codigo ClickUp**
   - Limpar server.py, dashboard.html legacy, referencias a API ClickUp
   - Manter apenas o CRM proprio

5. **Story 9.3 — Documentacao**
   - Documentar o sistema final, credenciais, como fazer deploy, etc.

6. **Melhorias visuais pendentes (nice to have):**
   - Kanban board na lista de cotacoes
   - Notificacoes in-app (badges)
   - Exportar resumo de metas (PDF/Excel)
   - Recuperacao de senha por email (Resend)
   - View separada de renovacoes

---

## Change Log

| Data | Versao | Descricao | Autor |
|------|--------|-----------|-------|
| 2026-03-27 | 0.1 | PRD Draft — estrutura completa | @pm (Morgan) |
| 2026-03-27 | 0.2 | Decisoes tecnicas resolvidas (D1-D5) — Next.js, Auth.js, Vercel Blob, Resend, Vercel | @architect (Aria) |
| 2026-03-28 | 0.3 | Implementacao Fases 0-3 (parcial), UX overhaul com identidade Apolizza | @dev (Dex) |

---

*— Morgan, planejando o futuro*
