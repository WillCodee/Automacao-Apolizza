# PRD-001 — Apolizza CRM: Sistema de Gestao de Cotacoes

## Metadata

| Campo | Valor |
|-------|-------|
| **PRD ID** | PRD-001 |
| **Titulo** | Apolizza CRM — Sistema Proprio de Gestao de Cotacoes e Renovacoes |
| **Autor** | @pm (Morgan) |
| **Status** | Producao (v1.0) |
| **Criado em** | 2026-03-27 |
| **Deploy** | https://apolizza-crm.vercel.app |
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
| Automacoes | ~~N8N Cloud~~ → Vercel Cron + Resend | Alertas e status automatico (N8N eliminado) |
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

### 3.1 Arquitetura Implementada

```
┌──────────────────────────────────────────────┐
│              FRONTEND + API                   │
│        Next.js 16.2.1 (App Router)            │
│    React 19 │ Server Components │ Turbopack   │
│         Deploy: Vercel (Production)           │
│   9 paginas │ 21 API routes │ 21 componentes  │
├──────────────────────────────────────────────┤
│               AUTH LAYER                      │
│     Auth.js v5 + Credentials Provider         │
│   JWT Sessions │ Login por username OU email   │
│   proxy.ts: protecao de rotas server-side     │
├──────────────────────────────────────────────┤
│              DATABASE                         │
│     Neon PostgreSQL (sa-east-1 Serverless)    │
│   ORM: Drizzle │ Driver: neon-http            │
│   7 tabelas │ 4 SQL Views │ Zod v4 validacao  │
├──────────────────────────────────────────────┤
│              STORAGE                          │
│           Vercel Blob (256MB free)             │
│        CDN automatico │ SDK nativo            │
├──────────────────────────────────────────────┤
│            AUTOMACOES                         │
│     Vercel Cron Jobs (2 jobs nativos)         │
│   /api/cron/atrasados (a cada 6h)            │
│   /api/cron/alertas (diario 9h BRT)          │
│   Email: Resend SDK (3k/mes free)            │
├──────────────────────────────────────────────┤
│           SEGURANCA (Epic 1)                  │
│  Try-catch todas routes │ Zod enum validation  │
│  SQL injection fix │ DB transactions           │
│  Security headers │ Promise.all parallelism    │
└──────────────────────────────────────────────┘
```

### 3.1.1 Estrutura de Diretorios (Implementada)

```
apolizza-crm/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout (Poppins font, globals)
│   │   ├── page.tsx                      # Redirect → /dashboard
│   │   ├── login/page.tsx                # Tela de login (dark gradient)
│   │   ├── dashboard/page.tsx            # Dashboard com KPIs
│   │   ├── cotacoes/
│   │   │   ├── page.tsx                  # Lista/Kanban toggle
│   │   │   ├── new/page.tsx              # Criar cotacao
│   │   │   ├── [id]/page.tsx             # Detalhe cotacao
│   │   │   ├── [id]/edit/page.tsx        # Editar cotacao
│   │   │   └── print/page.tsx            # PDF/impressao
│   │   ├── renovacoes/page.tsx           # View renovacoes c/ alertas
│   │   ├── calendario/page.tsx           # Calendario mensal
│   │   ├── relatorios/page.tsx           # Relatorio gerencial (admin)
│   │   ├── usuarios/page.tsx             # Gestao usuarios (admin)
│   │   ├── status-config/page.tsx        # Config status (admin)
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── cotacoes/route.ts         # CRUD list + create
│   │       ├── cotacoes/[id]/route.ts    # GET/PUT/DELETE
│   │       ├── cotacoes/[id]/docs/route.ts    # Upload docs
│   │       ├── cotacoes/[id]/history/route.ts # Audit trail
│   │       ├── cotacoes/bulk/route.ts    # Bulk operations
│   │       ├── cotacoes/export/route.ts  # CSV export
│   │       ├── cotacoes/import/route.ts  # CSV import
│   │       ├── cotacoes/seguradoras/route.ts  # Distinct values
│   │       ├── dashboard/route.ts        # KPIs + views SQL
│   │       ├── calendario/route.ts       # Eventos do mes
│   │       ├── relatorios/route.ts       # Relatorio gerencial
│   │       ├── renovacoes/route.ts       # Renovacoes c/ alertas
│   │       ├── comissao-tabela/route.ts  # Tabela % comissao
│   │       ├── kpis/route.ts             # KPIs simplificado
│   │       ├── metas/route.ts            # CRUD metas
│   │       ├── status-config/route.ts    # GET all status
│   │       ├── status-config/[id]/route.ts # PUT status config
│   │       ├── users/route.ts            # CRUD users
│   │       ├── users/[id]/route.ts       # GET/PUT user
│   │       ├── cron/atrasados/route.ts   # Auto-status atrasado
│   │       └── cron/alertas/route.ts    # Alertas consolidado (vigencia+tratativa+prazo+resumo)
│   ├── components/
│   │   ├── app-header.tsx                # Header c/ nav + hamburger
│   │   ├── cotacao-form.tsx              # Form 19 campos + auto-comissao
│   │   ├── cotacao-history.tsx           # Timeline audit trail
│   │   ├── cotacoes-list.tsx             # Tabela + mobile cards + bulk
│   │   ├── cotacoes-view.tsx             # Toggle lista/kanban
│   │   ├── kanban-board.tsx              # Kanban drag & drop
│   │   ├── renovacoes-list.tsx           # Tabela + mobile cards
│   │   ├── users-list.tsx                # Tabela + mobile cards
│   │   ├── status-config-list.tsx        # Config status inline
│   │   ├── relatorio-mensal.tsx          # Relatorio c/ Chart.js
│   │   ├── calendario-mensal.tsx         # Grid mensal + mobile
│   │   ├── csv-import-modal.tsx          # Import CSV modal
│   │   ├── docs-upload.tsx               # Upload documentos
│   │   ├── sign-out-button.tsx           # Logout
│   │   └── dashboard/
│   │       ├── dashboard-content.tsx     # Layout dashboard
│   │       ├── kpi-cards.tsx             # 8 KPIs responsivos
│   │       ├── cotadores-table.tsx       # Cards c/ foto + metricas
│   │       ├── metas-card.tsx            # Metas c/ progress bars
│   │       ├── monthly-chart.tsx         # Grafico tendencia
│   │       ├── recent-cotacoes.tsx       # Ultimas cotacoes
│   │       └── status-breakdown.tsx      # Breakdown por status
│   ├── lib/
│   │   ├── db.ts                         # Drizzle + neon-http
│   │   ├── schema.ts                     # 7 tabelas + relations
│   │   ├── auth.ts                       # Auth.js v5 config
│   │   ├── auth-helpers.ts               # getCurrentUser()
│   │   ├── api-helpers.ts                # apiSuccess/apiError + validators
│   │   ├── validations.ts               # Zod schemas (create/update)
│   │   ├── status-validation.ts          # Campos obrigatorios por status
│   │   └── constants.ts                  # Enums, options, listas
│   ├── proxy.ts                          # Auth middleware (protecao rotas)
│   └── types/next-auth.d.ts              # Type augmentation
├── scripts/
│   ├── create-views.ts                   # 4 SQL views
│   ├── seed-admin-users.ts               # 3 admins
│   ├── seed-demo.ts                      # 10 cotacoes demo
│   ├── seed-status-config.ts             # 12 status
│   ├── migrate-clickup.ts               # Migracao ClickUp → Neon
│   └── verify-migration.ts              # Validacao migracao
├── drizzle/migrations/                   # SQL migrations versionadas
├── data/                                 # Backup migracao
├── drizzle.config.ts
├── next.config.ts                        # Security headers
└── package.json
```

### 3.2 Decisoes Tecnicas (Resolvidas por @architect)

| Decisao | Escolha | Justificativa |
|---------|---------|---------------|
| **Database** | Neon (PostgreSQL Serverless) | Escolha do cliente. Scale-to-zero, branching para dev, PostgreSQL nativo |
| **ORM** | Drizzle ORM + `@neondatabase/serverless` | Type-safe, leve, migrations nativas, WebSocket driver otimizado para serverless |
| **Auth** | Auth.js v5 + Drizzle Adapter + Credentials Provider | Integra nativamente com Next.js App Router, middleware server-side, JWT sessions |
| **Frontend** | Next.js 16.2.1 (App Router, Turbopack) | API Routes integradas, proxy.ts auth, Server Components, deploy unificado Vercel |
| **API** | Next.js API Routes (Route Handlers) | Zero infra separada, substitui server.py, serverless nativo |
| **Storage** | Vercel Blob (256MB free tier) | SDK nativo Next.js, CDN automatico, zero config. Fallback: Cloudflare R2 se crescer |
| **Deploy** | Vercel (frontend + API unificados) + Neon (DB) | Free tier generoso, deploy = git push, preview deploys por PR |
| **Automacoes** | Vercel Cron Jobs + cron interno | N8N eliminado — 2 cron jobs nativos (atrasados + alertas consolidado) |
| **Notificacoes** | In-App (badges/toasts) + Email (Resend, 3k/mes free) | In-app MUST fase 1, email implementado via Resend SDK |

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

#### `comissao_tabela` — Tabela de percentuais de comissao por seguradora

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | Identificador unico |
| seguradora | VARCHAR(255) | Nome da seguradora |
| produto | VARCHAR(255) NULL | Produto especifico (null = todos) |
| percentual | DECIMAL(5,2) | Percentual de comissao |
| created_at | TIMESTAMPTZ | Data de criacao |
| updated_at | TIMESTAMPTZ | Ultima atualizacao |

### 4.2 Views SQL (implementadas em `scripts/create-views.ts`)

4 views otimizadas para o dashboard, agrupadas por ano/mes/assignee:

| View | Descricao | Usada em |
|------|-----------|----------|
| `vw_kpis` | KPIs globais (total, fechadas, perdas, em_andamento, financeiros, taxa_conversao) | `/api/dashboard` |
| `vw_status_breakdown` | Breakdown por status com contagem e total financeiro | `/api/dashboard` |
| `vw_cotadores` | Desempenho individual (total, fechadas, faturamento, taxa) com photo_url | `/api/dashboard` |
| `vw_monthly_trend` | Tendencia mensal (fechadas, perdas, total, a_receber) | `/api/dashboard` |

Todas suportam filtros `WHERE ano = X AND mes = Y AND assignee_id = Z`.

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

- App mobile nativo (web responsivo implementado em todas as telas)
- Integracao com seguradoras (cotacao automatica)
- Chat interno / comentarios em cotacoes
- Multi-corretora (SaaS)
- Integracao contabil/fiscal
- Recuperacao de senha por email — planejado para v1.1

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

## 14. Status de Implementacao (atualizado 2026-03-30)

### Fase 0 — Fundacao: CONCLUIDA

| Story | Descricao | Status |
|-------|-----------|--------|
| 5.1 | Setup Neon + Drizzle ORM + schema (7 tabelas) | DONE |
| 5.2 | Auth.js v5 + login + roles (admin/cotador) + proxy.ts middleware | DONE |
| 5.3 | API REST cotacoes (CRUD completo + paginacao + filtros) | DONE |
| 5.4 | Tela de login frontend (dark gradient, Poppins, Apolizza brand) | DONE |

### Fase 1 — CRUD + Migracao: EM ANDAMENTO

| Story | Descricao | Status |
|-------|-----------|--------|
| 6.1 | Formulario de criacao de cotacao (19 campos tipados) | DONE |
| 6.2 | Formulario de edicao de cotacao | DONE |
| 6.3 | Validacao de campos obrigatorios por status (status_config) | DONE |
| 6.4 | Script de migracao ClickUp → Neon | DONE (script funcional, 100 tasks migradas previamente) |
| 6.5 | Execucao da migracao completa + validacao de integridade | EM ANDAMENTO (60/100 tasks re-sincronizadas, falta migracao completa das 3.279) |

### Fase 2 — Dashboard Proprio: CONCLUIDA

| Story | Descricao | Status |
|-------|-----------|--------|
| 7.1 | Dashboard consumindo API propria (Neon, nao mais ClickUp) | DONE |
| 7.2 | KPIs calculados por 4 views SQL (vw_kpis, vw_status_breakdown, vw_cotadores, vw_monthly_trend) | DONE |
| 7.3 | Metas persistidas no banco (API /api/metas, MetasCard com barras de progresso) | DONE |
| 7.4 | Upload de documentos (Vercel Blob, /api/cotacoes/[id]/docs) | DONE |

### Fase 3 — Automacoes + Polish: CONCLUIDA

| Story | Descricao | Status |
|-------|-----------|--------|
| 8.1 | ~~Adaptar N8N workflows~~ → Substituido por Vercel Cron + Resend | DONE (N8N eliminado) |
| 8.2 | Cron job: auto-status ATRASADO (/api/cron/atrasados) | DONE |
| 8.3 | Audit trail — historico de alteracoes (field-level tracking) | DONE |
| 8.4 | Admin: gestao de usuarios (criar/editar/desativar) | DONE |

### Fase 4 — Desligamento ClickUp: NAO INICIADA

| Story | Descricao | Status |
|-------|-----------|--------|
| 9.1 | Periodo de operacao paralela (dual-read, validacao) | PENDENTE |
| 9.2 | Remover codigo ClickUp do dashboard | PENDENTE |
| 9.3 | Documentacao final do sistema | PENDENTE |

### Epic 1 — Hardening & Seguranca: CONCLUIDA (Stories 10.x)

| Story | Descricao | Status |
|-------|-----------|--------|
| 10.1 | Try-catch em todas as 21 API routes + error handling padronizado | DONE |
| 10.2 | Fix SQL injection — validacao de params mes, ano, status, assignee | DONE |
| 10.3 | Validacao Zod completa com enums (status, priority, tipoCliente, produto, situacao) | DONE |
| 10.4 | Transacoes DB (update + history atomico), fix CRON_SECRET, sanitizacao upload, headers seguranca | DONE |
| 10.5 | Promise.all no dashboard — 4 queries paralelas | DONE |
| 10.6 | Migration inicial gerada com drizzle-kit generate | DONE |

### Epic 2 — CRM Upgrade Completo: 11/11 DONE (Stories 11.x)

| Story | Descricao | Status | Detalhes |
|-------|-----------|--------|----------|
| 11.1 | Export CSV/PDF de cotacoes | DONE | CSV download + pagina de impressao PDF com KPIs, logo, filtros |
| 11.2 | Notificacoes email (Resend) | DONE | Resend SDK + templates HTML Apolizza (vigencia, tratativa, prazo, resumo diario) |
| 11.3 | View renovacoes com alertas 60/30/15 dias | DONE | Pagina /renovacoes com urgencia colorida |
| 11.4 | Relatorio mensal gerencial | DONE | KPIs com comparacao periodo anterior, ranking cotadores, pipeline, evolucao 12 meses |
| 11.5 | Busca full-text e filtros avancados | DONE | 8 filtros (status, produto, seguradora, prioridade, renovacao, date range) + URL sync |
| 11.6 | Calculadora automatica de comissao | DONE | Auto-calculo reativo + tabela % por seguradora (comissao_tabela) |
| 11.7 | Kanban board de cotacoes | DONE | Drag & drop entre status com API update |
| 11.8 | Mobile responsive cards | DONE | Card views em todas as tabelas (cotacoes, usuarios, renovacoes) |
| 11.9 | Calendario de vencimentos e tratativas | DONE | Grid mensal (desktop) + lista (mobile), 3 tipos de evento |
| 11.10 | Bulk operations e import CSV | DONE | Selecao multipla, update status/delete em lote, import CSV com validacao Zod |

### Extras Realizados (fora do PRD original)

| Item | Descricao | Status |
|------|-----------|--------|
| UX Overhaul | Identidade visual Apolizza em todos os componentes (Poppins, #03a4ed, #ff695f, gradients, dark header) | DONE |
| Seed Scripts | 3 admins + 10 cotacoes demo + 12 status config | DONE |
| Login flexivel | Login aceita username OU email | DONE |
| Status Config Admin | UI para admin editar campos obrigatorios por status, cor, icone, terminal | DONE |
| Cards Cotadores | Cards com foto/iniciais, metricas individuais, progress bar conversao | DONE |
| Auto-sugestao comissao | Ao selecionar seguradora, sugere % da tabela comissao_tabela | DONE |
| Eliminacao N8N | Substituido por Vercel Cron Jobs (2 jobs) + Resend email — economia de $24/mes | DONE |
| Vercel Cron Jobs | vercel.json com 2 crons: atrasados (6h) + alertas consolidado (diario 9h BRT) | DONE |
| Email Resend | src/lib/email.ts — templates HTML (vigencia, tratativa, prazo, resumo diario) | DONE |

### O que falta fazer

1. **Story 6.5 — Migracao completa ClickUp → Neon** (3.279 cotacoes)
   - Script funcional (`scripts/migrate-clickup.ts`), 100 tasks ja migradas
   - 60 tasks re-sincronizadas em 2026-03-30
   - Falta executar migracao completa (sem --limit) e validar integridade

2. **Story 9.1-9.3 — Fase de transicao**
   - Operacao paralela, remover codigo ClickUp, documentacao final

3. **Configuracao Resend em producao**
   - Verificar dominio `apolizza.com` no Resend (atualmente usando `onboarding@resend.dev`)
   - Adicionar `RESEND_API_KEY` e `RESEND_FROM` no Vercel Dashboard

4. **Story FR-AUTH-08 — Recuperacao de senha por email** (COULD)
   - Planejado para v1.1, agora viavel com Resend configurado

---

---

## 15. Numeros do Projeto

| Metrica | Valor |
|---------|-------|
| Linhas de codigo | 26.749 |
| Arquivos no commit | 136 |
| Paginas (frontend) | 9 |
| API Routes | 22 |
| Componentes React | 21 |
| Tabelas no banco | 7 |
| SQL Views | 4 |
| Scripts utilitarios | 6 |
| Rotas no build | 35 |
| Erros TypeScript | 0 |

### Stack Final

| Tecnologia | Versao | Uso |
|-----------|--------|-----|
| Next.js | 16.2.1 | Framework fullstack (Turbopack) |
| React | 19 | UI library |
| TypeScript | 5.x | Type safety |
| Drizzle ORM | latest | ORM + migrations |
| Neon | PostgreSQL 16 | Database serverless (sa-east-1) |
| Auth.js | v5 | Autenticacao (Credentials, JWT) |
| Zod | v4 | Validacao de schemas |
| Chart.js | 4.x | Graficos (react-chartjs-2) |
| Vercel Blob | latest | Storage de documentos |
| Tailwind CSS | 4.x | Styling (utility-first) |
| Vercel | Production | Deploy + CDN |

---

## Change Log

| Data | Versao | Descricao | Autor |
|------|--------|-----------|-------|
| 2026-03-27 | 0.1 | PRD Draft — estrutura completa | @pm (Morgan) |
| 2026-03-27 | 0.2 | Decisoes tecnicas resolvidas (D1-D5) — Next.js, Auth.js, Vercel Blob, Resend, Vercel | @architect (Aria) |
| 2026-03-28 | 0.3 | Implementacao Fases 0-3 (parcial), UX overhaul com identidade Apolizza | @dev (Dex) |
| 2026-03-28 | 0.4 | Epic 1 Hardening completo (6/6 stories) — seguranca, validacao, transacoes, headers | @dev (Dex) |
| 2026-03-28 | 0.5 | Epic 2 CRM Upgrade (10/11 stories) — kanban, calendario, relatorios, bulk ops, import CSV, mobile, filtros, comissao | @dev (Dex) |
| 2026-03-29 | 1.0 | Deploy producao Vercel — https://apolizza-crm.vercel.app | @dev (Dex) |
| 2026-03-30 | 1.1 | Eliminar N8N Cloud → Vercel Cron + Resend email. Migracao parcial ClickUp (60 tasks). Story 8.1 e 11.2 DONE | @dev (Dex) |

---

*Apolizza CRM v1.0 — Sistema proprio de gestao de cotacoes de seguros*
