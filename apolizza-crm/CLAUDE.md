# CLAUDE.md — Apolizza CRM

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

CRM especializado para corretora de seguros Apolizza. Substitui o ClickUp como sistema de gestao de cotacoes e renovacoes.

**Deploy:** https://apolizza-crm.vercel.app
**PRD:** `docs/prd/PRD-001-apolizza-crm.md`
**Stories:** `docs/stories/` (5.x a 11.x)

## Stack

| Tecnologia | Versao | Uso |
|-----------|--------|-----|
| Next.js | 16.2.1 | Framework fullstack (Turbopack, App Router) |
| React | 19 | UI (Server Components + Client Components) |
| TypeScript | 5.x | Type safety em todo o projeto |
| Drizzle ORM | latest | ORM + migrations (`drizzle-kit`) |
| Neon | PostgreSQL 16 | Database serverless (sa-east-1) |
| Auth.js | v5 | Autenticacao (Credentials Provider, JWT) |
| Zod | v4 | Validacao (`zod/v4`) |
| Chart.js | 4.x | Graficos (`react-chartjs-2`) |
| Vercel Blob | latest | Storage de documentos |
| Tailwind CSS | 4.x | Styling via `@theme inline` em `globals.css` |

## Como rodar

```bash
# Instalar dependencias
npm install

# Dev server (Turbopack)
npm run dev
# Acesse http://localhost:3000

# Build producao
npm run build

# TypeScript check
npx tsc --noEmit

# Push schema para Neon (dev only)
npx drizzle-kit push

# Gerar migration
npx drizzle-kit generate

# Criar/atualizar SQL views
npx tsx scripts/create-views.ts

# Seed usuarios admin
npx tsx scripts/seed-admin-users.ts

# Seed cotacoes demo
npx tsx scripts/seed-demo.ts

# Seed status config (12 status)
npx tsx scripts/seed-status-config.ts
```

## Variaveis de ambiente (.env.local)

```
DATABASE_URL=          # Neon connection string (pooled)
AUTH_SECRET=           # Auth.js secret (openssl rand -base64 32)
AUTH_URL=              # URL base (http://localhost:3000 ou producao)
CRON_SECRET=           # Secret para /api/cron/atrasados
BLOB_READ_WRITE_TOKEN= # Vercel Blob token (opcional local)
```

## Arquitetura

### Autenticacao
- `proxy.ts` (NAO middleware.ts) — protege rotas server-side
- Login por **username OU email** + senha (bcrypt)
- JWT sessions, 2 roles: `admin` (acesso total) e `cotador` (so suas cotacoes)
- Credenciais dev: `gustavo` / `Apolizza@2026`

### Database (7 tabelas)
- `users` — usuarios com role e photo_url
- `cotacoes` — 19 campos custom + soft delete (deleted_at)
- `cotacao_docs` — documentos anexados (Vercel Blob)
- `metas` — metas globais e por cotador (UNIQUE user+ano+mes)
- `cotacao_history` — audit trail field-level
- `status_config` — 12 status com campos obrigatorios configuraves
- `comissao_tabela` — percentuais de comissao por seguradora/produto

### 4 SQL Views (scripts/create-views.ts)
- `vw_kpis` — KPIs agrupados por ano/mes/assignee
- `vw_status_breakdown` — contagem e total por status
- `vw_cotadores` — desempenho individual com photo_url
- `vw_monthly_trend` — tendencia mensal

### Padroes importantes
- `db.execute(sql)` retorna `{ rows: [...] }` — NAO array direto
- Zod v4: importar de `zod/v4`, usar `z.enum()` com `as const`
- Zod `.partial()` preserva `.default()` — criar schema separado para updates
- API helpers: `apiSuccess(data, status?)` e `apiError(msg, status)`
- `getCurrentUser()` de `@/lib/auth-helpers` para auth em API routes
- Transacoes: `db.transaction(async (tx) => { ... })` para update+history

## Paginas (9)

| Rota | Descricao | Acesso |
|------|-----------|--------|
| `/login` | Tela de login | Publica |
| `/dashboard` | KPIs, graficos, cotadores, metas | Todos |
| `/cotacoes` | Lista/Kanban toggle, bulk ops, filtros | Todos |
| `/cotacoes/new` | Criar cotacao | Todos |
| `/cotacoes/[id]` | Detalhe + historico | Todos |
| `/renovacoes` | Renovacoes com alertas 60/30/15 dias | Todos |
| `/calendario` | Calendario mensal de eventos | Todos |
| `/relatorios` | Relatorio gerencial com ranking | Admin |
| `/usuarios` | Gestao de usuarios | Admin |
| `/status-config` | Config campos obrigatorios por status | Admin |

## API Routes (21)

| Rota | Metodos | Descricao |
|------|---------|-----------|
| `/api/auth/[...nextauth]` | GET/POST | Auth.js endpoints |
| `/api/cotacoes` | GET/POST | Listar (paginado, filtros) / Criar |
| `/api/cotacoes/[id]` | GET/PUT/DELETE | Detalhe / Editar / Soft delete |
| `/api/cotacoes/[id]/docs` | GET/POST | Listar / Upload docs |
| `/api/cotacoes/[id]/history` | GET | Audit trail |
| `/api/cotacoes/bulk` | POST | Bulk update status / delete |
| `/api/cotacoes/export` | GET | Export CSV |
| `/api/cotacoes/import` | POST | Import CSV (FormData) |
| `/api/cotacoes/seguradoras` | GET | Valores distintos para filtros |
| `/api/dashboard` | GET | KPIs + views SQL (Promise.all) |
| `/api/calendario` | GET | Eventos do mes |
| `/api/relatorios` | GET | Relatorio gerencial |
| `/api/renovacoes` | GET | Renovacoes com alertas |
| `/api/comissao-tabela` | GET/POST | Tabela % comissao |
| `/api/kpis` | GET | KPIs simplificado |
| `/api/metas` | GET/POST/PUT | CRUD metas |
| `/api/status-config` | GET | Listar status configs |
| `/api/status-config/[id]` | PUT | Editar status config |
| `/api/users` | GET/POST | Listar / Criar usuario |
| `/api/users/[id]` | GET/PUT | Detalhe / Editar usuario |
| `/api/cron/atrasados` | POST | Auto-status atrasado (CRON_SECRET) |

## Identidade Visual

- **Font:** Poppins (Google Fonts)
- **Azul primario:** `#03a4ed` / hover: `#0288d1`
- **Coral:** `#ff695f` / hover: `#e55a50`
- **Gradient coral:** `linear-gradient(105deg, rgba(255,104,95,1) 0%, rgba(255,144,104,1) 100%)`
- **Header:** dark gradient `#1e293b -> #0f172a`
- **Rounded:** `xl` inputs, `2xl` cards
- **CSS vars** definidas em `globals.css`, tema Tailwind via `@theme inline`

## Status do Projeto (2026-03-29)

- **Epic 1 (Hardening):** 6/6 stories DONE
- **Epic 2 (CRM Upgrade):** 10/11 stories DONE (11.2 email pendente)
- **Build:** 34 rotas, 0 erros TypeScript
- **Deploy:** Vercel production

@AGENTS.md
