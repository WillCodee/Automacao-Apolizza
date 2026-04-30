# Auditoria Abril/2026 — Planilhas × Banco MySQL

**Data:** 2026-04-30
**Fonte:** Planilhas enviadas pelo cliente (BENEFÍCIOS + RAMOS ELEMENTAR)
**Filtro banco:** `mes_referencia='ABR' AND ano_referencia=2026 AND deleted_at IS NULL`

## Totais

| Métrica | Planilhas | Banco | Diferença |
|---------|-----------|-------|-----------|
| Cotações | 158 | 173 | 15 |
| Prêmio s/IOF | R$ 124.478,46 | R$ 125.778,46 | R$ 1.300,00 |
| A Receber | R$ 68.343,16 | R$ 68.565,16 | R$ 222,00 |

## Cruzamento por `clickup_id`

| Categoria | Quantidade | Arquivo |
|-----------|-----------|---------|
| Ausentes no banco (planilha tem, banco não) | **0** | `audit-abril-2026-planilha-2026-04-30-ausentes-no-banco.csv` |
| Extras no banco (banco tem, planilha não) | **15** | `audit-abril-2026-planilha-2026-04-30-extras-no-banco.csv` |
| Divergências em campos | **188** total / 109 não-informativas | `audit-abril-2026-planilha-2026-04-30-divergencias.csv` |

## Divergências por campo (não-informativas)

| Campo | Qtd |
|-------|-----|
| `status` | 89 |
| `priority` | 19 |
| `contato_cliente` | 1 |

## Próximos passos

1. **Revisar** `audit-abril-2026-planilha-2026-04-30-ausentes-no-banco.csv` — decidir quais inserir
2. **Revisar** `audit-abril-2026-planilha-2026-04-30-extras-no-banco.csv` — confirmar se devem permanecer ou ser removidos
3. **Revisar** `audit-abril-2026-planilha-2026-04-30-divergencias.csv` — validar lado correto (planilha vs banco)
4. **Aplicar** `audit-abril-2026-planilha-2026-04-30-inserts.sql` para criar ausentes (assignee_id ficará NULL)
5. **Aplicar** `audit-abril-2026-planilha-2026-04-30-updates.sql` para sincronizar divergências não-informativas
