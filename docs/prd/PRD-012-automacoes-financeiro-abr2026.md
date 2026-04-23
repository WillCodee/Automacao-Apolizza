# PRD-012 — Automacoes e Financeiro Cliente (Abril 2026)

**Status:** Concluido
**Data:** 2026-04-23
**Origem:** Diretoria Apolizza
**Implementado por:** Claude Code

---

## Contexto

Tres demandas pontuais da diretoria implementadas em sessao unica: automacao de atribuicao por situacao, correcao do botao PDF, e separacao da secao financeira no formulario de cotacoes.

---

## 1. Auto-Assign por Situacao (CCLIENTE → Ivo)

**Tipo:** Feature / Automacao
**Status:** DONE

### Requisito

Sempre que uma cotacao tiver ou for atualizada para a situacao `CCLIENTE`, deve ser automaticamente atribuida ao usuario **Ivo Santos**.

### Implementacao

| Item | Detalhe |
|------|---------|
| Mecanismo | Tabela `situacao_config` com campo `default_cotador_id` |
| Config banco | `situacao_config.default_cotador_id` de CCLIENTE = `dec868b3-e8e3-4dbe-a11f-04485f55bc06` (Ivo Santos) |
| PUT (update) | Logica ja existia em `/api/cotacoes/[id]/route.ts` linhas 72-83 — consulta `situacao_config` e auto-atribui |
| POST (criacao) | **Adicionado** — mesma logica antes do insert em `/api/cotacoes/route.ts` |
| Retroativo | 2 cotacoes existentes com CCLIENTE atualizadas via SQL direto |

### Extensibilidade

Para configurar auto-assign em OUTRAS situacoes, basta atualizar o `default_cotador_id` na tabela `situacao_config` (via admin ou SQL). A logica e generica.

### Arquivos alterados

- `apolizza-crm/src/app/api/cotacoes/route.ts` — import `situacaoConfig` + logica auto-assign no POST

---

## 2. Correcao Botao PDF

**Tipo:** Bug Fix
**Status:** DONE

### Problema

Botao PDF na pagina de detalhe da cotacao (`/cotacoes/[id]`) nao funcionava. Erro no console:

```
Error: Attempting to parse an unsupported color function "lab"
```

**Causa raiz:** `html2canvas` v1.4.1 nao suporta funcoes de cor CSS `lab()` usadas internamente pelo Tailwind CSS 4.

### Solucao

Substituido `html2canvas` + `jsPDF` por `window.print()` nativo do browser.

| Item | Detalhe |
|------|---------|
| Abordagem | `window.print()` — abre dialogo nativo do browser (salvar como PDF) |
| CSS print | `@media print` em `globals.css` esconde header, sidebar, botoes |
| Classes print | `print:hidden` adicionado em: header, botoes de acao, link voltar, docs upload, sidebar atividade |

### Arquivos alterados

- `apolizza-crm/src/components/export-pdf-button.tsx` — substituido por `window.print()`
- `apolizza-crm/src/app/globals.css` — regras `@media print`
- `apolizza-crm/src/app/cotacoes/[id]/page.tsx` — classes `print:hidden`
- `apolizza-crm/src/components/app-header.tsx` — classe `print:hidden` no `<header>`

---

## 3. Separacao Financeiro Apolizza / Cliente

**Tipo:** Feature / UX
**Status:** DONE

### Requisito

Dividir a secao "Financeiro" do formulario de cotacoes em duas:

1. **Financeiro — Apolizza** (dados internos da corretora)
2. **Financeiro — Cliente** (dados voltados ao cliente)

### Nova estrutura

#### Financeiro — Apolizza

| Campo | Tipo | Calculo |
|-------|------|---------|
| Premio s/IOF (R$) | Input manual | — |
| Comissao (%) | Input manual (auto-suggest por seguradora) | — |
| A Receber (R$) | Auto ou manual | Premio s/IOF x Comissao% |
| Valor em Perda (R$) | Input manual | — |

#### Financeiro — Cliente

| Campo | Tipo | Calculo |
|-------|------|---------|
| Premio c/IOF (R$) | Input manual | **Campo novo** |
| Parcelas | Input manual | — |
| Valor p/Parcela (R$) | Auto ou manual | Premio c/IOF / Parcelas |

### Alteracao no calculo automatico

| Antes | Depois |
|-------|--------|
| Valor Parcelado = Premio s/IOF / Parcelas | Valor p/Parcela = Premio c/IOF / Parcelas |

### Banco de dados

```sql
ALTER TABLE cotacoes ADD COLUMN premio_com_iof DECIMAL(12,2) NULL AFTER premio_sem_iof;
```

### Arquivos alterados

- `apolizza-crm/src/lib/schema.ts` — campo `premioComIof` na tabela `cotacoes`
- `apolizza-crm/src/lib/validations.ts` — `premioComIof` nos schemas create e update
- `apolizza-crm/src/components/cotacao-form.tsx` — duas fieldsets, novo campo, calculo ajustado
- `apolizza-crm/src/app/api/cotacoes/route.ts` — POST inclui `premioComIof` + formatCotacao
- `apolizza-crm/src/app/api/cotacoes/[id]/route.ts` — PUT inclui `premioComIof` + formatCotacao
- `apolizza-crm/src/app/cotacoes/[id]/page.tsx` — exibe Premio c/IOF no detalhe
- `apolizza-crm/src/app/cotacoes/[id]/edit/page.tsx` — `premioComIof` no initialData

---

## Commits

| Hash | Mensagem |
|------|----------|
| `72d64f6` | feat: auto-assign CCLIENTE → Ivo + fix botao PDF com loading state |
| `389bb8b` | fix: botao PDF usa window.print() — corrige erro lab() do html2canvas |
| `053d6df` | feat: divide secao financeira em Apolizza + Cliente |

---

## Deploy

- **Plataforma:** Vercel (via `vercel --prod`)
- **URL:** https://crm.apolizza.com
- **Build:** 0 erros TypeScript, 70 rotas
