# PRD-003 — Migração Completa ClickUp → Apolizza CRM (v2)

**Data:** 2026-04-13
**Status:** CONCLUIDO
**Autor:** Gustavo + Claude

---

## 1. Objetivo

Sincronizar todos os dados do ClickUp com o Apolizza CRM, corrigindo mapeamentos desatualizados e melhorando a cobertura de campos na segunda rodada de migração.

## 2. Contexto

- Primeira migração realizada em 02/04/2026 com 3.197 cotações
- Script existente: `apolizza-crm/scripts/migrate-clickup.ts`
- Problemas identificados: UUID do campo ANO desatualizado, ANO_MAP invertido, campo OBSERVAÇÃO não mapeado, inferência de ANO incompleta

## 3. Problemas Corrigidos

### 3.1 UUID do campo ANO desatualizado
- **Antes:** `abd866e7-15da-4b11-be2a-4d20491032d5`
- **Depois:** `95fcbbf2-23cd-45dd-a9e3-dcad386e05e9`

### 3.2 ANO_MAP com orderindex errado
- **Antes:** `{0:2023, 1:2024, 2:2025, 3:2026, 4:2027, 5:2028}`
- **Depois:** `{0:2026, 1:2025, 2:2027, 3:2024}`

### 3.3 Inferência de ANO incompleta
- **Antes:** fallback apenas para `due_date`
- **Depois:** cadeia de fallback: ANO dropdown → `start_date` → `due_date` → `date_created`

### 3.4 Campo OBSERVAÇÃO não mapeado
- **Antes:** usava apenas `task.description`
- **Depois:** custom field OBSERVAÇÃO (UUID: `a8d0ccc1-c30b-4fe4-8514-7ce1841d8b16`) com fallback para `task.description`

### 3.5 Preservação de campos exclusivos do CRM
- `contatoCliente` removido do `.set()` do upsert para não sobrescrever com null
- `valorParcelado` e `comissaoParcelada` não tocados (campos JSONB exclusivos do CRM)

### 3.6 Tipo ClickUpTask incompleto
- Adicionado `start_date: string | null` à interface

## 4. Arquivo Modificado

- `apolizza-crm/scripts/migrate-clickup.ts`

## 5. Resultado da Migração

### 5.1 Numeros

| Metrica | Valor |
|---------|-------|
| Total extraido (ClickUp API) | 6.701 tasks |
| Cotações (lista principal) | 3.339 |
| Renovações (space separado) | 3.362 |
| Inseridas (novas) | 170 |
| Atualizadas | 6.531 |
| Erros | 0 |
| Duração | ~20 min |

### 5.2 Status Breakdown

| Status | Quantidade |
|--------|-----------|
| fechado | 3.207 |
| perda | 1.896 |
| pendencia | 562 |
| atrasado | 458 |
| concluido ocultar | 236 |
| não iniciado | 199 |
| implantando | 72 |
| raut | 56 |
| a fazer | 9 |
| feito | 4 |
| em andamento | 2 |

### 5.3 Resumo Financeiro

| Campo | Valor |
|-------|-------|
| A Receber | R$ 5.489.690,72 |
| Prêmio s/ IOF | R$ 23.568.240,48 |
| Valor Perda | R$ 14.051.084,47 |
| Comissão | R$ 183.125,60 |

### 5.4 Verificação

- 3.197/3.197 cotações do Excel confirmadas no banco (100%)
- 0 cotações sem ano (cobertura total)
- 170 cotações extras no banco (criadas após exportação Excel — esperado)
- 4 SQL Views atualizadas com sucesso

### 5.5 Cobertura de Campos (3.367 cotações)

| Campo | Preenchidos | Nulos | % Nulo | Observação |
|-------|------------|-------|--------|------------|
| status | 3.367 | 0 | 0% | |
| ano_referencia | 3.367 | 0 | 0% | Corrigido nesta versão |
| is_renovacao | 3.367 | 0 | 0% | |
| produto | 3.292 | 75 | 2.2% | |
| assignee_id | 3.287 | 80 | 2.4% | |
| indicacao | 3.208 | 159 | 4.7% | |
| due_date | 2.981 | 386 | 11.5% | |
| mes_referencia | 2.980 | 387 | 11.5% | |
| seguradora | 2.577 | 790 | 23.5% | |
| observacao | 2.444 | 923 | 27.4% | Melhorado nesta versão |
| proxima_tratativa | 2.295 | 1.072 | 31.8% | |
| premio_sem_iof | 2.070 | 1.297 | 38.5% | |
| comissao | 2.030 | 1.337 | 39.7% | |
| situacao | 2.033 | 1.334 | 39.6% | |
| fim_vigencia | 2.017 | 1.350 | 40.1% | |
| tipo_cliente | 1.908 | 1.459 | 43.3% | |
| contato_cliente | 1.894 | 1.473 | 43.7% | Não existe no ClickUp |
| a_receber | 1.607 | 1.760 | 52.3% | |
| parcelado_em | 1.551 | 1.816 | 53.9% | |
| valor_perda | 968 | 2.399 | 71.3% | Normal: só cotações "perda" |
| inicio_vigencia | 463 | 2.904 | 86.2% | Raramente preenchido no ClickUp |
| primeiro_pagamento | 187 | 3.180 | 94.4% | Raramente preenchido no ClickUp |

**Nota:** Os campos nulos refletem dados não preenchidos no ClickUp, não falhas do script.

## 6. Distribuição por Ano

| Ano | Cotações |
|-----|---------|
| 2023 | 587 |
| 2024 | 1.157 |
| 2025 | 1.188 |
| 2026 | 434 |
| 2027 | 1 |

## 7. Artefatos Gerados

- `data/clickup-backup-2026-04-13.json` — backup bruto das 6.701 tasks
- `data/migration-report-2026-04-13.json` — relatório completo da migração

## 8. Como Reproduzir

```bash
cd apolizza-crm

# Dry-run (sem escrita no banco)
npx tsx scripts/migrate-clickup.ts --dry-run

# Migração real
npx tsx scripts/migrate-clickup.ts

# Verificação
npx tsx scripts/verify-final-complete.ts

# Atualizar views
npx tsx scripts/create-views.ts
```
