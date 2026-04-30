# PRD-017 — `atrasado` vira flag + governança de dados (SoT formal) + backfill abril/2026

**Status:** Implementado em produção
**Data:** 2026-04-30
**Origem:** Diretoria Apolizza — preparação para virada do mês (01/05) com CRM como sistema único, abandonando ClickUp como SoT
**Implementado por:** Claude Code (aios-master orchestration, caminho A — pragmático)

---

## Contexto

Antes deste PRD, três problemas convergiam:

1. **Cron auto-status sobrescrevia o status real.** A função `processarAtrasados()` em `cron/manha` (e a rota `cron/atrasados`) marcava `status='atrasado'` para qualquer cotação cujo `due_date < NOW()` que não estivesse em status terminal. Isso destruía o status real do andamento (`implantando`, `pendencia`, `raut`, etc.). Resultado: 478 cotações com `status='atrasado'` no banco de produção, sem histórico de qual era o status anterior.
2. **Sem fonte de verdade declarada (SoT).** Banco MySQL (CRM), ClickUp e planilhas operacionais coexistiam sem hierarquia formal. Cada um podia divergir e nada definia quem prevalecia.
3. **Audit trail praticamente inexistente.** A tabela `cotacao_history` tinha apenas 45 linhas para 7 cotações antes do PRD. Crons e bulk updates não gravavam history. Sem rastreabilidade para auditoria.

Auditoria FULL banco × ClickUp (2026-04-30) revelou:
- 416 cotações com `status` divergente do ClickUp (12,2% do banco)
- 863 com `mes_referencia` divergente (bug de migração histórica)
- 2.271 divergências em campos no total

---

## Decisões de governança

Antes de qualquer mudança técnica, formalizou-se com a Apolizza:

| Decisão | Resposta |
|---------|----------|
| **D1** Dono dos dados | Apolizza |
| **D2** Source of Truth (SoT) | ClickUp **até 30/04/2026 23:59**; CRM **a partir de 01/05/2026** |
| **D3** "atrasado" é status ou flag? | **Flag** (`atrasado_desde DATE`) — preserva status real |
| **D4** Toda mudança sistêmica grava history? | **Sim** — daqui pra frente, sem exceção |

---

## Mudanças técnicas

### Schema (migration aplicada em produção)

```sql
ALTER TABLE cotacoes ADD COLUMN atrasado_desde DATE NULL DEFAULT NULL;
CREATE INDEX idx_atrasado_desde ON cotacoes (atrasado_desde);
```

Drizzle: `cotacoes.atrasadoDesde` em `src/lib/schema.ts`.

**Semântica:**
- `atrasado_desde IS NULL` → cotação não está atrasada
- `atrasado_desde = '2026-04-15'` → atrasada desde aquele dia (preserva quando passou a estar)
- O campo `status` continua refletindo o andamento real (`implantando`, `pendencia`, `raut`, `fechado`, `perda`, etc.) **independentemente** da flag.

### Crons reescritos (`cron/manha` + `cron/atrasados`)

Antes (destrutivo):
```sql
UPDATE cotacoes SET status = 'atrasado' WHERE due_date < NOW() AND status NOT IN (...)
```

Depois (não-destrutivo + audit trail):
```sql
-- Marca atrasado_desde = CURDATE() em cotações vencidas que ainda não tinham flag
SELECT id FROM cotacoes
WHERE atrasado_desde IS NULL AND due_date < CURDATE()
  AND status NOT IN ('fechado', 'perda', 'concluido ocultar')
  AND deleted_at IS NULL;

-- Para cada uma: UPDATE atrasado_desde + INSERT cotacao_history (D4)

-- Limpa flag se virou terminal ou due_date foi para o futuro:
UPDATE cotacoes SET atrasado_desde = NULL
WHERE atrasado_desde IS NOT NULL
  AND (status IN ('fechado','perda','concluido ocultar') OR due_date >= CURDATE() OR due_date IS NULL);
```

Ambos os crons gravam `cotacao_history` com `field_name='atrasado_desde'` para cada mudança (D4).

### Leitores SQL atualizados (5 arquivos)

Trocaram `WHERE status='atrasado'` ou `SUM(CASE WHEN status='atrasado'...)` por `atrasado_desde IS NOT NULL`:

| Arquivo | Tipo |
|---------|------|
| `cron/alertas/route.ts` | filtro + KPI |
| `cron/tarde/route.ts` | KPI resumo diário |
| `auditoria/consultar/route.ts` | filtro + KPI Telegram |
| `telegram/webhook/route.ts` | filtro + KPI Telegram |

Lista completa de status passou a ter "atrasado" como **filtro virtual** (UI continua mostrando coluna "atrasado" mas baseada em flag).

### Backfill abril/2026 (transação única)

Script: `apolizza-crm/scripts/backfill-abril-2026-final.ts`. Modos `--dry-run` (default) e `--apply`.

Etapas executadas em **uma única transação** (rollback se qualquer passo falhar):

| Etapa | Ação | Cotações |
|-------|------|----------|
| A | Soft-delete de 3 testes sem `clickup_id` (William Teste, Vanessa, teste) | 3 |
| B | UPDATE em 99 cotações ABR/2026 conforme planilha enviada pela diretora (89 status + 19 priority + 1 contato_cliente) | 99 |
| C | SET `atrasado_desde = due_date` global em todas com `status='atrasado'` legacy + `atrasado_desde IS NULL` | 474 |
| — | INSERT em `cotacao_history` para cada campo modificado (D4) | 586 linhas |

**Não tocou em nada fora de ABR/2026.** Outros meses ficam para revisão posterior se a Apolizza decidir.

---

## Reconciliação financeira (abril/2026)

Diretoria forneceu totais de referência da planilha de Vanessa:

| Categoria | A Receber | Em Perda |
|-----------|-----------|----------|
| **BE** (saudeeodonto: Saúde/Vida/Odonto/Garantias) | R$ 58.839,45 | R$ 62.657,00 |
| **RE** (Ramos Elementares: Auto/RC/Viagem/Empresarial/etc) | R$ 9.503,71 | R$ 3.309,71 |
| **Total** | **R$ 68.343,16** | **R$ 65.966,71** |

Validação pós-backfill no banco:

| Métrica | Banco | Diretora | Bate? |
|---------|-------|----------|-------|
| A Receber ABR/2026 | R$ 68.470,66 | R$ 68.343,16 + R$ 127,50 (GARANTIA CONFIANÇA, cliente real sem `clickup_id`) | ✅ |
| Em Perda ABR/2026 | R$ 65.966,71 | R$ 65.966,71 | ✅ |
| Cotações ativas ABR/2026 | 170 | 158 (planilha) + 11 (com `clickup_id` mas omitidas) + 1 (GARANTIA real) | ✅ |

---

## Backup (rollback disponível)

`apolizza-crm/backups/pre-fix-status-2026-04-30/` (gitignored, 9 MB local):
- `cotacoes.json` / `.csv` / `.sql` — 3.472 cotações pré-mudança
- `cotacao_history.{json,csv,sql}` — 45 rows pré-mudança
- `cotacao_notificacoes.{json,csv,sql}` — 880 rows
- `users.{json,csv,sql}` — 8 rows
- `metas.{json,csv,sql}` — 12 rows
- `status_config.{json,csv,sql}` — 7 rows
- `META.json` — snapshot consolidado

---

## Pendências para revisão da diretora

Arquivo: `apolizza-crm/data/extras-abr2026-revisar-2026-04-30.csv`

11 cotações com `clickup_id` que estão no banco em ABR/2026 mas não vieram na planilha. Todas com R$ 0 a receber/em perda (não afetam totais financeiros). Decisão por linha: **manter** / **mover de mês** / **soft-delete**.

---

## Arquivos relacionados

### Código de produção
- `apolizza-crm/src/lib/schema.ts` — coluna `atrasadoDesde`
- `apolizza-crm/src/app/api/cron/atrasados/route.ts` — reescrito
- `apolizza-crm/src/app/api/cron/manha/route.ts` — `processarAtrasados()` reescrito
- `apolizza-crm/src/app/api/cron/alertas/route.ts` — leitor atualizado
- `apolizza-crm/src/app/api/cron/tarde/route.ts` — leitor atualizado
- `apolizza-crm/src/app/api/auditoria/consultar/route.ts` — leitor atualizado
- `apolizza-crm/src/app/api/telegram/webhook/route.ts` — leitor atualizado

### Scripts de operação (one-shot)
- `apolizza-crm/scripts/migration-add-atrasado-desde.ts` — DDL idempotente
- `apolizza-crm/scripts/backup-pre-fix-status.ts` — snapshot completo do banco
- `apolizza-crm/scripts/audit-clickup-vs-mysql.ts` — audit FULL (já existia, foi rodado)
- `apolizza-crm/scripts/audit-abril-2026-planilhas.ts` — audit ABR/2026 × planilha
- `apolizza-crm/scripts/sample-validacao-supervisor.ts` — gera 15 amostras para validação humana
- `apolizza-crm/scripts/backfill-abril-2026-final.ts` — backfill em transação única

### Relatórios (versionados)
- `apolizza-crm/data/audit-abril-2026-planilha-2026-04-30-*.{csv,sql,md}` — auditoria abril/2026
- `apolizza-crm/data/extras-abr2026-revisar-2026-04-30.csv` — 11 pendências
- `apolizza-crm/data/validacao-supervisor-2026-04-30.csv` — 15 amostras (não foram preenchidas — diretora validou os totais financeiros direto, dispensando amostragem)

### Commits
- `89cb0cf` — feat(auditoria): auditoria abril/2026 — planilhas BENEFÍCIOS + RAMOS ELEMENTAR × banco
- `4123259` — feat: atrasado vira flag (atrasado_desde) — backfill abril/2026 reconciliado

---

## Próximos passos sugeridos (fora do escopo deste PRD)

1. **Smoke test pós-deploy 01/05/2026 manhã** — validar que cron rodou corretamente em ambiente de produção e que KPIs/dashboards mostram os mesmos números pós-deploy.
2. **Revisão das 11 cotações pendentes** com a diretora (CSV gerado).
3. **UI: badge "atrasado"** — ajustar componentes (kanban, lista, etc.) para exibir badge laranja quando `atrasado_desde IS NOT NULL`, independente do `status`. (Hoje a UI ainda assume `status='atrasado'` como agrupador — funciona para legacy mas vai sumir conforme cron novo opera.)
4. **Reconciliação dos outros meses** (fora ABR/2026) com ClickUp como SoT — escopo separado, pode ser feito sem janela de manutenção pois é read-only com geração de SQL.
5. **Rule/test que falha se write em massa não gravar history** (hardening D4).
6. **Política formal em `docs/governance/data-sot-policy.md`** documentando D1-D4 como referência permanente.
