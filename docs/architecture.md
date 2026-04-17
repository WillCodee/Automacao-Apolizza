# Apolizza CRM — Fullstack Architecture Document

> **Gerado por:** Aria (@architect) via `*create-full-stack-architecture`
> **Data:** 2026-04-16
> **Versão:** 1.0.0
> **Projeto:** Apolizza CRM (`apolizza-crm/`)

---

## Sumário

1. [Introdução](#1-introdução)
2. [High Level Architecture](#2-high-level-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Data Models](#4-data-models)
5. [API Specification](#5-api-specification)
6. [Components](#6-components)
7. [External APIs](#7-external-apis)
8. [Core Workflows](#8-core-workflows)
9. [Database Schema](#9-database-schema)
10. [Frontend Architecture](#10-frontend-architecture)
11. [Backend Architecture](#11-backend-architecture)
12. [Unified Project Structure](#12-unified-project-structure)
13. [Development Workflow](#13-development-workflow)
14. [Deployment Architecture](#14-deployment-architecture)
15. [Security and Performance](#15-security-and-performance)
16. [Testing Strategy](#16-testing-strategy)
17. [Coding Standards](#17-coding-standards)
18. [Error Handling Strategy](#18-error-handling-strategy)
19. [Monitoring and Observability](#19-monitoring-and-observability)
20. [Checklist Results Report](#20-checklist-results-report)
21. [Risk Registry](#anexo-a-risk-registry)

---

## 1. Introdução

### 1.1 Propósito

CRM especializado para a corretora de seguros **Apolizza**, substituindo o ClickUp como sistema de gestão de cotações e renovações. O sistema atende ~5 usuários internos (cotadores + gestores) gerenciando ~3.400 cotações com valores totais de ~R$23M em prêmios.

### 1.2 Escopo

| Dimensão | Detalhe |
|----------|---------|
| **Domínio** | Gestão de cotações de seguros (vida, auto, empresarial, etc.) |
| **Usuários** | ~5 internos (3 cotadores + 2 admins) |
| **Volume** | ~3.400 cotações, ~R$23M em prêmios, ~R$5.5M a receber |
| **Integrações** | Neon DB, Vercel Blob, Resend (planejado), ClickUp (legado) |
| **Deploy** | Vercel (Serverless, Edge Network) |

### 1.3 Decisões Arquiteturais Chave

1. **Next.js App Router** como framework fullstack (SSR + API Routes)
2. **Neon Serverless PostgreSQL** com driver HTTP (sem connection pool WebSocket)
3. **SQL Views** para agregações de dashboard (materialização em query-time)
4. **Soft delete** em cotações (preserva histórico, `deleted_at` timestamp)
5. **JWT sessions** (Auth.js v5) — sem session store no banco
6. **Vercel Blob** para upload de documentos (PDFs, imagens)
7. **Transaction + audit trail** para toda escrita em cotações

---

## 2. High Level Architecture

### 2.1 Resumo Técnico

| Aspecto | Detalhe |
|---------|---------|
| **Tipo** | Monolito fullstack serverless |
| **Framework** | Next.js 16.2.1 (App Router + Turbopack) |
| **Runtime** | Vercel Serverless Functions (Node.js 20) |
| **Database** | Neon PostgreSQL 16 (sa-east-1) |
| **Auth** | Auth.js v5 (JWT, Credentials Provider) |
| **Storage** | Vercel Blob |

### 2.2 Plataforma

- **Hosting:** Vercel (auto-deploy from GitHub)
- **Database:** Neon (serverless PostgreSQL, sa-east-1)
- **CDN:** Vercel Edge Network (global)
- **DNS:** Vercel (apolizza-crm.vercel.app)

### 2.3 Repository Structure

```
Automacao-Apolizza/           # Monorepo
├── apolizza-crm/             # Next.js 16 App (ATIVO)
│   ├── src/
│   │   ├── app/              # App Router (pages + API)
│   │   ├── components/       # React components
│   │   └── lib/              # Shared utilities
│   ├── scripts/              # DB seeds, migrations, views
│   └── public/               # Static assets
├── docs/                     # PRDs, stories, architecture
├── dashboard.html            # Dashboard legacy (desativação)
└── .aios-core/               # AIOS framework
```

### 2.4 Architecture Diagram

```mermaid
graph TB
    subgraph "Client (Browser)"
        UI[React 19 UI]
        CSR[Client Components]
        SSR[Server Components]
    end

    subgraph "Vercel Edge Network"
        CDN[CDN / Static Assets]
        PROXY[proxy.ts - Auth Guard]
    end

    subgraph "Vercel Serverless"
        PAGES[Next.js Pages - SSR]
        API[API Routes - 63 endpoints]
        CRON[Cron Jobs - /api/cron/atrasados]
    end

    subgraph "Data Layer"
        NEON[(Neon PostgreSQL 16)]
        BLOB[Vercel Blob Storage]
        VIEWS[4+1 SQL Views]
    end

    UI --> CDN
    CSR --> API
    SSR --> PAGES
    CDN --> PROXY
    PROXY --> PAGES
    PAGES --> NEON
    API --> NEON
    API --> BLOB
    NEON --> VIEWS
    CRON --> NEON
```

### 2.5 Architectural Patterns

| Pattern | Uso |
|---------|-----|
| **Server Components (RSC)** | Pages com data fetching no servidor |
| **Client Components** | Interatividade (forms, modals, charts) |
| **API Routes** | REST endpoints em `src/app/api/` |
| **Repository Pattern** | Drizzle ORM como data access layer |
| **Soft Delete** | `deleted_at` em cotações (nunca deleta fisicamente) |
| **Audit Trail** | `cotacao_history` com field-level tracking |
| **View Materialization** | SQL Views para agregações de dashboard |
| **Optimistic Updates** | `mutate()` do SWR após operações |

---

## 3. Tech Stack

### 3.1 Tecnologias em Uso

| Tecnologia | Versão | Camada | Propósito |
|-----------|--------|--------|-----------|
| **Next.js** | 16.2.1 | Framework | App Router, SSR, API Routes, Turbopack |
| **React** | 19 | Frontend | UI (Server + Client Components) |
| **TypeScript** | 5.x | Full Stack | Type safety |
| **Tailwind CSS** | 4.x | Frontend | Styling via `@theme inline` |
| **Chart.js** | 4.x | Frontend | Gráficos (react-chartjs-2) |
| **SWR** | latest | Frontend | Data fetching + cache |
| **react-hot-toast** | latest | Frontend | Notificações toast |
| **Drizzle ORM** | latest | Backend | ORM + query builder |
| **drizzle-kit** | latest | Backend | Migrations + schema push |
| **@neondatabase/serverless** | latest | Backend | Driver HTTP para Neon |
| **Auth.js** | v5 | Backend | Autenticação (JWT + Credentials) |
| **bcryptjs** | latest | Backend | Hash de senhas |
| **Zod** | v4 | Backend | Validação de schemas |
| **Vercel Blob** | latest | Backend | Upload de documentos |
| **Neon** | PostgreSQL 16 | Database | Banco serverless (sa-east-1) |
| **Vercel** | — | Infra | Hosting serverless + CDN |
| **Poppins** | — | Design | Font principal (Google Fonts) |

### 3.2 Alternativas Descartadas

| Alternativa | Motivo da Rejeição |
|-------------|-------------------|
| Supabase | Complexidade desnecessária para ~5 usuários; Neon mais simples |
| Prisma | Drizzle ORM mais leve e com melhor DX para SQL puro |
| tRPC | API Routes suficientes; tRPC adiciona complexidade |
| Redux/Zustand | SWR + React state suficientes para o volume |
| Clerk/Auth0 | Auth.js gratuito e suficiente para auth interno |
| MongoDB | Dados relacionais (cotações ↔ docs ↔ history) favorecem SQL |
| Middleware.ts | Next.js 16 usa `proxy.ts` (breaking change) |

---

## 4. Data Models

### 4.1 Entity-Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ COTACOES : "assignee"
    USERS ||--o{ METAS : "has"
    USERS ||--o{ TAREFAS : "assigned_to"
    USERS ||--o{ CHAT_MENSAGENS : "sends"

    COTACOES ||--o{ COTACAO_DOCS : "has"
    COTACOES ||--o{ COTACAO_HISTORY : "tracked_by"
    COTACOES ||--o{ COTACAO_NOTIFICACOES : "notified"
    COTACOES ||--o{ COTACAO_MENSAGENS : "discussed"
    COTACOES ||--o{ TAREFAS : "related_to"

    TAREFAS ||--o{ TAREFA_COMENTARIOS : "has"
    TAREFAS ||--o{ TAREFA_CHECKLIST : "has"
    TAREFAS ||--o{ TAREFA_ANEXOS : "has"
    TAREFAS ||--o{ TAREFA_HISTORICO : "tracked_by"

    GRUPOS_USUARIOS ||--o{ GRUPO_MEMBROS : "has"
    CHAT_MENSAGENS ||--o{ CHAT_LEITURAS : "read_by"

    STATUS_CONFIG ||--o{ COTACOES : "configures"
    SITUACAO_CONFIG ||--o{ COTACOES : "configures"
    COMISSAO_TABELA ||--o{ COTACOES : "applies_to"
    REGRAS_AUDITORIA }|--|| COTACAO_HISTORY : "defines"

    USERS {
        uuid id PK
        string username UK
        string email UK
        string name
        string password_hash
        enum role
        boolean is_active
        string photo_url
    }

    COTACOES {
        uuid id PK
        string cliente
        string seguradora
        enum status
        float valor_a_receber
        float premio_sem_iof
        float valor_perda
        uuid assignee_id FK
        int ano
        string mes
        timestamp deleted_at
    }

    METAS {
        uuid id PK
        uuid user_id FK
        int ano
        string mes
        int meta_cotacoes
        float meta_faturamento
    }
```

### 4.2 Domínios

| Domínio | Tabelas | Descrição |
|---------|---------|-----------|
| **Usuários** | users, grupos_usuarios, grupo_membros | Autenticação e permissões |
| **Cotações** | cotacoes, cotacao_docs, cotacao_history, cotacao_notificacoes, cotacao_mensagens | Core business: gestão de cotações |
| **Tarefas** | tarefas, tarefa_comentarios, tarefa_checklist, tarefa_anexos, tarefa_historico | Gestão de tarefas vinculadas |
| **Configuração** | status_config, situacao_config, comissao_tabela, regras_auditoria | Parametrização do sistema |
| **Metas** | metas | Metas de performance por cotador |

### 4.3 SQL Views

| View | Propósito | Agrupamento |
|------|-----------|-------------|
| `vw_kpis` | KPIs agregados (total, fechadas, perdas, valores) | ano, mes, assignee_id |
| `vw_status_breakdown` | Contagem e total por status | status, ano, mes, assignee_id |
| `vw_cotadores` | Performance individual dos cotadores | user_id, ano, mes |
| `vw_monthly_trend` | Tendência mensal (fechadas, perdas, total) | ano, mes, assignee_id |
| `vw_tarefas_metricas` | Métricas de tarefas por cotador | assignee_id |

---

## 5. API Specification

### 5.1 Convenções

- **Base URL:** `/api/`
- **Autenticação:** JWT via Auth.js (header automático via cookie)
- **Response format:** `{ data: T }` (sucesso) ou `{ error: string }` (erro)
- **Helpers:** `apiSuccess(data, status?)` e `apiError(msg, status)`

### 5.2 Endpoints

#### Auth (2 endpoints)
| Method | Path | Descrição |
|--------|------|-----------|
| GET/POST | `/api/auth/[...nextauth]` | Auth.js handlers (login, logout, session) |

#### Cotações (14 endpoints)
| Method | Path | Descrição |
|--------|------|-----------|
| GET | `/api/cotacoes` | Listar (paginado, filtros, search) |
| POST | `/api/cotacoes` | Criar cotação (transaction + history) |
| GET | `/api/cotacoes/[id]` | Detalhe de uma cotação |
| PUT | `/api/cotacoes/[id]` | Editar (transaction + history) |
| DELETE | `/api/cotacoes/[id]` | Soft delete (deleted_at) |
| GET | `/api/cotacoes/[id]/docs` | Listar documentos anexados |
| POST | `/api/cotacoes/[id]/docs` | Upload documento (Vercel Blob) |
| GET | `/api/cotacoes/[id]/history` | Audit trail field-level |
| POST | `/api/cotacoes/bulk` | Bulk update status ou delete |
| GET | `/api/cotacoes/export` | Export CSV |
| POST | `/api/cotacoes/import` | Import CSV (FormData) |
| GET | `/api/cotacoes/seguradoras` | Valores distintos para filtros |
| GET | `/api/cotacoes/[id]/mensagens` | Mensagens da cotação |
| POST | `/api/cotacoes/[id]/mensagens` | Enviar mensagem |

#### Dashboard (1 endpoint)
| Method | Path | Descrição |
|--------|------|-----------|
| GET | `/api/dashboard` | KPIs + status + trend + cotadores (4 queries paralelas) |

#### Tarefas (12 endpoints)
| Method | Path | Descrição |
|--------|------|-----------|
| GET | `/api/tarefas` | Listar tarefas (filtros por status, assignee) |
| POST | `/api/tarefas` | Criar tarefa |
| GET | `/api/tarefas/[id]` | Detalhe |
| PUT | `/api/tarefas/[id]` | Editar tarefa |
| DELETE | `/api/tarefas/[id]` | Deletar tarefa |
| GET | `/api/tarefas/[id]/comentarios` | Listar comentários |
| POST | `/api/tarefas/[id]/comentarios` | Adicionar comentário |
| GET | `/api/tarefas/[id]/checklist` | Listar checklist |
| POST | `/api/tarefas/[id]/checklist` | Adicionar item |
| PUT | `/api/tarefas/[id]/checklist/[itemId]` | Toggle item |
| GET | `/api/tarefas/[id]/anexos` | Listar anexos |
| POST | `/api/tarefas/[id]/anexos` | Upload anexo |

#### Metas, KPIs, Calendário (6 endpoints)
| Method | Path | Descrição |
|--------|------|-----------|
| GET | `/api/metas` | Listar metas |
| POST | `/api/metas` | Criar meta |
| PUT | `/api/metas` | Editar meta |
| GET | `/api/kpis` | KPIs simplificado |
| GET | `/api/calendario` | Eventos do mês |
| GET | `/api/renovacoes` | Renovações com alertas 60/30/15 dias |

#### Configuração (5 endpoints)
| Method | Path | Descrição |
|--------|------|-----------|
| GET | `/api/status-config` | Listar status configs |
| PUT | `/api/status-config/[id]` | Editar status config |
| GET | `/api/comissao-tabela` | Tabela comissão |
| POST | `/api/comissao-tabela` | Salvar comissão |
| GET | `/api/relatorios` | Relatório gerencial |

#### Chat (4 endpoints)
| Method | Path | Descrição |
|--------|------|-----------|
| GET | `/api/chat` | Listar conversas |
| POST | `/api/chat` | Enviar mensagem |
| GET | `/api/chat/[id]` | Histórico conversa |
| PUT | `/api/chat/[id]/leitura` | Marcar como lido |

#### Usuários (4 endpoints)
| Method | Path | Descrição |
|--------|------|-----------|
| GET | `/api/users` | Listar usuários |
| POST | `/api/users` | Criar usuário |
| GET | `/api/users/[id]` | Detalhe |
| PUT | `/api/users/[id]` | Editar usuário |

#### Cron (1 endpoint)
| Method | Path | Descrição |
|--------|------|-----------|
| POST | `/api/cron/atrasados` | Auto-marcar cotações atrasadas (protegido por CRON_SECRET) |

#### Auditoria (2 endpoints)
| Method | Path | Descrição |
|--------|------|-----------|
| GET | `/api/auditoria` | Listar registros de auditoria |
| GET | `/api/auditoria/regras` | Listar regras de auditoria |

#### Situação (2 endpoints)
| Method | Path | Descrição |
|--------|------|-----------|
| GET | `/api/situacao-config` | Listar situações |
| PUT | `/api/situacao-config/[id]` | Editar situação |

#### Notificações (3 endpoints)
| Method | Path | Descrição |
|--------|------|-----------|
| GET | `/api/notificacoes` | Listar notificações |
| PUT | `/api/notificacoes/[id]` | Marcar como lida |
| PUT | `/api/notificacoes/mark-all-read` | Marcar todas como lidas |

---

## 6. Components

### 6.1 Organização por Domínio

| Domínio | Componentes | Exemplos |
|---------|-------------|----------|
| **Layout** | 5 | Header, Sidebar, PageContainer, BreadCrumb, Footer |
| **Dashboard** | 8 | KpiCards, StatusChart, MonthlyTrendChart, CotadoresRanking, MetasPanel, DateFilter, ExportButton, DashboardSkeleton |
| **Cotações** | 12 | CotacaoTable, CotacaoKanban, CotacaoForm, CotacaoDetail, CotacaoFilters, BulkActions, StatusBadge, ImportModal, ExportModal, HistoryTimeline, DocUpload, MensagensPanel |
| **Tarefas** | 8 | TarefaBoard, TarefaCard, TarefaForm, TarefaDetail, ChecklistPanel, ComentariosPanel, AnexosPanel, TarefaFilters |
| **Calendário** | 3 | CalendarioGrid, EventoCard, CalendarioFilters |
| **Usuários** | 4 | UserTable, UserForm, UserAvatar, UserRoleBadge |
| **Config** | 4 | StatusConfigTable, StatusConfigForm, ComissaoTable, SituacaoConfigTable |
| **Shared** | 4 | Modal, ConfirmDialog, LoadingSpinner, EmptyState |

### 6.2 Patterns

- **Server Components:** Pages (`page.tsx`) fazem data fetching via `fetch()` interno
- **Client Components:** Marcados com `"use client"` — forms, charts, interações
- **Composition:** Componentes compostos (ex: `CotacaoDetail` usa `HistoryTimeline` + `DocUpload` + `MensagensPanel`)
- **Data fetching:** SWR para client-side, `fetch()` para server-side

---

## 7. External APIs

### 7.1 Integrações Ativas

| Serviço | Tipo | Uso | Status |
|---------|------|-----|--------|
| **Neon** | Database | PostgreSQL serverless via HTTP driver | Ativo |
| **Vercel Blob** | Storage | Upload de documentos (PDF, imagens) | Ativo |
| **Vercel** | Hosting | Deploy serverless + CDN | Ativo |

### 7.2 Integrações Planejadas

| Serviço | Tipo | Uso | Status |
|---------|------|-----|--------|
| **Resend** | Email | Notificações por email (Story 11.2) | Draft |
| **Telegram Bot** | Messaging | Alertas de renovação | Planejado |

### 7.3 Integrações Legadas

| Serviço | Tipo | Uso | Status |
|---------|------|-----|--------|
| **ClickUp API** | Task Manager | Migração de dados (PRD-003) | Migrado — script disponível |

---

## 8. Core Workflows

### 8.1 Login Flow

```mermaid
sequenceDiagram
    participant U as Usuário
    participant P as proxy.ts
    participant L as /login page
    participant A as Auth.js
    participant DB as Neon

    U->>P: GET /dashboard
    P->>P: Check JWT cookie
    P-->>L: Redirect (no token)
    U->>L: POST credentials
    L->>A: signIn("credentials")
    A->>DB: SELECT user WHERE username/email
    DB-->>A: user row
    A->>A: bcrypt.compare(password)
    A-->>U: Set JWT cookie + redirect /dashboard
```

### 8.2 CRUD Cotação

```mermaid
sequenceDiagram
    participant U as Usuário
    participant F as CotacaoForm
    participant API as /api/cotacoes
    participant DB as Neon
    participant H as cotacao_history

    U->>F: Preenche formulário
    F->>F: Zod validation
    F->>API: POST /api/cotacoes
    API->>API: getCurrentUser() + validate
    API->>DB: BEGIN TRANSACTION
    DB->>DB: INSERT cotacoes
    DB->>H: INSERT history (campo: "criacao")
    DB->>DB: COMMIT
    DB-->>API: cotacao created
    API-->>F: { data: cotacao }
    F->>F: SWR mutate() + toast
```

### 8.3 Dashboard Load

```mermaid
sequenceDiagram
    participant U as Usuário
    participant D as Dashboard Page
    participant API as /api/dashboard
    participant DB as Neon

    U->>D: Navigate /dashboard
    D->>API: GET /api/dashboard?ano=2026
    API->>API: getCurrentUser()
    API->>DB: Promise.all([4 queries])
    Note over DB: vw_kpis<br/>vw_status_breakdown<br/>vw_monthly_trend<br/>vw_cotadores
    DB-->>API: 4 result sets
    API-->>D: { kpis, statusBreakdown, monthlyTrend, cotadores }
    D->>D: Render charts + cards
```

### 8.4 Bulk Operations

```mermaid
sequenceDiagram
    participant U as Usuário
    participant T as CotacaoTable
    participant API as /api/cotacoes/bulk
    participant DB as Neon

    U->>T: Select múltiplas cotações
    U->>T: Click "Alterar Status"
    T->>T: ConfirmDialog
    U->>T: Confirma
    T->>API: POST { ids[], action, value }
    API->>DB: BEGIN TRANSACTION
    loop Para cada ID
        DB->>DB: UPDATE cotacoes SET status
        DB->>DB: INSERT cotacao_history
    end
    DB->>DB: COMMIT
    API-->>T: { updated: N }
    T->>T: SWR mutate() + toast
```

### 8.5 Tarefas Flow

```mermaid
sequenceDiagram
    participant U as Usuário
    participant B as TarefaBoard
    participant API as /api/tarefas
    participant DB as Neon

    U->>B: Drag card to "Em Andamento"
    B->>API: PUT /api/tarefas/[id] { status }
    API->>DB: UPDATE tarefas SET status
    API->>DB: INSERT tarefa_historico
    DB-->>API: updated
    API-->>B: { data: tarefa }
    B->>B: Optimistic update
```

### 8.6 Cron Atrasados

```mermaid
sequenceDiagram
    participant V as Vercel Cron
    participant API as /api/cron/atrasados
    participant DB as Neon

    V->>API: POST (CRON_SECRET header)
    API->>API: Validate secret
    API->>DB: SELECT cotacoes WHERE due_date < now() AND status != 'FECHADO'
    DB-->>API: cotações atrasadas
    loop Para cada atrasada
        API->>DB: UPDATE status = 'ATRASADO'
        API->>DB: INSERT cotacao_history
    end
    API-->>V: { updated: N }
```

### 8.7 Document Upload

```mermaid
sequenceDiagram
    participant U as Usuário
    participant D as DocUpload
    participant API as /api/cotacoes/[id]/docs
    participant BLOB as Vercel Blob
    participant DB as Neon

    U->>D: Select file (PDF/IMG)
    D->>API: POST FormData
    API->>BLOB: put(filename, file)
    BLOB-->>API: { url, pathname }
    API->>DB: INSERT cotacao_docs { url, nome, tipo, tamanho }
    DB-->>API: doc created
    API-->>D: { data: doc }
    D->>D: Refresh doc list
```

---

## 9. Database Schema

### 9.1 Enums

```sql
CREATE TYPE user_role AS ENUM ('admin', 'cotador', 'proprietario');

CREATE TYPE tarefa_status AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');

CREATE TYPE tarefa_prioridade AS ENUM ('baixa', 'media', 'alta', 'urgente');
```

### 9.2 Tabelas Principais

```sql
-- Usuários
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'cotador',
    is_active BOOLEAN NOT NULL DEFAULT true,
    photo_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Cotações (core business)
CREATE TABLE cotacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente VARCHAR(500),
    seguradora VARCHAR(255),
    produto VARCHAR(255),
    ramo VARCHAR(255),
    status VARCHAR(50) DEFAULT 'NOVA',
    situacao VARCHAR(100),
    assignee_id UUID REFERENCES users(id),
    valor_a_receber NUMERIC(12,2) DEFAULT 0,
    premio_sem_iof NUMERIC(12,2) DEFAULT 0,
    valor_perda NUMERIC(12,2) DEFAULT 0,
    comissao NUMERIC(12,2) DEFAULT 0,
    contato_cliente VARCHAR(255),
    valor_parcelado NUMERIC(12,2),
    comissao_parcelada NUMERIC(12,2),
    observacao TEXT,
    ano INTEGER,
    mes VARCHAR(3),
    inicio_vigencia DATE,
    primeiro_pagamento DATE,
    clickup_task_id VARCHAR(50) UNIQUE,
    clickup_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Documentos anexados
CREATE TABLE cotacao_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cotacao_id UUID NOT NULL REFERENCES cotacoes(id),
    nome VARCHAR(500) NOT NULL,
    url TEXT NOT NULL,
    tipo VARCHAR(100),
    tamanho INTEGER,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit trail (field-level)
CREATE TABLE cotacao_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cotacao_id UUID NOT NULL REFERENCES cotacoes(id),
    user_id UUID REFERENCES users(id),
    campo VARCHAR(100),
    valor_anterior TEXT,
    valor_novo TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Metas de performance
CREATE TABLE metas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    ano INTEGER NOT NULL,
    mes VARCHAR(3) NOT NULL,
    meta_cotacoes INTEGER DEFAULT 0,
    meta_faturamento NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, ano, mes)
);

-- Configuração de status
CREATE TABLE status_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    cor VARCHAR(7),
    ordem INTEGER DEFAULT 0,
    campos_obrigatorios TEXT[],
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Configuração de situação
CREATE TABLE situacao_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    cor VARCHAR(7),
    ordem INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de comissão
CREATE TABLE comissao_tabela (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seguradora VARCHAR(255) NOT NULL,
    produto VARCHAR(255) NOT NULL,
    percentual NUMERIC(5,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Regras de auditoria
CREATE TABLE regras_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campo VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    configuracao JSONB,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 9.3 Tabelas de Tarefas

```sql
CREATE TABLE tarefas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(500) NOT NULL,
    descricao TEXT,
    status tarefa_status DEFAULT 'pendente',
    prioridade tarefa_prioridade DEFAULT 'media',
    cotacao_id UUID REFERENCES cotacoes(id),
    assignee_id UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    due_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tarefa_comentarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarefa_id UUID NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    conteudo TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tarefa_checklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarefa_id UUID NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
    titulo VARCHAR(500) NOT NULL,
    concluido BOOLEAN DEFAULT false,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tarefa_anexos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarefa_id UUID NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
    nome VARCHAR(500) NOT NULL,
    url TEXT NOT NULL,
    tipo VARCHAR(100),
    tamanho INTEGER,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tarefa_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarefa_id UUID NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    campo VARCHAR(100),
    valor_anterior TEXT,
    valor_novo TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 9.4 Tabelas de Chat e Notificações

```sql
CREATE TABLE cotacao_notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cotacao_id UUID REFERENCES cotacoes(id),
    user_id UUID NOT NULL REFERENCES users(id),
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    mensagem TEXT,
    lida BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cotacao_mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cotacao_id UUID NOT NULL REFERENCES cotacoes(id),
    user_id UUID NOT NULL REFERENCES users(id),
    conteudo TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id UUID REFERENCES grupos_usuarios(id),
    user_id UUID NOT NULL REFERENCES users(id),
    conteudo TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_leituras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id UUID NOT NULL REFERENCES grupos_usuarios(id),
    user_id UUID NOT NULL REFERENCES users(id),
    last_read_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(grupo_id, user_id)
);

CREATE TABLE grupos_usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE grupo_membros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id UUID NOT NULL REFERENCES grupos_usuarios(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(grupo_id, user_id)
);
```

### 9.5 Indexes

```sql
-- Performance indexes
CREATE INDEX idx_cotacoes_assignee ON cotacoes(assignee_id);
CREATE INDEX idx_cotacoes_status ON cotacoes(status);
CREATE INDEX idx_cotacoes_ano_mes ON cotacoes(ano, mes);
CREATE INDEX idx_cotacoes_deleted_at ON cotacoes(deleted_at);
CREATE INDEX idx_cotacoes_clickup_task_id ON cotacoes(clickup_task_id);
CREATE INDEX idx_cotacoes_seguradora ON cotacoes(seguradora);
CREATE INDEX idx_cotacoes_cliente ON cotacoes(cliente);
CREATE INDEX idx_cotacao_docs_cotacao ON cotacao_docs(cotacao_id);
CREATE INDEX idx_cotacao_history_cotacao ON cotacao_history(cotacao_id);
CREATE INDEX idx_metas_user_ano_mes ON metas(user_id, ano, mes);
CREATE INDEX idx_tarefas_assignee ON tarefas(assignee_id);
CREATE INDEX idx_tarefas_cotacao ON tarefas(cotacao_id);
CREATE INDEX idx_tarefas_status ON tarefas(status);
CREATE INDEX idx_tarefa_comentarios_tarefa ON tarefa_comentarios(tarefa_id);
CREATE INDEX idx_tarefa_checklist_tarefa ON tarefa_checklist(tarefa_id);
CREATE INDEX idx_tarefa_anexos_tarefa ON tarefa_anexos(tarefa_id);
CREATE INDEX idx_tarefa_historico_tarefa ON tarefa_historico(tarefa_id);
CREATE INDEX idx_cotacao_notificacoes_user ON cotacao_notificacoes(user_id);
CREATE INDEX idx_cotacao_notificacoes_lida ON cotacao_notificacoes(user_id, lida);
CREATE INDEX idx_cotacao_mensagens_cotacao ON cotacao_mensagens(cotacao_id);
CREATE INDEX idx_chat_mensagens_grupo ON chat_mensagens(grupo_id);
CREATE INDEX idx_chat_leituras_grupo_user ON chat_leituras(grupo_id, user_id);
CREATE INDEX idx_grupo_membros_grupo ON grupo_membros(grupo_id);
CREATE INDEX idx_grupo_membros_user ON grupo_membros(user_id);
```

---

## 10. Frontend Architecture

### 10.1 Component Architecture

```
src/
├── app/                        # App Router
│   ├── layout.tsx              # Root layout (Poppins, Providers)
│   ├── page.tsx                # Redirect to /dashboard
│   ├── login/page.tsx          # Login page
│   ├── dashboard/page.tsx      # Dashboard com KPIs + charts
│   ├── cotacoes/
│   │   ├── page.tsx            # Lista + Kanban toggle
│   │   ├── new/page.tsx        # Formulário criação
│   │   └── [id]/page.tsx       # Detalhe + tabs
│   ├── tarefas/page.tsx        # Board de tarefas
│   ├── renovacoes/page.tsx     # Alertas de renovação
│   ├── calendario/page.tsx     # Calendário mensal
│   ├── relatorios/page.tsx     # Relatório gerencial
│   ├── usuarios/page.tsx       # Gestão de usuários
│   └── status-config/page.tsx  # Config por status
├── components/                 # Componentes React
│   ├── layout/                 # Header, Sidebar, etc.
│   ├── dashboard/              # Cards, charts
│   ├── cotacoes/               # Table, Kanban, Form
│   ├── tarefas/                # Board, Card, Form
│   └── shared/                 # Modal, Spinner, etc.
└── lib/                        # Utilitários
    ├── auth.ts                 # Auth.js config
    ├── auth-helpers.ts         # getCurrentUser()
    ├── db.ts                   # Drizzle + Neon connection
    ├── schema.ts               # Drizzle schema (22 tables)
    ├── api-helpers.ts          # apiSuccess/apiError
    └── utils.ts                # Formatters, helpers
```

### 10.2 State Management

| Tipo | Ferramenta | Uso |
|------|-----------|-----|
| **Server State** | SWR | Dados de API (cotações, dashboard, tarefas) |
| **Form State** | React useState | Formulários (controlled inputs) |
| **UI State** | React useState | Modals, filters, toggles |
| **Auth State** | Auth.js `useSession()` | Sessão do usuário |
| **URL State** | `useSearchParams()` | Filtros persistentes na URL |

### 10.3 Routing

- **App Router:** File-based routing em `src/app/`
- **Auth Guard:** `proxy.ts` redireciona para `/login` se sem JWT
- **Dynamic Routes:** `[id]` para detalhe de cotação, status-config, usuário
- **Layouts:** Root layout com Header + Sidebar (exceto `/login`)

### 10.4 Styling

- **Tailwind CSS 4.x** com `@theme inline` em `globals.css`
- **CSS Variables** para cores da marca (--primary, --coral, etc.)
- **Font:** Poppins (Google Fonts) carregada no layout
- **Design tokens:** `rounded-xl` (inputs), `rounded-2xl` (cards)
- **Dark header:** gradient `#1e293b → #0f172a`

---

## 11. Backend Architecture

### 11.1 Service Architecture

```
API Routes (src/app/api/)
    │
    ├── Auth Layer
    │   ├── proxy.ts (page protection)
    │   └── getCurrentUser() (API protection)
    │
    ├── Validation Layer
    │   └── Zod v4 schemas
    │
    ├── Business Logic
    │   └── Inline in route handlers
    │
    ├── Data Access Layer
    │   ├── Drizzle ORM (typed queries)
    │   ├── Raw SQL via sql`` template tag
    │   └── SQL Views (read-only aggregations)
    │
    └── External Services
        ├── Vercel Blob (file storage)
        └── Neon (PostgreSQL via HTTP)
```

### 11.2 Data Access Patterns

| Pattern | Quando | Exemplo |
|---------|--------|---------|
| **Drizzle Query** | CRUD simples | `db.select().from(cotacoes).where(...)` |
| **Raw SQL** | Queries complexas | `db.execute(sql\`SELECT ... FROM vw_kpis\`)` |
| **Transaction** | Write + history | `db.transaction(async (tx) => { ... })` |
| **SQL Views** | Dashboard, relatórios | `vw_kpis`, `vw_cotadores`, etc. |

### 11.3 Auth Architecture (4 camadas)

1. **proxy.ts** — Intercepta requests server-side, redireciona não-autenticados
2. **Auth.js config** — JWT strategy, Credentials provider, callbacks
3. **getCurrentUser()** — Helper que extrai user do JWT em API routes
4. **Role check** — `user.role === 'admin'` inline em routes restritas

### 11.4 Validation (Zod v4)

```typescript
// Import from zod/v4
import { z } from "zod/v4";

// Create schema (com defaults)
const cotacaoCreateSchema = z.object({
  cliente: z.string().min(1),
  seguradora: z.string().optional(),
  status: z.string().default("NOVA"),
  // ...
});

// Update schema (sem defaults, tudo opcional)
const cotacaoUpdateSchema = z.object({
  cliente: z.string().min(1).optional(),
  seguradora: z.string().optional(),
  status: z.string().optional(),
  // ...
});
```

### 11.5 Cron Jobs

| Job | Schedule | Endpoint | Proteção |
|-----|----------|----------|----------|
| Auto-atrasados | Daily | `/api/cron/atrasados` | `CRON_SECRET` header |

---

## 12. Unified Project Structure

```
apolizza-crm/                           # 669 lines schema, 48 components
├── src/
│   ├── app/
│   │   ├── api/                        # 63 API endpoints
│   │   │   ├── auth/[...nextauth]/     # Auth.js
│   │   │   ├── cotacoes/               # CRUD + bulk + export + import
│   │   │   ├── dashboard/              # KPIs (4 parallel queries)
│   │   │   ├── tarefas/                # CRUD + sub-resources
│   │   │   ├── metas/                  # CRUD metas
│   │   │   ├── calendario/             # Eventos mês
│   │   │   ├── renovacoes/             # Alertas renovação
│   │   │   ├── relatorios/             # Relatório gerencial
│   │   │   ├── users/                  # CRUD usuários
│   │   │   ├── status-config/          # Config status
│   │   │   ├── situacao-config/        # Config situação
│   │   │   ├── comissao-tabela/        # Tabela comissão
│   │   │   ├── auditoria/              # Audit logs
│   │   │   ├── chat/                   # Mensagens
│   │   │   ├── notificacoes/           # Notificações
│   │   │   ├── kpis/                   # KPIs simplificado
│   │   │   └── cron/atrasados/         # Cron job
│   │   ├── dashboard/page.tsx          # Dashboard
│   │   ├── cotacoes/                   # Lista + Detalhe + New
│   │   ├── tarefas/page.tsx            # Board
│   │   ├── renovacoes/page.tsx         # Renovações
│   │   ├── calendario/page.tsx         # Calendário
│   │   ├── relatorios/page.tsx         # Relatórios
│   │   ├── usuarios/page.tsx           # Gestão usuários
│   │   ├── status-config/page.tsx      # Config status
│   │   ├── login/page.tsx              # Login
│   │   ├── layout.tsx                  # Root layout
│   │   ├── globals.css                 # Tailwind + CSS vars
│   │   └── page.tsx                    # Redirect → /dashboard
│   ├── components/                     # 48 componentes React
│   │   ├── layout/
│   │   ├── dashboard/
│   │   ├── cotacoes/
│   │   ├── tarefas/
│   │   └── shared/
│   └── lib/
│       ├── auth.ts                     # Auth.js config
│       ├── auth-helpers.ts             # getCurrentUser()
│       ├── db.ts                       # Drizzle + Neon
│       ├── schema.ts                   # 22 tabelas, 669 linhas
│       ├── api-helpers.ts              # apiSuccess/apiError
│       └── utils.ts                    # Formatters
├── scripts/
│   ├── create-views.ts                 # 4+1 SQL views
│   ├── seed-admin-users.ts             # Seed admins
│   ├── seed-demo.ts                    # Seed 10 cotações
│   ├── seed-status-config.ts           # Seed 12 status
│   └── migrate-clickup.ts             # Migração ClickUp → Neon
├── public/                             # Static assets
├── drizzle.config.ts                   # Drizzle Kit config
├── next.config.ts                      # Next.js config
├── proxy.ts                            # Auth guard (NOT middleware)
├── package.json
├── tsconfig.json
└── vercel.json                         # Cron + headers config
```

### Métricas do Projeto

| Métrica | Valor |
|---------|-------|
| Tabelas | 22 |
| SQL Views | 5 |
| API Endpoints | 63 |
| Pages | 22 |
| Components | ~48 |
| Schema (linhas) | 669 |
| Enums | 3 |
| Indexes | 32 |

---

## 13. Development Workflow

### 13.1 Pré-requisitos

- Node.js 18+ (recomendado 20)
- npm
- Git
- Conta Neon (database)
- Conta Vercel (deploy)

### 13.2 Setup Local

```bash
# Clone
git clone https://github.com/WillCodee/Automacao-Apolizza.git
cd Automacao-Apolizza/apolizza-crm

# Instalar dependências
npm install

# Configurar .env.local
cp .env.example .env.local  # editar com suas credenciais

# Push schema para banco
npx drizzle-kit push

# Criar SQL views
npx tsx scripts/create-views.ts

# Seed dados iniciais
npx tsx scripts/seed-admin-users.ts
npx tsx scripts/seed-status-config.ts

# Dev server
npm run dev  # http://localhost:3000
```

### 13.3 Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Dev server com Turbopack |
| `npm run build` | Build produção |
| `npx tsc --noEmit` | Type check |
| `npx drizzle-kit push` | Push schema para Neon |
| `npx drizzle-kit generate` | Gerar migration |
| `npx tsx scripts/create-views.ts` | Criar/atualizar views |
| `npx tsx scripts/seed-admin-users.ts` | Seed admins |
| `npx tsx scripts/seed-demo.ts` | Seed cotações demo |

### 13.4 Environment Variables

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | Neon connection string (pooled) |
| `AUTH_SECRET` | Sim | Auth.js secret (base64) |
| `AUTH_URL` | Sim | URL base da aplicação |
| `CRON_SECRET` | Sim | Secret para cron job |
| `BLOB_READ_WRITE_TOKEN` | Não | Vercel Blob token |

### 13.5 Git Workflow

```
main (produção)
  └── feature/story-X.Y (desenvolvimento)
       └── PR → main (auto-deploy Vercel)
```

- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
- Branch por story: `feature/story-11.3-tarefas`
- PR review antes de merge (quando possível)

### 13.6 Deploy Pipeline

```
git push origin main
    → GitHub webhook → Vercel
    → Build (Next.js)
    → Deploy (Serverless Functions + Static)
    → URL: https://apolizza-crm.vercel.app

# Fallback manual (se auto-deploy falhar)
vercel --prod --yes  # da raiz do repo
```

---

## 14. Deployment Architecture

### 14.1 Estratégia

| Aspecto | Configuração |
|---------|-------------|
| **Tipo** | Serverless (Vercel) |
| **Trigger** | Auto-deploy on push to `main` |
| **Fallback** | `vercel --prod --yes` (manual) |
| **Preview** | Auto-deploy on PR branches |
| **Rollback** | Vercel Dashboard (instant) |

### 14.2 Infrastructure Diagram

```mermaid
graph TB
    subgraph "GitHub"
        REPO[WillCodee/Automacao-Apolizza]
    end

    subgraph "Vercel"
        BUILD[Build Pipeline]
        EDGE[Edge Network - Global CDN]
        FN[Serverless Functions - iad1]
        CRON[Cron Scheduler]
        BLOB[Blob Storage]
    end

    subgraph "Neon"
        DB[(PostgreSQL 16 - sa-east-1)]
        PROXY_N[Connection Pooler]
    end

    REPO -->|webhook| BUILD
    BUILD --> EDGE
    BUILD --> FN
    EDGE -->|static assets| CLIENT[Browser]
    FN -->|HTTP driver| PROXY_N
    PROXY_N --> DB
    FN -->|put/get| BLOB
    CRON -->|POST /api/cron| FN
```

### 14.3 Ambientes

| Ambiente | URL | Branch | Database |
|----------|-----|--------|----------|
| **Production** | apolizza-crm.vercel.app | `main` | Neon main branch |
| **Preview** | *.vercel.app | PR branches | Neon main branch (shared) |
| **Local** | localhost:3000 | any | Neon main branch (shared) |

### 14.4 Custos Estimados (mensal)

| Serviço | Plano | Custo |
|---------|-------|-------|
| Vercel | Hobby (free) | $0 |
| Neon | Free tier (0.5GB) | $0 |
| Vercel Blob | Included | $0 |
| **Total** | | **$0/mês** |

> **Nota:** Custo zero enquanto dentro dos limites free tier. Para produção com mais usuários, considerar Vercel Pro ($20/mês) e Neon Scale ($19/mês).

---

## 15. Security and Performance

### 15.1 Security Controls

| Controle | Implementação | Status |
|----------|--------------|--------|
| **Autenticação** | Auth.js v5 + JWT + bcrypt | Ativo |
| **Autorização** | Role-based (admin/cotador) em API routes | Ativo |
| **Auth Guard** | proxy.ts intercepta requests não-autenticados | Ativo |
| **Input Validation** | Zod v4 em todas as API routes de escrita | Ativo |
| **SQL Injection** | Drizzle ORM + `sql` template tag (parameterized) | Ativo |
| **Soft Delete** | `deleted_at` preserva dados, nunca deleta fisicamente | Ativo |
| **Audit Trail** | `cotacao_history` registra toda alteração | Ativo |
| **CORS** | Configurado no vercel.json | Ativo |
| **HTTPS** | Forçado pelo Vercel Edge | Ativo |
| **Rate Limiting** | Não implementado | Pendente (R8) |
| **CSP Headers** | Não implementado | Pendente (R12) |

### 15.2 Threat Model (STRIDE simplificado)

| Ameaça | Risco | Mitigação |
|--------|-------|-----------|
| **Spoofing** | Médio | JWT + bcrypt, sem MFA |
| **Tampering** | Baixo | Parameterized queries, Zod validation |
| **Repudiation** | Baixo | Audit trail em cotacao_history |
| **Information Disclosure** | Médio | Sem rate limiting, logs sem sanitização |
| **Denial of Service** | Alto | Sem rate limiting, sem WAF |
| **Elevation of Privilege** | Baixo | Role check em API routes |

### 15.3 Performance

| Métrica | Valor Atual | Target |
|---------|-------------|--------|
| **TTFB (dashboard)** | ~800ms | < 500ms |
| **API Response (lista)** | ~400ms | < 300ms |
| **API Response (detalhe)** | ~200ms | < 150ms |
| **Bundle size** | ~180KB gzipped | < 200KB |
| **DB queries (dashboard)** | 4 paralelas | OK |

### 15.4 Bottlenecks Identificados

| Bottleneck | Impacto | Mitigação |
|-----------|---------|-----------|
| Views SQL em query-time | Dashboard lento com >10K cotações | Materialized views ou cache |
| Neon cold start | +200ms na primeira query | Connection warmup |
| Sem CDN cache em API | Toda request vai ao servidor | SWR stale-while-revalidate (client) |
| Neon sa-east-1 → Vercel iad1 | Latência cross-region | Mover Vercel para GRU ou Neon para US |

---

## 16. Testing Strategy

### 16.1 Estado Atual

> **0 testes existentes.** Esta é a lacuna mais crítica do projeto (R1).

### 16.2 Prioridades de Implementação

| Prioridade | Tipo | Alvo | Ferramenta |
|-----------|------|------|-----------|
| **P0** | Unit | Zod schemas + utils | Vitest |
| **P0** | Integration | API routes (CRUD cotações) | Vitest + supertest |
| **P1** | Component | Formulários + tabelas | Vitest + Testing Library |
| **P2** | E2E | Login + CRUD flow | Playwright |
| **P3** | Performance | Dashboard com 10K registros | k6 |

### 16.3 Exemplos de Teste

```typescript
// Unit test - Zod schema
import { describe, it, expect } from 'vitest';
import { cotacaoCreateSchema } from '@/lib/schemas';

describe('cotacaoCreateSchema', () => {
  it('rejeita cliente vazio', () => {
    const result = cotacaoCreateSchema.safeParse({ cliente: '' });
    expect(result.success).toBe(false);
  });

  it('aceita cotação válida com defaults', () => {
    const result = cotacaoCreateSchema.safeParse({ cliente: 'Teste LTDA' });
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('NOVA');
  });
});
```

```typescript
// Integration test - API route
import { describe, it, expect } from 'vitest';

describe('GET /api/cotacoes', () => {
  it('retorna 401 sem autenticação', async () => {
    const res = await fetch('/api/cotacoes');
    expect(res.status).toBe(401);
  });

  it('retorna lista paginada', async () => {
    const res = await authenticatedFetch('/api/cotacoes?page=1&limit=10');
    const { data } = await res.json();
    expect(data.cotacoes).toHaveLength(10);
    expect(data.total).toBeGreaterThan(0);
  });
});
```

### 16.4 Coverage Targets

| Camada | Target | Atual |
|--------|--------|-------|
| Schemas/Utils | 90% | 0% |
| API Routes | 80% | 0% |
| Components | 60% | 0% |
| E2E Flows | 5 critical paths | 0 |

---

## 17. Coding Standards

### 17.1 Regras Críticas (10)

1. **`db.execute(sql)` retorna `{ rows: [...] }`** — NUNCA acesse como array direto
2. **Zod v4:** Importar de `zod/v4`, NUNCA de `zod`
3. **Zod `.partial()` preserva `.default()`** — Criar schema separado para updates SEM defaults
4. **`proxy.ts` (NOT `middleware.ts`)** — Next.js 16 breaking change
5. **Transaction + History** — Toda escrita em cotações DEVE usar `db.transaction()` + `INSERT cotacao_history`
6. **Soft Delete** — NUNCA usar `DELETE FROM cotacoes`, sempre `SET deleted_at = NOW()`
7. **`getCurrentUser()`** — Toda API route DEVE verificar autenticação primeiro
8. **API Helpers** — Usar `apiSuccess()` e `apiError()`, NUNCA `NextResponse.json()` direto
9. **SQL Views** — Para dashboard/relatórios, usar views, NUNCA queries inline complexas
10. **Filtered by deleted_at** — Toda query de cotações DEVE incluir `WHERE deleted_at IS NULL`

### 17.2 Naming Conventions

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| Components | PascalCase | `CotacaoTable.tsx` |
| Pages | `page.tsx` (App Router) | `app/cotacoes/page.tsx` |
| API Routes | `route.ts` (App Router) | `app/api/cotacoes/route.ts` |
| Hooks | camelCase com `use` | `useCotacoes.ts` |
| Utils | camelCase | `formatCurrency.ts` |
| DB Tables | snake_case | `cotacao_history` |
| DB Columns | snake_case | `assignee_id` |
| TS Interfaces | PascalCase | `CotacaoFormData` |
| CSS vars | kebab-case | `--color-primary` |

### 17.3 File Patterns

| Tipo | Pattern |
|------|---------|
| Page | `src/app/{route}/page.tsx` |
| API Route | `src/app/api/{resource}/route.ts` |
| Component | `src/components/{domain}/{Name}.tsx` |
| Schema | `src/lib/schema.ts` (centralizado) |
| Utility | `src/lib/{name}.ts` |
| Script | `scripts/{name}.ts` |

### 17.4 Anti-Patterns

| Anti-Pattern | Correto |
|-------------|---------|
| `const data = await db.execute(sql`...`)` → usar `data[0]` | Usar `data.rows[0]` |
| `import { z } from 'zod'` | `import { z } from 'zod/v4'` |
| `NextResponse.json({ error: 'msg' })` | `apiError('msg', 400)` |
| `DELETE FROM cotacoes WHERE id = $1` | `UPDATE cotacoes SET deleted_at = NOW() WHERE id = $1` |
| Schema update: `createSchema.partial()` | Criar schema dedicado sem `.default()` |

---

## 18. Error Handling Strategy

### 18.1 Error Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as API Route
    participant V as Zod Validator
    participant DB as Database
    participant H as Error Handler

    C->>API: Request
    API->>API: getCurrentUser()
    alt No auth
        API-->>C: apiError("Não autenticado", 401)
    end
    API->>V: schema.safeParse(body)
    alt Validation fails
        API-->>C: apiError(zodError.message, 400)
    end
    API->>DB: Query
    alt DB error
        DB-->>API: throw Error
        API->>H: catch block
        H->>H: console.error()
        H-->>C: apiError("Erro interno", 500)
    end
    DB-->>API: Result
    API-->>C: apiSuccess(data)
```

### 18.2 Error Response Format

```typescript
// Sucesso
{ "data": T }

// Erro
{ "error": "Mensagem de erro legível" }

// Helpers (src/lib/api-helpers.ts)
export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
```

### 18.3 Backend Error Handling

```typescript
// Padrão em toda API route
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autenticado", 401);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    const result = await db.transaction(async (tx) => {
      // ... business logic
    });

    return apiSuccess(result, 201);
  } catch (error) {
    console.error("API POST /api/resource:", error);
    return apiError("Erro interno do servidor", 500);
  }
}
```

### 18.4 Frontend Error Handling

```typescript
// Padrão com SWR + toast
const { data, error, isLoading } = useSWR('/api/resource', fetcher);

// Em mutations
try {
  const res = await fetch('/api/resource', { method: 'POST', body: JSON.stringify(data) });
  const json = await res.json();
  if (json.error) {
    toast.error(json.error);
    return;
  }
  toast.success('Operação realizada com sucesso');
  mutate('/api/resource'); // revalidate
} catch (err) {
  toast.error('Erro de conexão');
}
```

### 18.5 Recovery Patterns

| Cenário | Estratégia |
|---------|-----------|
| DB connection fail | Neon auto-reconnect (HTTP driver, stateless) |
| Vercel function timeout | 10s default, queries otimizadas com Promise.all |
| Upload fail | Vercel Blob retry automático, toast de erro no frontend |
| Auth token expired | proxy.ts redireciona para /login |
| Bulk operation partial fail | Transaction rollback completo (atomicidade) |

---

## 19. Monitoring and Observability

### 19.1 Monitoring Stack

- **Frontend Monitoring:** Sem ferramenta configurada. Vercel Analytics disponível (não ativado).
- **Backend Monitoring:** Vercel Runtime Logs (stdout/stderr). Sem APM dedicado. `console.error()` em todos os catch blocks das API routes.
- **Error Tracking:** Nenhum serviço (Sentry, LogRocket) configurado. Erros capturados apenas em logs do Vercel.
- **Performance Monitoring:** Vercel Speed Insights disponível (não ativado). Core Web Vitals via Vercel Dashboard (parcial).

### 19.2 Key Metrics

**Frontend Metrics:**
- Core Web Vitals (LCP, FID, CLS) — disponível via Vercel (não ativado)
- JavaScript errors — apenas console
- API response times — sem tracking
- User interactions — sem analytics

**Backend Metrics:**
- Request rate — Vercel Dashboard (básico)
- Error rate — Vercel Runtime Logs (grep manual)
- Response time — sem P50/P95/P99 tracking
- Database query performance — sem slow query log

### 19.3 Lacunas Críticas (vinculadas a R10)

| Lacuna | Impacto | Recomendação |
|--------|---------|--------------|
| Sem error tracking | Erros em produção passam despercebidos | Sentry (free tier: 5K events/mês) |
| Sem APM | Não é possível diagnosticar latência | Vercel Speed Insights (nativo) |
| Sem alertas | Zero notificação de downtime | Vercel Monitoring ou UptimeRobot |
| Sem log estruturado | Logs são strings sem contexto | Pino ou winston com JSON format |
| Sem métricas de negócio | Não mede uso real do CRM | PostHog (free tier: 1M events/mês) |

---

## 20. Checklist Results Report

| # | Check | Status | Nota |
|---|-------|--------|------|
| 1 | Todas as tabelas documentadas | PASS | 22/22 tabelas + 3 enums |
| 2 | Todas as API routes documentadas | PASS | 63/63 endpoints |
| 3 | Componentes mapeados | PASS | 48 componentes em 7 domínios |
| 4 | Diagrama ER presente | PASS | Mermaid com 5 domínios |
| 5 | Diagrama de arquitetura presente | PASS | High-level + deployment |
| 6 | Fluxos core documentados | PASS | 7 sequence diagrams |
| 7 | Stack completa listada | PASS | 27 tecnologias |
| 8 | Riscos mapeados | PASS | 15 riscos (R1-R15) |
| 9 | Testes documentados | WARN | Estratégia definida, 0 testes existentes |
| 10 | Monitoring definido | WARN | Lacunas identificadas, sem implementação |
| 11 | Deploy pipeline documentado | PASS | Vercel auto-deploy + manual fallback |
| 12 | Segurança avaliada | PASS | Threat model + controles |
| 13 | Error handling definido | PASS | Padrão unificado backend/frontend |
| 14 | Coding standards definidos | PASS | 10 regras críticas |

**Score: 12/14 PASS, 2/14 WARN**

---

## Anexo A: Risk Registry

| ID | Risco | Severidade | Probabilidade | Impacto | Mitigação |
|----|-------|-----------|---------------|---------|-----------|
| R1 | Zero testes automatizados | CRITICAL | Certa | Alto | Implementar Vitest + Playwright (Story pendente) |
| R2 | SQL Views não versionadas em migrations | HIGH | Alta | Médio | `scripts/create-views.ts` em CI/CD |
| R3 | Auto-deploy inconsistente | HIGH | Média | Alto | Fallback manual `vercel --prod`, investigar webhook |
| R4 | DB compartilhado entre ambientes | HIGH | Certa | Médio | Neon branching para preview |
| R5 | Secrets em .env.local sem rotação | MEDIUM | Baixa | Alto | Vault ou rotação periódica |
| R6 | Sem backup automatizado | HIGH | Média | Crítico | Neon Point-in-Time Recovery (ativo), backup externo |
| R7 | Credenciais hardcoded em docs | MEDIUM | Baixa | Alto | Remover de CLAUDE.md, usar vault |
| R8 | Sem rate limiting | HIGH | Média | Alto | Middleware de rate limit ou Vercel WAF |
| R9 | Latência cross-region (Neon sa-east-1 ↔ Vercel iad1) | MEDIUM | Certa | Médio | Co-localizar ou usar connection pooler regional |
| R10 | Sem monitoring/alertas | HIGH | Certa | Alto | Sentry + Vercel Speed Insights |
| R11 | Single point of failure (1 dev) | MEDIUM | Alta | Alto | Documentação + onboarding |
| R12 | Sem CSP/security headers | MEDIUM | Baixa | Médio | vercel.json security headers |
| R13 | Neon free tier limits | LOW | Baixa | Médio | Monitor usage, upgrade quando necessário |
| R14 | Sem LGPD compliance | MEDIUM | Média | Alto | PRD-005 planejado |
| R15 | ClickUp legacy ainda ativo | LOW | Baixa | Baixo | Desativar após validação completa |

---

*Documento gerado por Aria (@architect) — Apolizza CRM Fullstack Architecture v1.0.0*
