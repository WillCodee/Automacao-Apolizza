# PRD-018 — TV Dashboard: KPIs precisos para a equipe (Pipeline, A Receber Total, Atrasadas, C.Cliente refinado)

**Status:** Implementado em produção
**Data:** 2026-04-30
**Origem:** Diretoria — TV exibida para toda a equipe precisa mostrar os mesmos números que a diretoria mentaliza, sem ambiguidade
**Implementado por:** Claude Code (aios-master / aios-devops)
**PRD relacionado:** [PRD-017](PRD-017-status-atrasado-flag-governanca-dados.md) (atrasado vira flag)

---

## Contexto

A TV (`/tv?token=…`, exibida em `crm.apolizza.com/tv?token=apolizza-tv-2026-secret`) tem dois objetivos:

1. **Visibilidade operacional** — equipe vê em tempo real o estado das cotações
2. **Alinhamento mental** — números que aparecem na TV devem coincidir com o que a diretoria fala em reunião

Após o backfill do PRD-017 (reconciliação ABR/2026 com a planilha da Vanessa), três problemas ficaram visíveis na TV:

### Problema 1 — Strip superior mostrando "Faturamento" R$ 15.578,62
A diretora trabalha com "A Receber abril R$ 68.343,16" (pipeline total). A TV mostrava só `a_receber` das **fechadas** rotulado como "Faturamento Total". A equipe via **R$ 15K** enquanto a diretoria falava em **R$ 68K** — incoerência semântica.

### Problema 2 — Slide "KPIs Detalhados" sem flag `atrasado_desde`
Após PRD-017, "atrasado" virou flag. A TV ainda contava só por status legacy, não refletia a realidade pós-backfill.

### Problema 3 — Slide "C.Cliente" com 3 falhas críticas
Auditoria do `LOWER(situacao) LIKE '%cliente%'` revelou:
- **144 cotações somadas de todos os anos** (sem filtro de mês) — equipe via número irreal
- **`valorPotencial = R$ 0`** em todas as 144 — o campo `a_receber` não é preenchido em CCLIENTE; métrica inútil
- **`emConversao = 144` (100%)** — definição via `updated_at >= NOW()-7d` ficou poluída pelo backfill recente que tocou em quase todas

---

## Mudanças implementadas

### 1. View `vw_kpis` ganha 3 colunas (`scripts/create-views.ts`)

```sql
SUM(CASE WHEN atrasado_desde IS NOT NULL THEN 1 ELSE 0 END) AS atrasadas,
SUM(CASE WHEN status NOT IN ('fechado','perda') THEN a_receber ELSE 0 END) AS total_pipeline,
SUM(CASE WHEN status <> 'perda' THEN a_receber ELSE 0 END) AS total_a_receber_total,
```

| Coluna | Significado |
|--------|-------------|
| `atrasadas` | count com flag `atrasado_desde` ativa (PRD-017) |
| `total_pipeline` | soma `a_receber` das em andamento (não fechadas, não perda) |
| `total_a_receber_total` | soma `a_receber` de todas exceto perda — **é o "A Receber Total" que a diretoria usa** |

Views recriadas em produção via `npx tsx scripts/create-views.ts`.

### 2. Strip superior da TV — `src/app/tv/page.tsx`

| Antes | Depois |
|-------|--------|
| `Faturamento` ← `totalAReceber` (só fechadas) | **`A Receber`** ← `totalAReceberTotal` (pipeline + realizado) |

Em ABR/2026: muda de **R$ 15.578,62** para **R$ 68.470,66** ✅ bate planilha diretora.

### 3. Slide "KPIs Detalhados" — `tv-kpis-slide.tsx` (3×3 grid)

9 cards divididos por linha conceitual:

```
📋 Total Cotações       ✅ Fechadas             ❌ Perdas
📈 A Receber Total      🎯 Pipeline             💰 Faturamento Realizado
⏰ Atrasadas            📊 Conversão            🏆 Prêmio s/IOF
```

| Card novo / renomeado | Origem | Por quê |
|-----------------------|--------|---------|
| **A Receber Total** | `totalAReceberTotal` | bate com vocabulário da diretoria |
| **Pipeline em Andamento** | `totalPipeline` | mostra valor potencial das ativas |
| **Faturamento Realizado** (ex-"Faturamento Total") | `totalAReceber` | desambigua: é só o que já fechou |
| **Atrasadas** | `atrasadas` (flag PRD-017) | KPI novo, hoje 97 em ABR/2026 |

### 4. Slide "C.Cliente — Conversões em Andamento" — `tv-ccliente-slide.tsx`

Query antiga (`/api/tv/route.ts`):
```sql
SELECT COUNT(*), SUM(a_receber), COUNT(CASE WHEN updated_at >= NOW()-7d ...)
FROM cotacoes WHERE LOWER(situacao) LIKE '%cliente%'
```

Query nova:
```sql
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN proxima_tratativa BETWEEN CURDATE()-7d AND CURDATE()+7d THEN 1 ELSE 0 END) AS emConversao,
  SUM(CASE WHEN proxima_tratativa = CURDATE() THEN 1 ELSE 0 END) AS tratativasHoje,
  SUM(CASE WHEN proxima_tratativa IS NULL THEN 1 ELSE 0 END) AS semTratativa
FROM cotacoes
WHERE deleted_at IS NULL AND LOWER(situacao) LIKE '%cliente%'
  AND ano_referencia = ${ano} AND UPPER(mes_referencia) IN (${mes}, ${mesFull})
```

Mudanças de fundo:
- **Filtro por mês corrente** (antes: histórico inteiro = 144; agora: ABR/2026 = 29)
- **`proxima_tratativa`** como sinal de "movimentação real" (antes: `updated_at` que pega mexidas técnicas como cron e bulk)
- **Card "Tratativas Hoje"** substitui "Potencial Total" (que sempre dava R$ 0 porque CCLIENTE não preenche `a_receber`)
- **"Taxa de Movimentação"** = emConversao / total (antes: emConversao/total dava sempre 100% inutilmente)

Valores atuais (ABR/2026, validados em produção):

| Card | Valor |
|------|-------|
| Total no Mês | 29 |
| Em Conversão (±7 dias) | 24 |
| Tratativas Hoje | 6 |
| Taxa de Movimentação | 82,8% |

---

## Reconciliação com a diretoria (ABR/2026)

| Métrica TV (após mudanças) | Valor | Fonte |
|----------------------------|-------|-------|
| Strip superior "A Receber" | R$ 68.470,66 | Planilha diretora R$ 68.343,16 + GARANTIA real R$ 127,50 ✅ |
| Slide KPIs "Pipeline" | R$ 64.192,49 | derivado |
| Slide KPIs "Faturamento Realizado" | R$ 4.278,17 | só fechadas |
| Slide KPIs "Em Perda" | R$ 65.966,71 | bate diretora ✅ |
| Slide KPIs "Atrasadas" | 97 cotações | flag PRD-017 |
| Slide CCliente "Em Conversão" | 24 / 29 | proxima_tratativa ±7 dias |

---

## Auto-deploy quebrado — workaround

Durante esse trabalho descobri que o **webhook GitHub→Vercel não disparou** auto-deploy para nenhum dos commits push (PRD-017, este). Causa-raiz não investigada (provável dessincronia do GitHub App).

**Workaround imediato:** rodar `vercel deploy --prod --yes` da raiz do repo. CLI já autenticado como owner do projeto.

Deploys manuais executados nesse PRD:
- `dpl_HU3wLEUrKwLFJAbHV5x9DaLHSKLa` — commit `0248d9c` (KPIs precisos)
- `dpl_…` — commit `11cda4e` (CCliente refinado, build 19s, total 47s)

**Pendência:** investigar webhook em Vercel Dashboard → Settings → Git para reativar auto-deploy.

---

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `apolizza-crm/scripts/create-views.ts` | +3 colunas em `vw_kpis` |
| `apolizza-crm/src/app/api/tv/route.ts` | SELECT novos campos + CCliente query refatorada |
| `apolizza-crm/src/app/tv/page.tsx` | Strip "A Receber" + interface CclienteData |
| `apolizza-crm/src/components/tv/tv-kpis-slide.tsx` | Grid 3×3 com 9 cards |
| `apolizza-crm/src/components/tv/tv-ccliente-slide.tsx` | 4 cards revisados (Tratativas Hoje, Taxa Movimentação) |

## Commits

- `0248d9c` — feat(tv): KPIs precisos para equipe — Pipeline, A Receber Total, Atrasadas
- `11cda4e` — fix(tv): C.Cliente filtra mês corrente e usa proxima_tratativa

---

## Próximos passos sugeridos (fora do escopo)

1. **Investigar webhook GitHub→Vercel** que parou de disparar auto-deploy
2. **Slides Ranking / Meta / Monthly** — fazer a mesma auditoria semântica que fiz aqui (KPIs / CCliente) para garantir que TODOS os slides batem com o vocabulário da diretoria
3. **Filtro de "atualizar" / refresh** na TV — adicionar botão ou polling com indicador para a equipe saber que está vendo dado fresco (hoje a TV recarrega automaticamente em intervalo, mas sem feedback visível)
4. **Corrigir bug histórico `mes_referencia='MAIO'`** (2 cotações de 2026 com `MAIO` em vez de `MAI`) — afeta agregações
