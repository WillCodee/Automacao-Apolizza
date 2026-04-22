# PRD-009 — Dashboard Hardening: Tipos e Conexoes MySQL

**Status:** Done
**Data:** 2026-04-20
**Autor:** Gustavo + Claude Code

---

## Problema

O dashboard do Apolizza CRM sofria de 3 problemas estruturais:

1. **Connection exhaustion** — HostGator limita 25 conexoes MySQL; Vercel serverless cria N instancias, cada uma com pool proprio. O hack anterior (setInterval destruindo conexoes internas do mysql2) era fragil e acessava APIs internas.

2. **Tipos inconsistentes** — MySQL retorna colunas DECIMAL como `string` via mysql2. Metade dos componentes frontend chamava `.toFixed()` ou `.toLocaleString()` em valores que podiam ser string, causando erros silenciosos ou `NaN`.

3. **Sem normalizacao centralizada** — Cada rota da API tratava (ou nao) a conversao de tipos de forma diferente. Nao havia garantia de que o frontend receberia `number`.

---

## Solucao Implementada

### Camada 1: Pool de Conexoes Robusto (`src/lib/db.ts`)

- Mantido `connectionLimit: 1` + `globalThis` para serverless
- Adicionado **retry com exponential backoff** (3 tentativas, 500ms base) no `dbQuery()` para tratar:
  - `ER_TOO_MANY_USER_CONNECTIONS`
  - `ECONNREFUSED`
  - `PROTOCOL_CONNECTION_LOST`
- Removido o `setInterval` hack que acessava `pool._freeConnections` (API interna do mysql2)
- Adicionado `pool.on('error')` para logging de erros fatais

### Camada 2: Utilitario de Normalizacao (`src/lib/normalize.ts`)

Funcoes utilitarias criadas:

| Funcao | Descricao |
|--------|-----------|
| `toNum(v)` | Converte qualquer valor para number (default 0) |
| `toNumOrNull(v)` | Converte para number ou retorna null |
| `normalizeRow(row, fields)` | Converte campos especificos de um objeto |
| `normalizeRows(rows, fields)` | Aplica normalizeRow em array |

### Camada 3: Normalizacao nas API Routes

| Rota | Campos normalizados |
|------|---------------------|
| `/api/dashboard` | KPIs (15 campos), statusBreakdown (2), monthlyTrend (8), cotadores (10) |
| `/api/dashboard/kanban` | `aReceber`, `valorPerda` |
| `/api/kpis` | `totalAReceber`, `totalValorPerda`, `taxaConversao`, contadores |
| `/api/relatorios` | KPIs, ranking, pipeline seguradora/produto, evolucao |
| `/api/metas` | `metaValor` (via `toNumOrNull`) |

### Camada 4: Views SQL com `+0` (`scripts/create-views.ts`)

Todas as colunas DECIMAL nas 4 views receberam `+0` para forcar MySQL a retornar DOUBLE (numerico) ao inves de DECIMAL (string):

- `vw_kpis`: `total_a_receber`, `total_valor_perda`, `total_premio`, `taxa_conversao`, `a_receber_renovacao`, `a_receber_novas`
- `vw_status_breakdown`: `total` (ambos os branches do CASE)
- `vw_cotadores`: `faturamento`, `taxa_conversao`, `faturamento_renovacao`, `faturamento_novas`
- `vw_monthly_trend`: `a_receber`, `a_receber_renovacao`, `a_receber_novas`

### Camada 5: Guards no Frontend (defesa em profundidade)

| Componente | Correcao |
|------------|----------|
| `monthly-chart.tsx` | `Number(d.aReceber).toLocaleString(...)` |
| `status-breakdown.tsx` | `Number()` no maxCount e width calc |
| `filtered-chart.tsx` | `Number()` nos 3 reduces |
| `weekly-goal-chart.tsx` | Normaliza todos campos ao receber da API |
| `metas-produto-chart.tsx` | `Number()` nos reduces de meta/realizado |
| `cotadores-table.tsx` | `Number(c.taxaConversao)` |

### Camada 6: Indice Composto

```sql
CREATE INDEX idx_cotacoes_kpi ON cotacoes(ano_referencia, mes_referencia, assignee_id, deleted_at);
```

Acelera todas as queries das views e das rotas de KPI/dashboard.

---

## Arquivos Modificados

| Arquivo | Acao |
|---------|------|
| `src/lib/db.ts` | Reescrito — retry + sem setInterval |
| `src/lib/normalize.ts` | **Criado** |
| `src/app/api/dashboard/route.ts` | Normaliza response |
| `src/app/api/dashboard/kanban/route.ts` | Normaliza response |
| `src/app/api/kpis/route.ts` | Normaliza response |
| `src/app/api/relatorios/route.ts` | Normaliza response |
| `src/app/api/metas/route.ts` | Normaliza metaValor |
| `scripts/create-views.ts` | +0 em DECIMALs |
| `src/components/dashboard/monthly-chart.tsx` | Number() guard |
| `src/components/dashboard/status-breakdown.tsx` | Number() guard |
| `src/components/dashboard/filtered-chart.tsx` | Number() guard |
| `src/components/dashboard/weekly-goal-chart.tsx` | Normaliza ao fetch |
| `src/components/dashboard/metas-produto-chart.tsx` | Number() guard |
| `src/components/dashboard/cotadores-table.tsx` | Number() guard |

---

## Verificacao

- [x] `npx tsc --noEmit` — 0 erros
- [x] `npm run build` — sucesso
- [x] `scripts/create-views.ts` executado em producao
- [x] Indice composto criado
- [x] Deploy em producao: https://apolizza-crm.vercel.app

---

## Decisoes Tecnicas

1. **Defesa em profundidade**: Normalizamos em 3 pontos (SQL views, API routes, frontend) para que uma falha em qualquer camada nao quebre o sistema.

2. **`+0` nas views vs CAST**: `+0` e mais conciso e forca MySQL a retornar DOUBLE. Alternativa seria `CAST(... AS DOUBLE)` mas e mais verbose.

3. **Retry no dbQuery vs middleware**: Retry diretamente no `dbQuery()` e mais simples e cobre 100% dos usos sem depender de middleware externo.

4. **toNum vs Number()**: `toNum()` trata `null`/`undefined` retornando 0, enquanto `Number(null)` retorna 0 mas `Number(undefined)` retorna NaN. Mais seguro para dados vindos do MySQL.
