# Auditoria 2026 — Lista de Achados

**Data:** 2026-04-30
**Auditor:** Claude Code
**Escopo:** Cotações com `ano_referencia=2026` (504 ativas no banco vs 518 no ClickUp)
**`audit_run_id`:** `audit-2026-2026-04-30`
**Snapshot ClickUp:** `data/clickup-snapshot-cotacoes-2026-04-30.json`

> Auditoria desconsiderou as **158 cotações ABR/2026** vindas das 2 planilhas (decisão: planilha = SoT para esse mês).

---

## Sumário executivo

| Categoria | Quantidade | Status |
|---|---|---|
| Cotações auditadas | 347 | — |
| Correções aplicadas (logged) | **297** | ✅ |
| Pendentes para revisão manual | **89** | ⚠ |
| Cotações inseridas (ausentes no banco) | 21 | ✅ |
| Cotações soft-deletadas | 5 | ✅ |
| Cotações teste puladas | 2 | ✅ |

---

## 🔴 Achado #1 — Typo histórico `CCLIENTE` no banco

**Severidade:** Alta (afeta 118 cotações)
**Causa raiz:** Migração antiga gravou label inválido. ClickUp atual só tem 6 opções para `SITUAÇÃO`: `IMPLANTAÇÃO, COTAR, CLIENTE, RAUT, FECHADO, PERDA/RESGATE`. O label `CCLIENTE` **nunca existiu** nas opções oficiais.

**Cotações afetadas:** 118 (115 ativas + 3 já deletadas)

**Ação tomada:** ✅ `UPDATE cotacoes SET situacao='CLIENTE' WHERE situacao='CCLIENTE'`

**Verificação:** `SELECT COUNT(*) FROM cotacoes WHERE situacao='CCLIENTE'` → 0

---

## 🟡 Achado #2 — 89 valores monetários ambíguos (parser × DB)

**Severidade:** Alta (afeta relatórios financeiros)
**Status:** ⚠ **Pendente — requer ground truth manual**

**Problema:** Em 89 cotações, ClickUp armazena currency como **string inteira sem ponto decimal** (ex: `"160"`, `"850"`, `"32"`). Isso é inconsistente com a metadata (`precision=2 BRL` deveria implicar minor units / centavos), e o parser atual divide por 100 — gerando `R$ 1,60`, `R$ 8,50`, `R$ 0,32`. Mas o banco tem o valor original **sem dividir**.

**Não é possível decidir só pelos dados** quem está certo:
- Se ClickUp tinha "160" significando R$ 1,60 → parser correto, banco errado
- Se ClickUp tinha "160" significando R$ 160,00 → parser errado, banco correto

**Distribuição dos valores raw mais comuns:**
| Raw | Frequência | Parser dá | Banco tem |
|---|---|---|---|
| `"160"` | 20 | R$ 1,60 | R$ 160 |
| `"850"` | 14 | R$ 8,50 | R$ 850 |
| `"32"` | 10 | R$ 0,32 | R$ 32 |
| `"290"` | 4 | R$ 2,90 | R$ 290 |
| `"105"` | 3 | R$ 1,05 | R$ 105 |
| `"190"` | 3 | R$ 1,90 | R$ 190 |
| `"700"` | 3 | R$ 7,00 | R$ 700 |

**Ação requerida:** Você (Gustavo) precisa abrir 3-4 cotações no ClickUp UI e confirmar qual o valor real:
- `JF PRADO - LICITANTE 01-0775-0588580` (`86b829jc7`) — `valorPerda` raw=`160` é R$1,60 ou R$160?
- `THE CLOSET TREND ODONTO PME` (`86b8132mg`) — `valorPerda` raw=`49800` é R$498 ou R$49.800?
- `CONFIANÇA SERVIÇOS - ADENILSON` (`86b...`) — raw=`700` é R$7 ou R$700?

Com a resposta, **fix em massa** ajustando o parser para a política correta.

**Lista completa:** `data/audit-2026-v2-2026-04-30-currency-ambiguo.csv`

---

## 🟡 Achado #3 — Bagunça nas opções de dropdown do ClickUp

**Severidade:** Média (não tem fix técnico, é higiene de ClickUp)
**Status:** ⚠ **Reportar para limpeza no ClickUp UI**

ClickUp tem opções **duplicadas e com typos** que poluem o banco:

### `MES` (12 opções esperadas, tem 14)
- `12: OU4` (typo de "OUT")
- `13: MAIOI` (typo de "MAIO")

### `PRODUTO` (52 opções, com duplicatas)
- `14: SAÚDE PF` ↔ `43: SAUDE PF` (com/sem acento)
- `18: GARANTIA` ↔ `45: GARATIA` (typo)
- `23: CONDOMÍNIO` ↔ `49: CONDOMINIO` (com/sem acento)
- `15: SAÚDE PME` ↔ `46: PME/SUZANA` ↔ `50: MPE` ↔ `51: PME` (4 variações)

**Recomendação:** consolidar opções no ClickUp UI para evitar fragmentação de relatórios por produto.

---

## 🟢 Achado #4 — Tier MÉDIA: 138 divergências de campos operacionais

**Severidade:** Média
**Causa raiz:** Cotações editadas no ClickUp **depois** da migração; banco ficou desatualizado.

**Campos afetados:**
| Campo | Divergências |
|---|---|
| `status` | 94 |
| `situacao` | 19 |
| `mesReferencia` | 17 |
| `dueDate` | 6 |
| `inicioVigencia` | 1 |
| `fimVigencia` | 1 |

**Ação tomada:** ✅ Sync automático com valores do ClickUp ao vivo, com log em `cotacao_auditoria_correcoes`.

---

## 🟢 Achado #5 — Tier BAIXA: 16 divergências cosméticas

**Severidade:** Baixa
**Campos afetados:** `proximaTratativa` (12), `seguradora` (2), `priority` (1), `indicacao` (1)

**Sub-achado:** `proximaTratativa` apresentava ~1 dia de diferença consistente entre ClickUp e banco. **Não é bug de timezone do parser** (verificado: 0 timestamps caem entre 00:00–03:00 UTC). Provável causa: migração antiga aplicou offset incorreto na coluna DATE.

**Ação tomada:** ✅ Sync com valores do ClickUp.

---

## 🟢 Achado #6 — 1 cotação com todos os campos financeiros NULL

**Severidade:** Alta (mas isolado — 1 caso)
**Cotação:** `8a157d9a-d8f1-4faf-8f83-55c687314628` (clickup_id pendente confirmação)

Banco tinha `parceladoEm`, `premioSemIof`, `aReceber`, `comissao` todos `NULL`. ClickUp tinha:
- `parceladoEm`: 12
- `premioSemIof`: R$ 1.680,34
- `aReceber`: R$ 250,05
- `comissao`: 15

**Ação tomada:** ✅ Populated no banco.

---

## 🟢 Achado #7 — 21 cotações 2026 ausentes no banco

**Severidade:** Alta (cotações não estavam aparecendo no CRM)
**Causa raiz:** Criadas no ClickUp depois da última migração; nunca foram sincronizadas.

**Ação tomada:** ✅ Importadas via ClickUp API. 2 testes (`Testando a Automação`, `TESTE`) foram explicitamente puladas.

**Lista das importadas:** ver console output do `audit-2026-finalize.ts` — incluem cotações de ABR, MAR, MAIO/2026 (várias de SEGURO VIAGEM, BIANCA, etc.).

---

## 🟢 Achado #8 — 5 cotações no banco sem correspondência no ClickUp

**Severidade:** Média
**Status:** ✅ Resolvido

Investigação via `GET /task/{id}`:
- **1 retornou 404** (`86b9enhxx` — MARIA DE LOURDES) → cotação deletada no ClickUp → soft-delete
- **4 retornaram 200 mas estão na lista `PEDIDOS`** (`list_id=900701918394`):
  - `86b8pxp5h` — TATIANA LIMA - RESIDENCIAL
  - `86b8r1tng` — ROSELY AICO SANTANA KANASHIRO
  - `86b8v48j0` — ALEX ALMEIDA REFRIGERAÇÃO
  - `86b8bafxa` — VICTORIA APARECIDA FARES LOPES

**Interpretação:** Cotações foram **promovidas a pedido** no ClickUp (movidas para outra lista do funil), mas o CRM não tem essa transição modelada — continuam aparecendo como cotação.

**Ação tomada:** ✅ Soft-delete no banco (com `fonte='clickup-moved-to-pedidos'` no log para rastreabilidade).

**Recomendação de produto:** considerar criar fluxo de "cotação → pedido" no CRM e ouvir webhook do ClickUp quando uma task muda de lista.

---

## 🔵 Achado #9 — 4 cotações ABR/2026 sem `clickup_id` (CRM-native)

**Severidade:** Baixa (informacional)
**Status:** Mantidas (decisão prévia — preservar)

São cotações criadas direto no CRM, sem origem ClickUp. Estavam fora do escopo da auditoria. Preservadas conforme política inicial.

---

## 📊 Resumo de correções (logged em `cotacao_auditoria_correcoes`)

| Tier / Categoria | Correções | INSERT no log |
|---|---|---|
| MEDIA — `CCLIENTE→CLIENTE` | 118 | 118 |
| MEDIA — sync campos operacionais | 138 | 138 |
| BAIXA — sync campos cosméticos | 16 | 16 |
| ALTA — cotação 8a157d9a (NULL→valores) | 4 | 4 |
| MEDIA — soft-delete 5 extras | 5 | 5 |
| **Total rastreado** | **281** | **281** |

**Rollback:** todas as correções podem ser revertidas via:
```sql
SELECT cotacao_id, campo, valor_antigo
FROM cotacao_auditoria_correcoes
WHERE audit_run_id='audit-2026-2026-04-30';
```

---

## 🚧 Pendências

| # | Item | Ação requerida | Bloqueador |
|---|---|---|---|
| 1 | 89 currency ambíguos | Ground truth via ClickUp UI (3-4 amostras) | Aguardando Gustavo |
| 2 | Higiene ClickUp (dropdowns com typos) | Limpeza manual no ClickUp UI | Aguardando Gustavo |
| 3 | Webhook lista `PEDIDOS` | Decisão de produto + implementação | Não auditoria |
| 4 | Auditoria das 158 cotações ABR/2026 da planilha | Nenhuma (planilha = SoT por decisão) | Resolvido |

---

## Arquivos gerados

```
data/
├── clickup-snapshot-cotacoes-2026-04-30.json    (snapshot 3.429 tasks)
├── audit-2026-v2-2026-04-30.json                (relatório completo)
├── audit-2026-v2-2026-04-30-divergencias.csv    (todas divergências detalhadas)
├── audit-2026-v2-2026-04-30-ausentes.csv        (resolvido)
├── audit-2026-v2-2026-04-30-extras.csv          (resolvido)
├── audit-2026-v2-2026-04-30-currency-ambiguo.csv (89 — pendente)
├── audit-2026-v2-2026-04-30-fix-baixa.sql       (executado)
├── audit-2026-v2-2026-04-30-fix-media.sql       (executado)
├── audit-2026-v2-2026-04-30-fix-alta-APROVACAO.sql (executado)
├── audit-2026-v2-2026-04-30-fix-cliente-typo.sql (executado)
├── audit-2026-v2-2026-04-30-extras-deletar.sql  (informativo)
├── audit-2026-v2-2026-04-30-ddl.sql             (executado — cria tabela log)
└── audit-2026-achados.md                         (este arquivo)
```

## Scripts

```
scripts/
├── audit-2026-clickup.ts     (Fase 1+2: snapshot + audit v1)
├── audit-2026-v2.ts          (Fase 2 refinada: comparador melhorado, tiers, SQL)
├── audit-2026-finalize.ts    (Etapa 2b+2c: extras 404 + insert ausentes)
└── run-sql-file.ts           (utility: executa SQL com multipleStatements)
```
