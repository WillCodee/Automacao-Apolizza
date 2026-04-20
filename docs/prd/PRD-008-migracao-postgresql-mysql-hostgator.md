# PRD-008 — Migração PostgreSQL → MySQL (HostGator VPS)

> **Status:** Aprovado para execução
> **Data:** 2026-04-19
> **Autor:** Dara (@data-engineer)
> **Motivação:** Decisão do proprietário — consolidar infraestrutura no VPS HostGator com MySQL
> **Banco origem:** Neon PostgreSQL 16 (sa-east-1) — 13 MB, 3.369 cotações
> **Banco destino:** MySQL 8.0 no VPS HostGator (SSH root)

---

## 1. Escopo da Migração

### 1.1 O que muda

| Camada | De | Para |
|--------|------|------|
| **Database engine** | PostgreSQL 16 | MySQL 8.0 |
| **Driver** | `@neondatabase/serverless` (HTTP) | `mysql2` (TCP pool) |
| **ORM dialect** | `drizzle-orm/pg-core` | `drizzle-orm/mysql-core` |
| **Drizzle config** | `dialect: "postgresql"` | `dialect: "mysql"` |
| **Schema** | `pgTable`, `pgEnum`, `uuid`, `jsonb` | `mysqlTable`, `varchar`, `char`, `json` |
| **SQL Views** | PostgreSQL syntax (FILTER WHERE, ::cast) | MySQL syntax (CASE WHEN, CAST) |
| **Raw SQL** | 62 arquivos com syntax PostgreSQL | Reescrever para MySQL |
| **Hosting** | Neon serverless (sa-east-1) | VPS HostGator (MySQL local) |
| **CONNECTION_URL** | `postgresql://...neon.tech/neondb` | `mysql://crmadmin:...@localhost/apolizza_crm` |

### 1.2 O que NÃO muda

- Next.js 16 (framework)
- Auth.js v5 (autenticação)
- Vercel (deploy frontend) — ou migra app para VPS também (decisão separada)
- Estrutura de componentes React
- API routes (paths mantidos, só SQL interno muda)
- Telegram bot
- Lógica de negócio

---

## 2. Inventário de Impacto

### 2.1 Resumo quantitativo

| Item | Quantidade | Complexidade |
|------|-----------|-------------|
| Tabelas para converter (pgTable → mysqlTable) | **18** | Alta |
| Enums PostgreSQL (pgEnum) | **3** | Média |
| Colunas UUID (.defaultRandom()) | **20+** | Alta |
| Timestamps com timezone | **25+** | Média |
| Colunas JSONB | **4** | Baixa |
| SQL Views para reescrever | **4** | Alta |
| Arquivos com raw SQL | **62** | Alta |
| Type casts `::int`, `::float` etc | **186** | Média (regex) |
| `FILTER (WHERE ...)` | **43** | Alta |
| `ILIKE` | **11** | Média |
| `RETURNING` clause | **10+** | Média |
| `INTERVAL` syntax | **9** | Média |
| Relations (Drizzle) | **15** | Baixa (mesma API) |
| Scripts (seed, migrate, views) | **8** | Média |
| **Total de arquivos afetados** | **82+** | |

### 2.2 Mapa de conversão PostgreSQL → MySQL

| PostgreSQL | MySQL | Ocorrências | Complexidade |
|-----------|-------|-------------|-------------|
| `uuid` type + `defaultRandom()` | `CHAR(36)` + `crypto.randomUUID()` no app | 20+ | Alta |
| `pgTable()` | `mysqlTable()` | 18 | Média (mecânico) |
| `pgEnum()` | `mysqlEnum()` ou `varchar()` | 3 | Média |
| `timestamp with timezone` | `DATETIME` (UTC no app) | 25+ | Média |
| `jsonb` | `json` | 4 | Baixa |
| `decimal(12,2)` | `DECIMAL(12,2)` | 8 | Nenhuma (igual) |
| `::int` | `CAST(... AS SIGNED)` | ~80 | Média (regex) |
| `::float` | `CAST(... AS DOUBLE)` | ~60 | Média (regex) |
| `::numeric` | `CAST(... AS DECIMAL)` | ~30 | Média (regex) |
| `::date` | `DATE(...)` | ~16 | Média |
| `FILTER (WHERE ...)` | `SUM(CASE WHEN ... THEN 1 ELSE 0 END)` | 43 | Alta |
| `ILIKE` | `LIKE` (MySQL default case-insensitive) | 11 | Baixa |
| `INSERT ... RETURNING *` | `INSERT` + `SELECT` (2 queries) | 10+ | Média |
| `INTERVAL '1 day'` | `INTERVAL 1 DAY` | 9 | Baixa |
| `NOW()` | `NOW()` | ~20 | Nenhuma (igual) |
| `COALESCE()` | `COALESCE()` | ~19 | Nenhuma (igual) |
| `NULLIF()` | `NULLIF()` | ~4 | Nenhuma (igual) |
| `gen_random_uuid()` | Não existe — gerar no app | 20+ | Alta |

---

## 3. Plano de Execução — 7 Fases

### Fase 1: Preparação do VPS (1 dia)

**Pré-requisito:** Acesso SSH root ao VPS HostGator

```bash
# 1. Verificar MySQL instalado
mysql --version

# 2. Criar database e usuário
mysql -u root -p
CREATE DATABASE apolizza_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'crmadmin'@'localhost' IDENTIFIED BY 'Inoclick@2026';
GRANT ALL PRIVILEGES ON apolizza_crm.* TO 'crmadmin'@'localhost';
FLUSH PRIVILEGES;

# 3. Verificar conexão
mysql -u crmadmin -p apolizza_crm -e "SELECT 1"
```

**Se o banco já existe** (usuário informou que sim), apenas validar acesso.

**Entregável:** Conexão MySQL funcionando via SSH.

---

### Fase 2: Reescrita do Schema (2 dias)

**Arquivo:** `src/lib/schema.ts` (669 linhas → ~700 linhas)

**Conversões necessárias:**

```typescript
// ANTES (PostgreSQL)
import { pgTable, pgEnum, uuid, jsonb, timestamp } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "cotador", "proprietario"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  role: userRoleEnum("role").notNull().default("cotador"),
  tags: jsonb("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// DEPOIS (MySQL)
import { mysqlTable, mysqlEnum, char, json, datetime, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: char("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  role: mysqlEnum("role", ["admin", "cotador", "proprietario"]).notNull().default("cotador"),
  tags: json("tags").$type<string[]>().default([]),
  createdAt: datetime("created_at").notNull().$defaultFn(() => new Date()),
});
```

**Tabelas a converter (18):**

1. `users`
2. `cotacoes`
3. `cotacaoDocs`
4. `metas`
5. `cotacaoHistory`
6. `statusConfig`
7. `situacaoConfig`
8. `comissaoTabela`
9. `tarefas`
10. `tarefasBriefings`
11. `tarefasAnexos`
12. `tarefasAtividades`
13. `tarefasChecklist`
14. `cotacaoNotificacoes`
15. `cotacaoMensagens`
16. `gruposUsuarios`
17. `grupoMembros`
18. `chatMensagens` + `chatLeituras` (2 tabelas = 19-20 total)
19. `regrasAuditoria`

**Atenção especial:**
- UUID: `char("id", { length: 36 }).$defaultFn(() => crypto.randomUUID())`
- Enum: `mysqlEnum("field", [...values...])` — inline, não separado
- JSONB → JSON: `json("field")` (mesma API, diferente engine)
- Timestamp: `datetime("field")` — MySQL não tem timezone-aware

**Entregável:** `schema.ts` reescrito e compilando sem erros.

---

### Fase 3: Reescrita do Driver + Config (meio dia)

**Arquivo 1:** `src/lib/db.ts`

```typescript
// ANTES
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });

// DEPOIS
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

const pool = mysql.createPool(process.env.DATABASE_URL!);
export const db = drizzle(pool, { schema, mode: "default" });
```

**Arquivo 2:** `drizzle.config.ts`

```typescript
// dialect: "postgresql" → "mysql"
```

**Arquivo 3:** `package.json`

```bash
npm uninstall @neondatabase/serverless
npm install mysql2
```

**Arquivo 4:** `.env.local`

```
# ANTES
DATABASE_URL=postgresql://neondb_owner:...@ep-winter-dawn-...neon.tech/neondb?sslmode=require

# DEPOIS
DATABASE_URL=mysql://crmadmin:Inoclick%402026@<VPS_IP>:3306/apolizza_crm
```

**Entregável:** `db.ts` conectando ao MySQL do VPS.

---

### Fase 4: Reescrita das SQL Views (1 dia)

**Arquivo:** `scripts/create-views.ts`

**4 views para converter:**

#### vw_kpis (PostgreSQL → MySQL)

```sql
-- ANTES (PostgreSQL)
count(*) FILTER (WHERE LOWER(situacao) = 'fechado')::int AS fechadas

-- DEPOIS (MySQL)
CAST(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN 1 ELSE 0 END) AS SIGNED) AS fechadas
```

```sql
-- ANTES
COALESCE(SUM(a_receber::numeric) FILTER (WHERE LOWER(situacao) = 'fechado'), 0)::float AS total_a_receber

-- DEPOIS
COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS total_a_receber
```

```sql
-- ANTES
ROUND(count(*) FILTER (WHERE ...)::numeric / NULLIF(count(*), 0) * 100, 1)::float

-- DEPOIS
ROUND(SUM(CASE WHEN ... THEN 1 ELSE 0 END) / NULLIF(count(*), 0) * 100, 1)
```

**Padrão de conversão para TODAS as views:**

| PostgreSQL | MySQL |
|-----------|-------|
| `count(*) FILTER (WHERE cond)::int` | `CAST(SUM(CASE WHEN cond THEN 1 ELSE 0 END) AS SIGNED)` |
| `SUM(col::numeric) FILTER (WHERE cond)` | `SUM(CASE WHEN cond THEN CAST(col AS DECIMAL(12,2)) ELSE 0 END)` |
| `::int` | `CAST(... AS SIGNED)` |
| `::float` | Remove (MySQL retorna float por padrão em SUM) |
| `::numeric` | `CAST(... AS DECIMAL(12,2))` |

**Entregável:** 4 views criadas no MySQL e retornando dados corretos.

---

### Fase 5: Reescrita dos API Routes (3-5 dias)

**62 arquivos com raw SQL.** Organizados por prioridade:

#### P0 — Dashboard e KPIs (2 arquivos, crítico)

- `src/app/api/dashboard/route.ts`
- `src/app/api/dashboard/kanban/route.ts`

**Mudanças:** type casts, FILTER WHERE, views queries

#### P0 — Cotações CRUD (8 arquivos, core business)

- `src/app/api/cotacoes/route.ts` — ILIKE → LIKE, casts, RETURNING
- `src/app/api/cotacoes/[id]/route.ts` — RETURNING, casts
- `src/app/api/cotacoes/bulk/route.ts` — RETURNING
- `src/app/api/cotacoes/export/route.ts` — ILIKE, casts
- `src/app/api/cotacoes/import/route.ts` — UUID generation
- `src/app/api/cotacoes/resgate/route.ts` — ILIKE, casts, FILTER WHERE
- `src/app/api/cotacoes/seguradoras/route.ts` — casts
- `src/app/api/cotacoes/[id]/mensagens/route.ts` — RETURNING

#### P1 — Relatórios e Renovações (3 arquivos)

- `src/app/api/relatorios/route.ts` — FILTER WHERE pesado
- `src/app/api/relatorios/evolucao/route.ts` — casts
- `src/app/api/renovacoes/route.ts` — INTERVAL, date casts

#### P1 — Tarefas (5 arquivos)

- `src/app/api/tarefas/route.ts`
- `src/app/api/tarefas/[id]/route.ts`
- `src/app/api/tarefas/[id]/status/route.ts`
- `src/app/api/tarefas/[id]/atividades/route.ts`
- `src/app/api/tarefas/metricas/route.ts`

#### P2 — Cron Jobs (5 arquivos)

- `src/app/api/cron/manha/route.ts`
- `src/app/api/cron/tarde/route.ts`
- `src/app/api/cron/atrasados/route.ts`
- `src/app/api/cron/auditoria/route.ts`
- `src/app/api/cron/tarefas-notificacoes/route.ts`

#### P2 — Demais rotas (~39 arquivos)

Metas, calendário, chat, notificações, auditoria, pedidos, users, config, etc.

**Padrão de refactor para cada arquivo:**

```typescript
// ANTES (PostgreSQL via Neon HTTP)
import { sql } from "drizzle-orm";
const result = await db.execute(sql`
  SELECT count(*)::int as total FROM cotacoes WHERE deleted_at IS NULL
`);
const data = result.rows[0];  // Neon retorna { rows: [...] }

// DEPOIS (MySQL via mysql2)
import { sql } from "drizzle-orm";
const [rows] = await db.execute(sql`
  SELECT CAST(count(*) AS SIGNED) as total FROM cotacoes WHERE deleted_at IS NULL
`);
const data = rows[0];  // mysql2 retorna [rows, fields]
```

**Mudança crítica no retorno:**
- Neon: `result.rows` (objeto com .rows)
- mysql2: `result[0]` ou destructuring `[rows]` (array de arrays)

**Entregável:** Todas as rotas compilando e retornando dados corretos do MySQL.

---

### Fase 6: Migração de Dados (1 dia)

**Estratégia:** Export PostgreSQL → Transform → Import MySQL

#### Passo 1: Export do Neon (PostgreSQL)

```bash
# Dump em formato CSV por tabela (mais portável)
psql $DATABASE_URL -c "\COPY users TO '/tmp/users.csv' WITH CSV HEADER"
psql $DATABASE_URL -c "\COPY cotacoes TO '/tmp/cotacoes.csv' WITH CSV HEADER"
# ... para cada tabela
```

Ou via script TypeScript que faz SELECT → gera INSERT MySQL.

#### Passo 2: Criar tabelas no MySQL

```bash
npx drizzle-kit push  # com o novo schema MySQL
```

#### Passo 3: Import no MySQL

```bash
# Via LOAD DATA INFILE (mais rápido)
mysql -u crmadmin -p apolizza_crm -e "
LOAD DATA LOCAL INFILE '/tmp/users.csv'
INTO TABLE users
FIELDS TERMINATED BY ','
ENCLOSED BY '\"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;
"
```

Ou via script TypeScript de migração.

#### Passo 4: Validação

```sql
-- Comparar row counts
SELECT 'users' as t, count(*) FROM users
UNION ALL SELECT 'cotacoes', count(*) FROM cotacoes WHERE deleted_at IS NULL
UNION ALL SELECT 'metas', count(*) FROM metas
-- ... etc
```

#### Passo 5: Criar views

```bash
npx tsx scripts/create-views.ts  # versão MySQL
```

**Entregável:** Dados migrados e validados (row count identico).

---

### Fase 7: Testes e Deploy (1-2 dias)

#### Checklist de validação

- [ ] Login funciona
- [ ] Dashboard carrega KPIs corretos
- [ ] Dashboard carrega gráficos
- [ ] Dashboard carrega ranking cotadores
- [ ] Listar cotações (paginação)
- [ ] Filtrar cotações (status, ano, busca)
- [ ] Criar cotação
- [ ] Editar cotação (com history)
- [ ] Soft delete cotação
- [ ] Bulk update
- [ ] Export CSV
- [ ] Import CSV
- [ ] Upload documento
- [ ] Tarefas CRUD
- [ ] Tarefas checklist
- [ ] Metas CRUD
- [ ] Renovações com alertas
- [ ] Calendário
- [ ] Relatório gerencial
- [ ] Chat (enviar/receber)
- [ ] Notificações (criar/marcar lida)
- [ ] Telegram webhook
- [ ] Cron manha/tarde
- [ ] Users CRUD
- [ ] Status config
- [ ] Situação config

**Entregável:** Todos os checks passando em ambiente de staging.

---

## 4. Cronograma

| Fase | Duração | Dependência |
|------|---------|-------------|
| 1. Preparar VPS MySQL | 1 dia | Acesso SSH |
| 2. Reescrever schema.ts | 2 dias | — |
| 3. Reescrever db.ts + config | 0.5 dia | Fase 2 |
| 4. Reescrever views | 1 dia | Fase 3 |
| 5. Reescrever API routes (62 files) | 3-5 dias | Fase 3 |
| 6. Migrar dados | 1 dia | Fase 4 + 5 |
| 7. Testes + deploy | 1-2 dias | Fase 6 |
| **Total** | **9-12 dias úteis** | |

---

## 5. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|-------------|---------|-----------|
| Bugs silenciosos em agregações (FILTER→CASE) | Alta | Alto | Comparar resultados view por view com PostgreSQL |
| Perda de dados na migração | Baixa | Crítico | Manter Neon ativo até validação completa |
| Performance pior (MySQL shared vs Neon serverless) | Média | Médio | Benchmark pós-migração |
| 25 conexões simultâneas (se compartilhado) | Média | Alto | Confirmar que é VPS (sem limite) |
| RETURNING não funciona (10+ pontos) | Certa | Médio | Reescrever com INSERT + SELECT |
| UUID collision (gerado no app) | Desprezível | Baixo | crypto.randomUUID() é seguro |
| Timezone bugs | Média | Médio | Converter tudo UTC antes da migração |

---

## 6. Rollback

Se a migração falhar:
1. Reverter `DATABASE_URL` para Neon
2. Reverter branch git para `pre-mysql-migration`
3. Neon continua operacional (não deletar até 30 dias após migração bem-sucedida)

---

## 7. Dependências

### Pacotes a instalar
```bash
npm install mysql2
npm uninstall @neondatabase/serverless
```

### Informações pendentes do VPS

- [ ] IP do VPS HostGator
- [ ] Versão do MySQL instalada (`mysql --version`)
- [ ] Porta MySQL (padrão 3306)
- [ ] Confirmar que o banco `apolizza_crm` existe
- [ ] Confirmar que MySQL aceita conexão remota (se app continua na Vercel) ou apenas localhost (se app migra para VPS)

---

## 8. Decisão arquitetural: Onde roda a aplicação?

| Opção | App | DB | Latência | Complexidade |
|-------|-----|------|---------|-------------|
| **A) Vercel + MySQL remoto** | Vercel (EUA/Edge) | VPS HostGator (BR) | ~200ms por query | Precisa liberar MySQL para acesso externo + SSL |
| **B) Tudo no VPS** | VPS (PM2 + Nginx) | VPS (localhost) | ~1ms por query | Precisa configurar Nginx, PM2, SSL, deploy pipeline |

**Recomendação:** Opção B (tudo no VPS) — elimina latência cross-region e não expõe MySQL à internet.

Mas isso é escopo do PRD-005, não deste PRD. Aqui focamos na migração do banco.

---

*Documento sujeito a revisão durante execução. Manter Neon ativo como fallback por 30 dias.*
