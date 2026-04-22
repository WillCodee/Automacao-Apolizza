# PRD-011 — Painel TV Dashboard

**Status:** Aprovado
**Data:** 2026-04-22
**Origem:** PRD-010 item 7.2 + Refinamento com Diretoria
**PM:** Morgan (@pm)

---

## 1. Objetivo

Criar uma pagina dedicada (`/tv`) para exibicao em televisao 55" no escritorio, permitindo que o time acompanhe em tempo real os KPIs, ranking de cotadores, progresso de meta e evolucao mensal — sem necessidade de login.

## 2. Problema

Atualmente os dados so sao acessiveis individualmente via dashboard logado. A diretoria quer visibilidade coletiva permanente dos indicadores para motivar o time e facilitar acompanhamento gerencial.

## 3. Solucao

Pagina publica fullscreen com:
- **Faixa fixa superior:** 4 KPI cards + relogio + mes/ano
- **Area principal com carrossel:** 4 slides alternando a cada 5 minutos
- **Auto-refresh:** Dados atualizados a cada 5 minutos (silencioso)
- **Tema dark:** Otimizado para contraste em TV

## 4. Layout (1920x1080)

```
┌─────────────────────────────────────────────────────────────┐
│  🟢 APOLIZZA    |  KPI 1  |  KPI 2  |  KPI 3  |  KPI 4  | 14:35 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│                    AREA DO CARROSSEL                          │
│                                                               │
│  Slide 1: Ranking Cotadores (tabela com foto + barras)       │
│  Slide 2: Progresso da Meta (termometro grande + detalhes)   │
│  Slide 3: Grafico Evolucao Mensal (barras + linha)           │
│  Slide 4: KPIs Expandidos (renovacoes, grupos, situacao)     │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  ● ○ ○ ○   indicadores de slide      Atualizado: 14:35      │
└─────────────────────────────────────────────────────────────┘
```

## 5. Especificacoes Tecnicas

### 5.1 Rota e Acesso

| Item | Valor |
|------|-------|
| Rota | `/tv` |
| Autenticacao | Token via query string: `/tv?token=SECRET` |
| Env var | `TV_TOKEN` |
| Fallback | Se token invalido, redireciona para `/login` |

### 5.2 Carrossel

| Item | Valor |
|------|-------|
| Slides | 4 |
| Duracao por slide | 5 minutos (300s) |
| Ciclo completo | 20 minutos |
| Transicao | Fade 500ms |
| Navegacao manual | Nenhuma (modo TV sem interacao) |
| Indicador | Dots na base mostrando slide atual |

### 5.3 Refresh de Dados

| Item | Valor |
|------|-------|
| Intervalo | 5 minutos (300.000ms) |
| Estrategia | `setInterval` com fetch silencioso |
| Feedback visual | Texto "Atualizado: HH:mm" no rodape |
| Erro de rede | Mantem ultimo dado valido, tenta novamente no proximo ciclo |

### 5.4 Design

| Item | Valor |
|------|-------|
| Resolucao alvo | 1920x1080 (Full HD) |
| Tema | Dark mode fixo (fundo #0f172a / #1e293b) |
| Font | Poppins |
| Tamanho base | 16px-24px (legivel a 3-5m de distancia) |
| KPI values | 32px-48px bold |
| Cores | Azul #03a4ed, Coral #ff695f, Verde #10b981 |
| Fullscreen | CSS `min-h-screen`, sem scroll, sem header padrao |

## 6. Slides Detalhados

### Slide 1 — Ranking Cotadores

Tabela com colunas: Foto | Nome | Fechadas | Faturamento | Taxa Conversao
- Ordenado por faturamento DESC
- Barras horizontais proporcionais ao maior valor
- Destaque (cor diferente) para o 1o lugar
- Maximo 10 cotadores visiveis

**API:** `GET /api/dashboard?ano=YYYY&mes=MMM` → `cotadores[]`

### Slide 2 — Progresso da Meta Mensal

- Termometro SVG grande (centro da tela)
- Cards laterais: Meta Mensal | Total Atingido | Faltam | % Progresso
- Se meta > 100%: efeito visual de celebracao (cor verde)

**API:** `GET /api/dashboard/semanal?ano=YYYY&mes=MMM` → `metaMensal`, `semanas[].ganhoAcumulado`

### Slide 3 — Evolucao Mensal (ultimos 6 meses)

- Grafico Chart.js: barras agrupadas (fechadas verde + perdas vermelho)
- Linha sobreposta: faturamento (azul)
- Eixo X: meses (JAN, FEV, MAR...)
- Eixo Y esquerdo: contagem | Eixo Y direito: R$

**API:** `GET /api/dashboard?ano=YYYY` → `monthlyTrend[]`

### Slide 4 — KPIs Expandidos

Grid 2x3 com cards grandes:
1. Total Cotacoes (novas + renovacoes)
2. Fechadas (com split renovacao/nova)
3. Perdas (com valor total)
4. Faturamento Total (a_receber)
5. Taxa de Conversao (gauge visual)
6. Premio s/ IOF

**API:** `GET /api/dashboard?ano=YYYY&mes=MMM` → `kpis`

## 7. Faixa Fixa Superior (KPI Strip)

Sempre visivel, 4 cards compactos:

| Card | Dado | Cor |
|------|------|-----|
| Total Cotacoes | totalCotacoes | Branco |
| Fechadas | fechadas | Verde #10b981 |
| Perdas | perdas | Coral #ff695f |
| Faturamento | totalAReceber formatado | Azul #03a4ed |

Lado direito: Relogio digital (HH:mm) atualizado a cada minuto.

## 8. API — Endpoint Dedicado

Criar **`GET /api/tv?token=SECRET`** que retorna todos os dados necessarios em uma unica chamada:

```json
{
  "kpis": { ... },
  "statusBreakdown": [ ... ],
  "monthlyTrend": [ ... ],
  "cotadores": [ ... ],
  "metaMensal": 500000,
  "semanas": [ ... ]
}
```

Isso evita 3 chamadas separadas na TV e reduz carga no banco.

## 9. Seguranca

| Risco | Mitigacao |
|-------|-----------|
| Rota publica expoe dados | Token secreto via query string |
| Token em URL pode vazar | Token longo (32+ chars), rotacionavel via env |
| Dados sensiveis | Nao expoe senhas, emails — apenas nomes e metricas |
| Rate limiting | Nao necessario (1 cliente fixo) |

## 10. Criterios de Aceitacao

- [ ] Pagina `/tv?token=X` exibe dados sem login
- [ ] Token invalido redireciona para `/login`
- [ ] 4 KPI cards fixos no topo atualizados a cada 5min
- [ ] Carrossel com 4 slides alternando a cada 5min
- [ ] Slide 1: Ranking cotadores com foto e barras
- [ ] Slide 2: Termometro de meta mensal
- [ ] Slide 3: Grafico evolucao mensal (Chart.js)
- [ ] Slide 4: KPIs expandidos com split renovacao/novas
- [ ] Tema dark fixo, fontes legiveis a 3-5 metros
- [ ] Layout otimizado para 1920x1080
- [ ] Sem scroll, sem interacao (modo TV puro)
- [ ] Relogio digital no header
- [ ] Indicadores de slide (dots) na base
- [ ] Texto "Atualizado: HH:mm" no rodape
- [ ] Resiliencia: se fetch falhar, mantem ultimo dado

## 11. Dependencias

| Dependencia | Status |
|-------------|--------|
| `/api/dashboard` | Existente |
| `/api/dashboard/semanal` | Existente (corrigido PRD-009/010) |
| `/api/analise` | Existente |
| Chart.js + react-chartjs-2 | Instalado |
| Env `TV_TOKEN` | A configurar |

## 12. Estimativa

| Story | Descricao | Complexidade |
|-------|-----------|-------------|
| 14.1 | API `/api/tv` + auth por token | Simples |
| 14.2 | Pagina `/tv` com layout base + KPI strip + carrossel | Media |
| 14.3 | Slide 1 — Ranking Cotadores | Media |
| 14.4 | Slide 2 — Progresso Meta (termometro) | Simples |
| 14.5 | Slide 3 — Grafico Evolucao Mensal | Media |
| 14.6 | Slide 4 — KPIs Expandidos | Simples |

**Total: 6 stories, Epic 14.x**
