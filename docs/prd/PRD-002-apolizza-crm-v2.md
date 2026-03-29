# PRD-002 — Apolizza CRM v2: Sistema Completo de Gestao de Cotacoes

## Metadata

| Campo | Valor |
|-------|-------|
| **PRD ID** | PRD-002 |
| **Titulo** | Apolizza CRM — Sistema Proprio de Gestao de Cotacoes de Seguros |
| **Versao** | 2.0 |
| **Status** | Em Producao |
| **Criado em** | 2026-03-27 |
| **Atualizado em** | 2026-03-28 |
| **URL Producao** | https://apolizza-crm.vercel.app |
| **Prioridade** | Alta |

---

## 1. Visao Geral

### 1.1 Problema Original

A corretora Apolizza dependia 100% do ClickUp como sistema de gestao de cotacoes. Essa dependencia gerava:

- **Risco de plataforma:** Mudancas na API, limites de rate e alteracoes de plano podiam paralisar a operacao
- **Custo crescente:** Licencas ClickUp escalando com a equipe
- **Limitacoes funcionais:** Campos obrigatorios por status, automacoes e regras de negocio eram workarounds
- **Dados presos:** 3.279+ cotacoes e historico viviam no ClickUp
- **Performance:** Dashboard puxava 33 paginas de API (3.279 tasks) a cada carregamento
- **Proxy obrigatorio:** CORS exigia servidor Python intermediario

### 1.2 Solucao Implementada

CRM especializado para corretora de seguros, construido do zero, substituindo completamente o ClickUp. Sistema vertical otimizado para o fluxo de cotacao e renovacao de seguros, com:

- Login proprio com controle de acesso por papel (admin/cotador)
- CRUD completo de cotacoes com 19 campos customizados
- Dashboard com KPIs em tempo real, graficos e desempenho por cotador
- Sistema de metas com acompanhamento mensal
- Upload de documentos com storage na nuvem
- Historico de alteracoes (audit trail) automatico
- Configuracao de campos obrigatorios por status via UI admin
- Deploy em producao na Vercel

### 1.3 Visao do Produto

> Um sistema web completo onde cotadores gerenciam cotacoes de seguros do inicio ao fim, com KPIs em tempo real, alertas automaticos, acompanhamento de metas e cards de desempenho individual — sem depender de ferramentas externas.

---

## 2. Stack Tecnologica

### 2.1 Arquitetura

```
┌──────────────────────────────────────────────────────┐
│                  FRONTEND + API                       │
│              Next.js 16.2.1 (Turbopack)               │
│       React 19 | Server Components | App Router       │
│            Deploy: Vercel (Free Tier)                 │
├──────────────────────────────────────────────────────┤
│                    AUTH LAYER                          │
│            Auth.js v5 + Credentials                   │
│     JWT Sessions | Login por username OU email        │
│       proxy.ts: protecao de rotas server-side         │
├──────────────────────────────────────────────────────┤
│                    DATABASE                            │
│            Neon (PostgreSQL Serverless)                │
│     ORM: Drizzle | Driver: @neondatabase/serverless   │
│           Region: sa-east-1 (Sao Paulo)               │
├──────────────────────────────────────────────────────┤
│                    STORAGE                             │
│               Vercel Blob (256MB free)                │
│            CDN automatico | SDK nativo                │
├──────────────────────────────────────────────────────┤
│                  VALIDACAO                             │
│                Zod v4 (zod/v4)                        │
│        Schemas separados para create/update           │
├──────────────────────────────────────────────────────┤
│                 VISUALIZACAO                           │
│           Chart.js 4.5 + react-chartjs-2              │
│       Pizza status | Barras mensal | Tendencia        │
└──────────────────────────────────────────────────────┘
```

### 2.2 Dependencias Principais

| Pacote | Versao | Funcao |
|--------|--------|--------|
| next | 16.2.1 | Framework fullstack |
| react | 19.2.4 | Biblioteca UI |
| @neondatabase/serverless | ^1.0.2 | Driver PostgreSQL (neon-http) |
| drizzle-orm | ^0.45.2 | ORM type-safe |
| next-auth | ^5.0.0-beta.30 | Autenticacao |
| bcryptjs | ^3.0.3 | Hash de senhas |
| zod | ^4.3.6 | Validacao de schemas |
| chart.js | ^4.5.1 | Graficos |
| react-chartjs-2 | ^5.3.1 | Wrapper React para Chart.js |
| @vercel/blob | ^2.3.2 | Upload de arquivos |
| tailwindcss | ^4 | Framework CSS |

### 2.3 Decisoes Tecnicas Relevantes

| Decisao | Detalhe |
|---------|---------|
| `db.execute(sql)` retorna `{ rows: [...] }` | NAO array direto. Sempre acessar `.rows` |
| Zod `.partial()` preserva `.default()` | Para update schema, criar schema separado SEM defaults |
| `proxy.ts` ao inves de `middleware.ts` | Next.js 16 usa proxy.ts para middleware de rotas |
| Login por username OU email | Ambos aceitos no campo de login |

---

## 3. Identidade Visual

Identidade extraida de apolizza.com e aplicada em todos os componentes:

| Elemento | Valor |
|----------|-------|
| **Font** | Poppins (Google Fonts) |
| **Azul primario** | `#03a4ed` |
| **Azul hover** | `#0288d1` |
| **Coral** | `#ff695f` |
| **Coral hover** | `#e55a50` |
| **Gradient coral** | `linear-gradient(105deg, rgba(255,104,95,1) 0%, rgba(255,144,104,1) 100%)` |
| **Header dark** | `#1e293b → #0f172a` |
| **Border radius inputs** | `xl` (rounded-xl) |
| **Border radius cards** | `2xl` (rounded-2xl) |
| **CSS vars** | Definidas em `globals.css` |
| **Tema Tailwind** | Via `@theme inline` |

---

## 4. Modelo de Dados

### 4.1 Tabelas (6)

#### `users` — Usuarios do sistema

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | Identificador unico |
| email | VARCHAR(255) UNIQUE | Email de login |
| name | VARCHAR(255) | Nome completo |
| username | VARCHAR(100) UNIQUE | Username |
| password_hash | TEXT | Senha (bcrypt) |
| role | ENUM('admin', 'cotador') | Papel |
| photo_url | TEXT | URL da foto de perfil |
| is_active | BOOLEAN DEFAULT true | Usuario ativo |
| created_at | TIMESTAMPTZ | Data de criacao |
| updated_at | TIMESTAMPTZ | Ultima atualizacao |

#### `cotacoes` — Cotacoes de seguros

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | Identificador unico |
| clickup_id | VARCHAR(20) | ID original ClickUp (migracao) |
| name | VARCHAR(500) | Nome do cliente / descricao |
| status | VARCHAR(50) | Status no workflow (12 opcoes) |
| priority | VARCHAR(20) | Prioridade (urgent/high/normal/low) |
| due_date | TIMESTAMPTZ | Data limite |
| assignee_id | UUID (FK → users) | Cotador responsavel |
| tipo_cliente | VARCHAR(50) | NOVO/CASA, NOVO, RENOVACAO |
| contato_cliente | VARCHAR(50) | Telefone do cliente |
| seguradora | VARCHAR(255) | Nome da seguradora |
| produto | VARCHAR(255) | Tipo de produto (49 opcoes) |
| situacao | VARCHAR(50) | IMPLANTACAO, COTAR, CLIENTE, etc. |
| indicacao | VARCHAR(255) | Fonte de indicacao |
| inicio_vigencia | DATE | Inicio da apolice |
| fim_vigencia | DATE | Fim da apolice |
| primeiro_pagamento | DATE | Data do 1o pagamento |
| parcelado_em | INTEGER | Numero de parcelas |
| premio_sem_iof | DECIMAL(12,2) | Premio sem IOF |
| comissao | DECIMAL(12,2) | Valor da comissao |
| a_receber | DECIMAL(12,2) | Valor a receber |
| valor_perda | DECIMAL(12,2) | Valor da perda |
| proxima_tratativa | DATE | Data proxima tratativa |
| observacao | TEXT | Observacoes livres |
| mes_referencia | VARCHAR(3) | Mes (JAN-DEZ) |
| ano_referencia | INTEGER | Ano (2024-2027) |
| tags | JSONB | Tags da cotacao |
| is_renovacao | BOOLEAN DEFAULT false | Flag renovacao |
| deleted_at | TIMESTAMPTZ | Soft delete |
| created_at | TIMESTAMPTZ | Data de criacao |
| updated_at | TIMESTAMPTZ | Ultima atualizacao |

#### `cotacao_docs` — Documentos anexados

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | Identificador |
| cotacao_id | UUID (FK → cotacoes) | Cotacao relacionada |
| file_name | VARCHAR(255) | Nome do arquivo |
| file_url | TEXT | URL no Vercel Blob |
| file_size | INTEGER | Tamanho em bytes |
| mime_type | VARCHAR(100) | Tipo MIME |
| uploaded_by | UUID (FK → users) | Quem enviou |
| created_at | TIMESTAMPTZ | Data de upload |

#### `cotacao_history` — Audit trail

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | Identificador |
| cotacao_id | UUID (FK → cotacoes) | Cotacao alterada |
| user_id | UUID (FK → users) | Quem alterou |
| field_name | VARCHAR(100) | Campo alterado |
| old_value | TEXT | Valor anterior |
| new_value | TEXT | Novo valor |
| changed_at | TIMESTAMPTZ | Timestamp |

#### `metas` — Metas da corretora

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | Identificador |
| user_id | UUID (FK → users) NULL | NULL = meta global |
| ano | INTEGER | Ano da meta |
| mes | INTEGER (1-12) | Mes da meta |
| meta_valor | DECIMAL(12,2) | Meta em R$ |
| meta_qtd_cotacoes | INTEGER | Meta qtd cotacoes |
| meta_renovacoes | INTEGER | Meta renovacoes |
| created_at | TIMESTAMPTZ | Data de criacao |
| updated_at | TIMESTAMPTZ | Ultima atualizacao |

#### `status_config` — Configuracao de status

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | Identificador |
| status_name | VARCHAR(50) UNIQUE | Nome do status (imutavel) |
| display_label | VARCHAR(100) | Label de exibicao |
| color | VARCHAR(7) | Cor hex |
| icon | VARCHAR(10) | Emoji/icone |
| order_index | INTEGER | Ordem de exibicao |
| required_fields | JSONB | Array de campos obrigatorios |
| is_terminal | BOOLEAN DEFAULT false | Status terminal |

### 4.2 Views SQL (4)

| View | Funcao | Campos principais |
|------|--------|-------------------|
| `vw_kpis` | KPIs financeiros agregados por ano/mes/cotador | total_cotacoes, fechadas, perdas, em_andamento, total_a_receber, total_valor_perda, total_premio, taxa_conversao |
| `vw_status_breakdown` | Distribuicao por status | status, count, total |
| `vw_cotadores` | Desempenho por cotador (com foto) | user_id, name, photo_url, total_cotacoes, fechadas, faturamento, taxa_conversao |
| `vw_monthly_trend` | Tendencia mensal | ano, mes, fechadas, perdas, total, a_receber |

### 4.3 Relations (Drizzle ORM)

```
users 1:N cotacoes (via assignee_id)
users 1:N metas (via user_id)
cotacoes 1:N cotacao_docs (via cotacao_id)
cotacoes 1:N cotacao_history (via cotacao_id)
```

---

## 5. Funcionalidades Implementadas

### 5.1 Autenticacao e Autorizacao

| ID | Funcionalidade | Status |
|----|---------------|--------|
| AUTH-01 | Login com username OU email + senha | DONE |
| AUTH-02 | 2 roles: admin e cotador | DONE |
| AUTH-03 | Admin acessa tudo; cotador ve apenas suas cotacoes | DONE |
| AUTH-04 | Sessao JWT persistente | DONE |
| AUTH-05 | Tela de login responsiva com identidade Apolizza | DONE |
| AUTH-06 | Admin cria/edita/desativa usuarios | DONE |
| AUTH-07 | Protecao de rotas via proxy.ts (server-side) | DONE |

### 5.2 CRUD de Cotacoes

| ID | Funcionalidade | Status |
|----|---------------|--------|
| CRUD-01 | Criar cotacao com 19 campos tipados | DONE |
| CRUD-02 | Editar cotacao existente | DONE |
| CRUD-03 | Validacao de campos obrigatorios por status | DONE |
| CRUD-04 | Mudar status com validacao automatica | DONE |
| CRUD-05 | Soft delete (somente admin) | DONE |
| CRUD-06 | Formulario com date picker, currency, dropdowns | DONE |
| CRUD-07 | Upload de documentos (Vercel Blob) | DONE |
| CRUD-08 | Historico de alteracoes automatico (audit trail) | DONE |
| CRUD-09 | Lista paginada com busca, filtro por status/mes/cotador | DONE |
| CRUD-10 | Detalhe da cotacao com docs e historico | DONE |

### 5.3 Dashboard e KPIs

| ID | Funcionalidade | Status |
|----|---------------|--------|
| DASH-01 | KPI cards: Total Cotacoes, Fechadas, Perdas, Em Andamento, A Receber, Valor Perda, Premio, Taxa Conversao | DONE |
| DASH-02 | Breakdown visual de status (grafico pizza) | DONE |
| DASH-03 | Grafico mensal de tendencias (barras) | DONE |
| DASH-04 | Filtros por ano e mes | DONE |
| DASH-05 | Cards de desempenho por cotador com foto e metricas | DONE |
| DASH-06 | Cards clicaveis — navega para cotacoes filtradas daquele cotador | DONE |
| DASH-07 | Progress bar de taxa de conversao por cotador | DONE |
| DASH-08 | Avatar com foto ou iniciais (fallback azul #03a4ed) | DONE |
| DASH-09 | Cotacoes recentes widget | DONE |
| DASH-10 | Dados do banco proprio (Neon, nao ClickUp) | DONE |

### 5.4 Metas e Desempenho

| ID | Funcionalidade | Status |
|----|---------------|--------|
| META-01 | Meta global da corretora (valor R$, qtd, renovacoes) | DONE |
| META-02 | Metas persistidas no banco de dados | DONE |
| META-03 | Card de metas com barras de progresso | DONE |
| META-04 | Seletor de mes para metas | DONE |
| META-05 | API /api/metas com upsert (POST) | DONE |

### 5.5 Automacoes

| ID | Funcionalidade | Status |
|----|---------------|--------|
| AUTO-01 | Cron job: auto-status ATRASADO via /api/cron/atrasados | DONE |
| AUTO-02 | Protecao por CRON_SECRET | DONE |

### 5.6 Admin

| ID | Funcionalidade | Status |
|----|---------------|--------|
| ADM-01 | Gestao de usuarios (criar/editar/desativar) | DONE |
| ADM-02 | Configuracao de status via UI (label, cor, icone, campos obrigatorios, terminal) | DONE |
| ADM-03 | Edicao inline de campos obrigatorios por status com multi-select visual | DONE |
| ADM-04 | Navegacao admin: Dashboard, Cotacoes, + Nova, Usuarios, Status | DONE |

### 5.7 UX/UI

| ID | Funcionalidade | Status |
|----|---------------|--------|
| UX-01 | Identidade visual Apolizza em todos os componentes | DONE |
| UX-02 | Design responsivo (mobile/tablet/desktop) | DONE |
| UX-03 | Banner de filtro ativo com opcao de limpar | DONE |
| UX-04 | Status com cores e badges consistentes | DONE |
| UX-05 | Loading spinners e estados vazios | DONE |

---

## 6. Estrutura de Arquivos

```
apolizza-crm/
├── src/
│   ├── app/
│   │   ├── page.tsx                           # Redirect → /dashboard
│   │   ├── layout.tsx                         # Root layout (Poppins, metadata)
│   │   ├── login/
│   │   │   ├── page.tsx                       # Tela de login
│   │   │   └── layout.tsx                     # Layout login
│   │   ├── dashboard/
│   │   │   └── page.tsx                       # Dashboard principal
│   │   ├── cotacoes/
│   │   │   ├── page.tsx                       # Lista de cotacoes (filtros, busca, paginacao)
│   │   │   ├── new/
│   │   │   │   └── page.tsx                   # Criar cotacao
│   │   │   └── [id]/
│   │   │       ├── page.tsx                   # Detalhe (docs + historico)
│   │   │       └── edit/
│   │   │           └── page.tsx               # Editar cotacao
│   │   ├── usuarios/
│   │   │   └── page.tsx                       # Gestao de usuarios (admin)
│   │   ├── status-config/
│   │   │   └── page.tsx                       # Config de status (admin)
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts    # NextAuth handler
│   │       ├── cotacoes/route.ts              # GET (list), POST (create)
│   │       ├── cotacoes/[id]/route.ts         # GET, PUT (audit trail), DELETE
│   │       ├── cotacoes/[id]/docs/route.ts    # Upload/delete docs (Vercel Blob)
│   │       ├── cotacoes/[id]/history/route.ts # GET historico de alteracoes
│   │       ├── dashboard/route.ts             # GET KPIs agregados (4 views SQL)
│   │       ├── kpis/route.ts                  # GET KPIs simplificados
│   │       ├── metas/route.ts                 # GET/POST metas
│   │       ├── users/route.ts                 # GET/POST usuarios
│   │       ├── users/[id]/route.ts            # PUT/DELETE usuario
│   │       ├── status-config/route.ts         # GET todos os status
│   │       ├── status-config/[id]/route.ts    # PUT editar status config
│   │       └── cron/atrasados/route.ts        # POST auto-status ATRASADO
│   ├── components/
│   │   ├── app-header.tsx                     # Header + nav + user info
│   │   ├── sign-out-button.tsx                # Botao logout
│   │   ├── cotacao-form.tsx                   # Form 19 campos (create/edit)
│   │   ├── cotacoes-list.tsx                  # Tabela paginada + filtros + assignee
│   │   ├── cotacao-history.tsx                # Timeline de audit trail
│   │   ├── docs-upload.tsx                    # Upload de documentos
│   │   ├── users-list.tsx                     # CRUD de usuarios
│   │   ├── status-config-list.tsx             # Config de status com multi-select
│   │   └── dashboard/
│   │       ├── dashboard-content.tsx          # Orquestrador com filtros ano/mes
│   │       ├── kpi-cards.tsx                  # Cards de KPI
│   │       ├── status-breakdown.tsx           # Grafico pizza de status
│   │       ├── monthly-chart.tsx              # Grafico barras mensal
│   │       ├── cotadores-table.tsx            # Cards de cotadores (foto + metricas)
│   │       ├── recent-cotacoes.tsx            # Widget cotacoes recentes
│   │       └── metas-card.tsx                 # Card de metas + progresso
│   ├── lib/
│   │   ├── schema.ts                          # Drizzle schema (6 tabelas + relations)
│   │   ├── db.ts                              # Conexao Neon + Drizzle
│   │   ├── auth.ts                            # NextAuth config
│   │   ├── validations.ts                     # Zod schemas (create/update)
│   │   ├── status-validation.ts               # Validacao campos obrigatorios por status
│   │   ├── auth-helpers.ts                    # getCurrentUser, requireAuth, requireAdmin
│   │   ├── api-helpers.ts                     # apiSuccess, apiError, apiPaginated
│   │   └── constants.ts                       # Enums (status, produto, situacao, etc.)
│   ├── types/
│   │   └── next-auth.d.ts                     # Type augmentation do NextAuth
│   └── proxy.ts                               # Middleware de protecao de rotas
├── scripts/
│   ├── seed-admin-users.ts                    # Cria 3 admins iniciais
│   ├── seed-status-config.ts                  # 12 status com cores e campos
│   ├── seed-demo.ts                           # 10 cotacoes demo
│   ├── create-views.ts                        # 4 views SQL para dashboard
│   ├── create-views.sql                       # SQL puro das views
│   ├── migrate-clickup.ts                     # Migracao ClickUp → Neon
│   └── verify-migration.ts                    # Validacao pos-migracao
├── drizzle/
│   └── migrations/                            # SQL migrations versionadas
├── next.config.ts                             # Config Next.js (React Compiler)
├── drizzle.config.ts                          # Config Drizzle (Neon)
├── tailwind.config.ts                         # Tailwind v4
├── tsconfig.json                              # TypeScript config
└── package.json
```

---

## 7. APIs (Endpoints)

### 7.1 Autenticacao

| Metodo | Rota | Descricao | Acesso |
|--------|------|-----------|--------|
| POST | `/api/auth/signin` | Login (username ou email + senha) | Publico |
| POST | `/api/auth/signout` | Logout | Autenticado |
| GET | `/api/auth/session` | Sessao atual | Autenticado |

### 7.2 Cotacoes

| Metodo | Rota | Descricao | Acesso |
|--------|------|-----------|--------|
| GET | `/api/cotacoes` | Lista paginada (query: page, limit, search, status, mes, ano, assignee) | Autenticado (cotador ve so suas) |
| POST | `/api/cotacoes` | Criar cotacao (body validado por Zod) | Autenticado |
| GET | `/api/cotacoes/:id` | Detalhe da cotacao | Autenticado |
| PUT | `/api/cotacoes/:id` | Editar cotacao (gera audit trail automatico) | Autenticado |
| DELETE | `/api/cotacoes/:id` | Soft delete | Admin |
| GET | `/api/cotacoes/:id/history` | Historico de alteracoes | Autenticado |
| POST | `/api/cotacoes/:id/docs` | Upload documento (Vercel Blob) | Autenticado |
| DELETE | `/api/cotacoes/:id/docs` | Remover documento | Autenticado |

### 7.3 Dashboard

| Metodo | Rota | Descricao | Acesso |
|--------|------|-----------|--------|
| GET | `/api/dashboard` | KPIs + status breakdown + monthly trend + cotadores (query: ano, mes) | Autenticado |
| GET | `/api/kpis` | KPIs simplificados | Autenticado |

### 7.4 Metas

| Metodo | Rota | Descricao | Acesso |
|--------|------|-----------|--------|
| GET | `/api/metas` | Metas por ano/mes | Autenticado |
| POST | `/api/metas` | Criar/atualizar meta (upsert) | Admin |

### 7.5 Usuarios

| Metodo | Rota | Descricao | Acesso |
|--------|------|-----------|--------|
| GET | `/api/users` | Lista usuarios | Admin |
| POST | `/api/users` | Criar usuario | Admin |
| PUT | `/api/users/:id` | Editar usuario | Admin |
| DELETE | `/api/users/:id` | Desativar usuario | Admin |

### 7.6 Status Config

| Metodo | Rota | Descricao | Acesso |
|--------|------|-----------|--------|
| GET | `/api/status-config` | Lista todos os 12 status configs | Autenticado |
| PUT | `/api/status-config/:id` | Editar config (label, cor, icone, campos obrigatorios, terminal) | Admin |

### 7.7 Cron

| Metodo | Rota | Descricao | Acesso |
|--------|------|-----------|--------|
| POST | `/api/cron/atrasados` | Marca cotacoes vencidas como "atrasado" | CRON_SECRET |

---

## 8. Paginas e Navegacao

### 8.1 Mapa de Paginas

| Rota | Pagina | Acesso | Descricao |
|------|--------|--------|-----------|
| `/login` | Login | Publico | Username/email + senha |
| `/` | Redirect | — | Redireciona para /dashboard |
| `/dashboard` | Dashboard | Autenticado | KPIs, graficos, cotadores, metas |
| `/cotacoes` | Lista Cotacoes | Autenticado | Tabela paginada + filtros |
| `/cotacoes?assignee={id}` | Cotacoes filtradas | Autenticado | Cotacoes de um cotador especifico |
| `/cotacoes/new` | Nova Cotacao | Autenticado | Formulario 19 campos |
| `/cotacoes/:id` | Detalhe | Autenticado | View completa + docs + historico |
| `/cotacoes/:id/edit` | Editar | Autenticado | Formulario pre-preenchido |
| `/usuarios` | Usuarios | Admin | CRUD de usuarios |
| `/status-config` | Config Status | Admin | Editar campos obrigatorios por status |

### 8.2 Navegacao Header

| Item | Visivel para | Rota |
|------|-------------|------|
| Dashboard | Todos | `/dashboard` |
| Cotacoes | Todos | `/cotacoes` |
| + Nova Cotacao | Todos | `/cotacoes/new` |
| Usuarios | Admin | `/usuarios` |
| Status | Admin | `/status-config` |

---

## 9. Status Workflow (12 status)

| Status | Label | Cor | Terminal | Campos Obrigatorios |
|--------|-------|-----|----------|-------------------|
| nao iniciado | Nao Iniciado | Cinza | Nao | fim_vigencia, inicio_vigencia, indicacao, produto, seguradora, situacao, tipo_cliente |
| em andamento | Em Andamento | Azul | Nao | — |
| pendencia | Pendencia | Amarelo | Nao | — |
| aguardando | Aguardando | Azul claro | Nao | — |
| em analise | Em Analise | Laranja | Nao | — |
| aprovado | Aprovado | Verde agua | Nao | — |
| implantando | Implantando | Verde | Nao | — |
| venda parada | Venda Parada | Roxo | Nao | — |
| atrasado | Atrasado | Vermelho | Nao | — |
| fechado | Fechado | Verde | Sim | comissao, primeiro_pagamento, a_receber, parcelado_em, premio_sem_iof |
| perda | Perda | Vermelho | Sim | valor_perda |
| cancelado | Cancelado | Vermelho escuro | Sim | — |

**Nota:** Campos obrigatorios sao editaveis pelo admin via `/status-config`.

---

## 10. Deploy e Infraestrutura

### 10.1 Ambientes

| Ambiente | URL | Deploy |
|----------|-----|--------|
| **Producao** | https://apolizza-crm.vercel.app | `vercel --prod` |
| **Preview** | Auto-gerado por push | Automatico |
| **Local** | http://localhost:3000 | `npm run dev` |

### 10.2 Variaveis de Ambiente (Vercel)

| Variavel | Descricao |
|----------|-----------|
| `DATABASE_URL` | Connection string Neon (sa-east-1) |
| `AUTH_SECRET` | Secret do NextAuth (JWT) |
| `AUTH_URL` | URL de producao |
| `CRON_SECRET` | Secret para endpoint de cron |

### 10.3 Scripts de Setup

```bash
# Instalar dependencias
npm install

# Criar tabelas no banco
npx drizzle-kit push

# Popular usuarios admin
npx tsx scripts/seed-admin-users.ts

# Popular configuracao de status
npx tsx scripts/seed-status-config.ts

# Criar views SQL
npx tsx scripts/create-views.ts

# Popular dados demo
npx tsx scripts/seed-demo.ts

# Deploy para producao
vercel --prod
```

---

## 11. Credenciais de Acesso

### Usuarios Admin (ambiente de desenvolvimento)

| Username | Senha | Role |
|----------|-------|------|
| gustavo | Apolizza@2026 | admin |
| admin | Apolizza@2026 | admin |
| gestor | Apolizza@2026 | admin |

---

## 12. Status de Implementacao

### Fase 0 — Fundacao: CONCLUIDA

| Story | Descricao | Status |
|-------|-----------|--------|
| 5.1 | Setup Neon + Drizzle ORM + schema (6 tabelas) | DONE |
| 5.2 | Auth.js v5 + login + roles + proxy middleware | DONE |
| 5.3 | API REST cotacoes (CRUD + paginacao + filtros) | DONE |
| 5.4 | Tela de login (dark gradient, Poppins, brand) | DONE |

### Fase 1 — CRUD: PARCIALMENTE CONCLUIDA

| Story | Descricao | Status |
|-------|-----------|--------|
| 6.1 | Formulario de criacao (19 campos tipados) | DONE |
| 6.2 | Formulario de edicao | DONE |
| 6.3 | Validacao campos obrigatorios por status (status_config) | DONE |
| 6.4 | Script de migracao ClickUp → Neon | PENDENTE |
| 6.5 | Execucao da migracao + validacao | PENDENTE |

### Fase 2 — Dashboard: CONCLUIDA

| Story | Descricao | Status |
|-------|-----------|--------|
| 7.1 | Dashboard consumindo API propria (Neon) | DONE |
| 7.2 | KPIs via 4 views SQL | DONE |
| 7.3 | Metas no banco + card com progresso | DONE |
| 7.4 | Upload docs (Vercel Blob) | DONE |

### Fase 3 — Automacoes + Admin: PARCIALMENTE CONCLUIDA

| Story | Descricao | Status |
|-------|-----------|--------|
| 8.1 | Adaptar N8N workflows para Neon | PENDENTE |
| 8.2 | Cron auto-status ATRASADO | DONE |
| 8.3 | Audit trail (historico field-level) | DONE |
| 8.4 | Admin: gestao de usuarios | DONE |

### Fase 4 — Desligamento ClickUp: NAO INICIADA

| Story | Descricao | Status |
|-------|-----------|--------|
| 9.1 | Operacao paralela (validacao cruzada) | PENDENTE |
| 9.2 | Remover codigo ClickUp | PENDENTE |
| 9.3 | Documentacao final | PENDENTE |

### Extras Implementados

| Feature | Descricao | Status |
|---------|-----------|--------|
| UX Overhaul | Identidade visual Apolizza completa | DONE |
| Seed Demo | 10 cotacoes realistas | DONE |
| Login Flexivel | Username OU email | DONE |
| Cards Cotadores c/ Foto | Avatar foto/iniciais + metricas + progress bar | DONE |
| Cards Clicaveis | Click no cotador → cotacoes filtradas | DONE |
| Status Config Admin UI | Editar campos obrigatorios por status via browser | DONE |
| Deploy Vercel | Sistema em producao | DONE |

---

## 13. Pendencias (proximas etapas)

### Prioridade Alta

1. **Migracao ClickUp → Neon (Stories 6.4 + 6.5)**
   - Script que puxa 3.279 cotacoes da API ClickUp
   - Transforma e insere no Neon
   - Validacao de contagem e somas financeiras
   - Mapeamento de assignees

2. **Adaptar N8N Workflows (Story 8.1)**
   - 5 workflows existentes precisam trocar ClickUp API → SQL Neon
   - Alerta prazo, alerta vigencia, alerta tratativa, status atrasado, resumo diario

3. **Operacao Paralela (Story 9.1)**
   - 1-2 semanas com ambos sistemas rodando
   - Validacao cruzada de dados

### Prioridade Media

4. **Remover Codigo ClickUp (Story 9.2)**
   - Limpar server.py, dashboard.html legacy, proxy Python
   - Manter apenas CRM proprio

5. **Documentacao Final (Story 9.3)**
   - Manual do usuario
   - Guia de deploy e manutencao

### Nice to Have (futuro)

- Kanban board na lista de cotacoes
- Notificacoes in-app (badges)
- Exportar metas em PDF/Excel
- Recuperacao de senha por email (Resend)
- View separada de renovacoes
- App mobile (PWA)

---

## 14. Metricas de Sucesso

| Metrica | Alvo | Status |
|---------|------|--------|
| Sistema em producao | Acessivel via URL publica | ATINGIDO |
| Login funcional | Autenticacao com roles | ATINGIDO |
| CRUD completo | 19 campos + validacao + docs | ATINGIDO |
| Dashboard proprio | KPIs sem dependencia ClickUp | ATINGIDO |
| Admin self-service | Usuarios e status editaveis sem dev | ATINGIDO |
| Audit trail | Rastreabilidade de alteracoes | ATINGIDO |
| Performance | < 2s carregamento (vs 10-15s ClickUp) | ATINGIDO |
| Custo mensal | < R$50 (free tier Neon + Vercel) | ATINGIDO |
| Migracao 3.279 cotacoes | 100% sem perda | PENDENTE |
| Adocao pela equipe | 100% em 2 semanas | PENDENTE |

---

## Change Log

| Data | Versao | Descricao |
|------|--------|-----------|
| 2026-03-27 | 0.1 | PRD Draft — estrutura completa |
| 2026-03-27 | 0.2 | Decisoes tecnicas (Next.js, Auth.js, Vercel Blob, Neon) |
| 2026-03-28 | 0.3 | Implementacao Fases 0-3 (parcial), UX overhaul |
| 2026-03-28 | 1.0 | Cards cotadores com foto, status config admin UI |
| 2026-03-28 | 2.0 | Cards clicaveis (cotador → cotacoes filtradas), deploy Vercel producao |

---

*Apolizza CRM — De ClickUp para sistema proprio em 2 dias.*
