# PRD-011 — Tarefas: Grupos, Permissoes e Dashboard

**Data:** 2026-04-22
**Status:** Done
**Autor:** Morgan (@pm) + Gustavo
**Epic:** EPIC-004 (Tarefas v2)
**Prioridade:** Alta (impacto direto na operacao diaria)

---

## 1. Contexto

O sistema de tarefas (EPIC-003, Stories 13.x) esta funcional mas apresenta **4 gaps** que precisam ser resolvidos para uso efetivo pela equipe:

1. Nao existe opcao de criar tarefa para um **grupo inteiro**
2. Cotadores conseguem ver botao de **excluir** (embora API bloqueie)
3. "Tarefas do Dia" na dashboard /inicio pode **nao exibir tarefas** por bug no frontend
4. Tarefas nao aparecem para o **criador** quando ele nao e o cotador

---

## 2. Analise do Sistema Atual

### 2.1 Modelo de Dados

```
tarefas
├── cotadorId (FK → users.id)  ← destinarario unico
├── criadorId (FK → users.id)  ← quem criou
├── status: Pendente | Em Andamento | Concluida | Cancelada
└── ...

grupos_usuarios ← existem mas NAO sao usados em tarefas
├── id, nome, cor
└── grupo_membros (grupo_id, user_id)
```

### 2.2 Permissoes Atuais (API)

| Operacao | admin/proprietario | cotador |
|----------|-------------------|---------|
| Criar tarefa | OK | BLOQUEADO (403) |
| Editar tarefa | OK | BLOQUEADO (403) |
| Deletar tarefa | OK | BLOQUEADO (403) |
| Alterar status | OK | Apenas se cotadorId = user.id |
| Ver briefings | OK | Apenas se cotadorId = user.id |
| Adicionar briefing | OK | Apenas se cotadorId = user.id |

### 2.3 Query da Dashboard "Tarefa do Dia" (/api/inicio)

```sql
WHERE (cotadorId = :userId OR criadorId = :userId)
  AND status IN ('Pendente', 'Em Andamento')
ORDER BY dataVencimento ASC, createdAt DESC
LIMIT 20
```

A query esta **correta** — busca tarefas onde o usuario e cotador OU criador.

### 2.4 Bugs Identificados

| # | Bug | Arquivo / Local | Impacto |
|---|-----|-----------------|---------|
| B1 | `handleUpdateTarefaStatus` usa **PUT** mas API so tem **PATCH** | `inicio-content.tsx:364` | Botao "concluir" na dashboard nao funciona (silently fails) |
| B2 | Tipo `Tarefa` no inicio-content nao inclui `cotador`/`cotadorId` | `inicio-content.tsx:14-21` | Frontend nao sabe quem e o cotador da tarefa |
| B3 | Frontend da lista de tarefas pode mostrar botao "Excluir" para cotadores | `tarefa-card.tsx` | UX confusa (API bloqueia mas botao aparece) |
| B4 | Coluna `grupo_id` definida no schema Drizzle mas **inexistente no MySQL** | `schema.ts:144` / banco `metas` | `GET /api/inicio` retorna 500 — Drizzle gera `SELECT grupo_id` que falha. Toda a pagina /inicio fica sem dados (tarefas, metas, produtividade) |

---

## 3. Requisitos

### REQ-1: Criar tarefa por grupo

**Descricao:** Ao criar uma tarefa, o admin pode escolher entre atribuir a um **usuario individual** ou a um **grupo**. Ao selecionar grupo, o sistema cria **uma tarefa individual para cada membro** do grupo, com o mesmo titulo, descricao, checklist e data de vencimento.

**Regras:**
- Formulario oferece toggle: "Destinatario" vs "Grupo"
- Se grupo selecionado, campo cotadorId e substituido por grupoId
- API cria N tarefas (1 por membro ativo do grupo)
- Cada tarefa e independente (status, checklist, briefings separados)
- Atividade registrada como "CRIADA" para cada tarefa
- Retorno: array de tarefas criadas com count

**Nao faz:**
- Nao cria tarefa "coletiva" com multiplos assignees
- Nao sincroniza status entre tarefas do mesmo grupo

### REQ-2: Cotador nao pode excluir tarefas

**Descricao:** O botao "Excluir" nao deve ser renderizado para usuarios com role `cotador`. Apenas `admin` e `proprietario` podem ver e clicar no botao.

**Regras:**
- API: ja implementado (DELETE retorna 403 para cotador) ✅
- Frontend: ocultar botao "Excluir" quando `userRole === 'cotador'`
- Verificar em: `tarefa-card.tsx` e qualquer outro local com opcao de delete

### REQ-3: Corrigir "Tarefas do Dia" na dashboard

**Descricao:** Corrigir bugs que impedem o funcionamento correto do painel.

**Correcoes:**
1. **B1:** `handleUpdateTarefaStatus` — trocar `PUT` por `PATCH /api/tarefas/{id}/status`
2. **B2:** Tipo `Tarefa` — adicionar campo `cotadorId` para saber se o user logado e o destinatario
3. **B4:** Coluna `grupo_id` inexistente no MySQL — `ALTER TABLE metas ADD COLUMN grupo_id char(36)`. Causa raiz: schema Drizzle definia a coluna mas `drizzle-kit push` nunca propagou para o banco. O `db.select().from(metas)` gerava SQL com `grupo_id` que falhava, causando 500 em toda a `/api/inicio`

### REQ-4: Tarefa visivel para cotador E criador

**Descricao:** A tarefa deve aparecer na "Tarefa do Dia" tanto para o cotador (destinatario) quanto para o criador.

**Status:** A query da API ja implementa isso corretamente:
```sql
WHERE (cotadorId = :userId OR criadorId = :userId)
```

**Acao necessaria:** Verificar que o frontend nao filtra adicionalmente. Se tudo estiver correto na API, o problema e apenas os bugs B1/B2 que afetam a renderizacao.

---

## 4. Plano de Implementacao

### Story 14.1 — Criar tarefa por grupo

**Arquivos:**

| Arquivo | Acao |
|---------|------|
| `src/components/tarefa-form.tsx` | Adicionar toggle Usuario/Grupo + select de grupos |
| `src/app/api/tarefas/route.ts` (POST) | Aceitar `grupoId` alternativo a `cotadorId`, criar N tarefas |
| `src/lib/validations.ts` | Ajustar schema para aceitar `grupoId` (optional) |
| `src/app/api/grupos/route.ts` | Verificar se endpoint ja existe para listar grupos |

**Logica API (POST /api/tarefas):**
```
Se body.grupoId:
  1. Buscar membros ativos do grupo
  2. Para cada membro: inserir tarefa com cotadorId = membro.userId
  3. Para cada tarefa: inserir checklistItems + logAtividade
  4. Retornar { tarefas: [...], count: N }
Senao:
  Fluxo atual (cotadorId individual)
```

### Story 14.2 — Permissoes frontend + fix bugs dashboard

**Arquivos:**

| Arquivo | Acao |
|---------|------|
| `src/components/tarefa-card.tsx` | Ocultar botao "Excluir" para role cotador (ja implementado) |
| `src/components/inicio-content.tsx` | Fix PUT→PATCH, adicionar cotadorId ao tipo Tarefa |
| `src/app/api/inicio/route.ts` | Adicionar `export const dynamic = "force-dynamic"`, log de debug |
| Banco MySQL (tabela `metas`) | `ALTER TABLE metas ADD COLUMN grupo_id char(36)` — coluna faltante que causava 500 |

---

## 5. Criterios de Aceitacao

### REQ-1
- [x] Admin ve opcao "Grupo" no formulario de criar tarefa
- [x] Ao selecionar grupo com 3 membros e criar, 3 tarefas individuais sao criadas
- [x] Cada membro ve sua tarefa na "Tarefa do Dia"
- [x] Checklist e replicada para cada tarefa
- [x] Atividade "CRIADA" registrada para cada tarefa

### REQ-2
- [x] Cotador NAO ve botao "Excluir" no card da tarefa (ja implementado em tarefa-card.tsx)
- [x] Admin e Proprietario CONTINUAM vendo botao "Excluir"
- [x] API continua retornando 403 para cotador que tenta DELETE

### REQ-3
- [x] Botao "concluir" na dashboard /inicio funciona (PATCH, nao PUT)
- [x] Tarefas aparecem no painel "Tarefas do Dia" para cotadores
- [x] /api/inicio nao retorna 500 — coluna grupo_id adicionada ao MySQL

### REQ-4
- [x] Criador de tarefa (admin) ve a tarefa na sua dashboard /inicio
- [x] Cotador (destinatario) ve a tarefa na sua dashboard /inicio
- [x] Se o mesmo usuario e criador E cotador, nao duplica

---

## 6. Estimativa

| Story | Complexidade | Arquivos |
|-------|-------------|----------|
| 14.1 (Grupo) | Media | 4 arquivos |
| 14.2 (Permissoes + Bugs) | Baixa | 2 arquivos |

---

## 7. Riscos

| Risco | Mitigacao |
|-------|----------|
| Grupo com muitos membros gera muitas tarefas | Limitar a 50 membros por operacao |
| Tarefa criada para membro inativo | Filtrar apenas membros ativos (is_active = true) |
| N inserts simultaneos pode ser lento | Usar bulk insert com transaction |
