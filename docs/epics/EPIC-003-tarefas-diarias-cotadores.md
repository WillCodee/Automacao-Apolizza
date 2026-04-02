# EPIC-003: Controle de Tarefas Diárias dos Cotadores

## Metadata

| Campo | Valor |
|-------|-------|
| **Epic ID** | EPIC-003 |
| **Título** | Sistema de Controle de Tarefas Diárias dos Cotadores |
| **Autor** | @pm (Morgan) |
| **Status** | Draft |
| **Criado em** | 2026-04-02 |
| **Prioridade** | Alta (Urgente — 3-5 dias) |
| **Tipo** | Brownfield Enhancement |
| **PRD Base** | PRD-001-apolizza-crm.md |

---

## Epic Goal

Criar uma nova aba no CRM Apolizza dedicada ao controle de tarefas diárias dos cotadores, permitindo que gestores (usuários master) criem e atribuam tarefas, enquanto cotadores atualizam status e registram progresso através de briefings estruturados.

---

## Epic Description

### Existing System Context

- **Current Functionality**: CRM de cotações de seguros com dashboard, KPIs, gestão de cotações
- **Technology Stack**: Next.js 16.2.1, Neon PostgreSQL, Drizzle ORM, Auth.js v5, Vercel Blob, Zod v4
- **Sistema de Permissões**: Já implementado (roles: `admin`, `gestor`, `cotador`)
- **Notificações**: Vercel Cron + Resend (N8N eliminado)
- **Integration Points**:
  - Tabela `users` (já existe, com roles)
  - Auth.js session (informações do usuário logado)
  - Vercel Blob (upload de anexos)
  - Resend API (notificações por email)

### Enhancement Details

**O que está sendo adicionado:**

Uma nova seção completa de **Gestão de Tarefas Diárias** com:

1. **CRUD de Tarefas** com permissões diferenciadas:
   - **Usuários Master** (`admin`, `gestor`): CRUD completo (criar, editar, deletar tarefas)
   - **Usuários Cotadores**: Apenas visualizar tarefas atribuídas + atualizar status + adicionar briefings

2. **Dashboard de Métricas**: Visualizações de tarefas por status, cotador, período

3. **Notificações Automáticas**: Alertas por email sobre tarefas novas, atrasadas, concluídas

4. **Histórico de Atividades**: Audit log completo de todas as ações (criação, edição, atualização de status)

5. **Upload de Anexos**: Cotadores podem anexar arquivos às tarefas (evidências, documentos)

**Como integra:**

- Nova rota `/tarefas` no Next.js App Router
- Nova tabela `tarefas` no Neon PostgreSQL com foreign keys para `users`
- Tabela `tarefas_atividades` para audit log
- Tabela `tarefas_anexos` para upload via Vercel Blob
- Componentes reutilizam design system existente (Poppins, cores Apolizza, Tailwind)
- API routes seguem padrão de autenticação via `proxy.ts`

**Success Criteria:**

- [ ] Gestores podem criar e atribuir tarefas a cotadores específicos
- [ ] Cotadores veem apenas suas tarefas e podem atualizar status
- [ ] Dashboard exibe métricas em tempo real (tarefas pendentes, concluídas, atrasadas)
- [ ] Notificações por email são enviadas automaticamente
- [ ] Histórico completo de atividades é registrado
- [ ] Upload de anexos funciona corretamente
- [ ] Interface responsiva e alinhada com identidade visual Apolizza
- [ ] Testes cobrem todos os casos de uso principais
- [ ] Deploy em produção sem afetar funcionalidades existentes

---

## Stories (Enhanced with Quality Planning)

### Story 13.1: CRUD de Tarefas + Sistema de Permissões

**Descrição:** Implementar schema de banco de dados, API routes e interface básica para criação, edição e visualização de tarefas com controle de permissões.

**Executor Assignment:**
```yaml
executor: "@data-engineer"
quality_gate: "@dev"
quality_gate_tools: [schema_validation, migration_review, rls_test]
```

**Acceptance Criteria:**
- [ ] Tabela `tarefas` criada com campos: id, titulo, descricao, data_vencimento, status, cotador_id, criador_id, created_at, updated_at
- [ ] Migration aplicada no Neon
- [ ] API routes: `POST /api/tarefas`, `GET /api/tarefas`, `PATCH /api/tarefas/[id]`, `DELETE /api/tarefas/[id]`
- [ ] Validação de permissões: apenas `admin` e `gestor` podem criar/editar/deletar
- [ ] Interface em `/tarefas` com listagem e formulário de criação
- [ ] Zod schemas para validação de inputs
- [ ] Testes unitários para API routes

**Quality Gates:**
- Pre-Commit: Schema validation, service filter verification, RLS policies check
- Pre-PR: SQL review, migration safety check, backward compatibility

**Focus:** Service filters, foreign keys, role-based access control

---

### Story 13.2: Atualização de Status + Briefings por Cotadores

**Descrição:** Permitir que cotadores atualizem o status de suas tarefas e adicionem briefings de progresso.

**Executor Assignment:**
```yaml
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: [code_review, pattern_validation, security_scan]
```

**Acceptance Criteria:**
- [ ] Tabela `tarefas_briefings` criada (id, tarefa_id, usuario_id, briefing, created_at)
- [ ] API route: `PATCH /api/tarefas/[id]/status` (apenas cotador dono da tarefa)
- [ ] API route: `POST /api/tarefas/[id]/briefings`
- [ ] Interface de card de tarefa com botões de status (Pendente → Em Andamento → Concluída)
- [ ] Modal/formulário para adicionar briefing
- [ ] Histórico de briefings visível no card expandido
- [ ] Validação: cotador só atualiza suas próprias tarefas

**Quality Gates:**
- Pre-Commit: Security scan (injection prevention), error handling validation
- Pre-PR: API contract validation, backward compatibility check

**Focus:** Input validation, authentication, authorization, error responses

---

### Story 13.3: Dashboard de Métricas de Tarefas

**Descrição:** Criar dashboard visual com métricas de tarefas (status, cotador, tendências).

**Executor Assignment:**
```yaml
executor: "@ux-design-expert"
quality_gate: "@dev"
quality_gate_tools: [ui_review, accessibility_check, responsive_test]
```

**Acceptance Criteria:**
- [ ] SQL View `vw_tarefas_metricas` criada (total por status, por cotador, por período)
- [ ] API route: `GET /api/tarefas/metricas`
- [ ] Componente `TarefasDashboard` com Chart.js:
  - Gráfico de pizza: tarefas por status
  - Gráfico de barras: tarefas por cotador
  - Gráfico de linha: tendência mensal (criadas vs concluídas)
- [ ] Cards com KPIs: Total Pendentes, Atrasadas, Concluídas (Hoje/Semana)
- [ ] Design alinhado com identidade Apolizza (cores, Poppins, gradientes)
- [ ] Responsivo (mobile e desktop)

**Quality Gates:**
- Pre-Commit: Accessibility validation (a11y), responsive design check
- Pre-PR: UI consistency review, performance (bundle size)

**Focus:** Chart.js integration, CSS Grid/Flexbox, Tailwind utilities, color palette

---

### Story 13.4: Notificações Automáticas (Vercel Cron + Resend)

**Descrição:** Implementar sistema de notificações por email para eventos de tarefas.

**Executor Assignment:**
```yaml
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: [code_review, integration_test, secrets_validation]
```

**Acceptance Criteria:**
- [ ] Vercel Cron job configurado: `/api/cron/tarefas-notificacoes` (diário, 8h)
- [ ] Template HTML de email para: nova tarefa, tarefa atrasada, tarefa concluída
- [ ] Integração com Resend API (env var `RESEND_API_KEY`)
- [ ] Lógica de envio:
  - Nova tarefa: email para cotador atribuído
  - Tarefa atrasada: email para cotador + gestor
  - Tarefa concluída: email para gestor
- [ ] Logs de envio (success/failure)
- [ ] Configuração `vercel.json` para cron

**Quality Gates:**
- Pre-Commit: Secrets validation (env vars), template preview
- Pre-PR: Integration test (mock Resend API), error handling

**Focus:** Resend SDK, HTML email templates, cron syntax, error logging

---

### Story 13.5: Histórico de Atividades (Audit Log)

**Descrição:** Implementar audit log completo de todas as ações em tarefas.

**Executor Assignment:**
```yaml
executor: "@data-engineer"
quality_gate: "@dev"
quality_gate_tools: [schema_validation, query_optimization, data_integrity]
```

**Acceptance Criteria:**
- [ ] Tabela `tarefas_atividades` criada:
  - id, tarefa_id, usuario_id, tipo_acao (CRIADA, EDITADA, STATUS_ALTERADO, BRIEFING_ADICIONADO, ANEXO_ADICIONADO), detalhes (JSON), created_at
- [ ] Triggers automáticos ou middleware para registrar ações
- [ ] API route: `GET /api/tarefas/[id]/atividades`
- [ ] Componente `AtividadesTimeline` para exibir histórico cronológico
- [ ] Detalhes em JSON incluem: campo alterado, valor anterior, valor novo
- [ ] Índices otimizados para queries por tarefa_id e created_at

**Quality Gates:**
- Pre-Commit: Schema validation, index strategy review
- Pre-PR: Query performance test, data integrity check

**Focus:** JSONB data type, audit triggers, timeline UI component

---

### Story 13.6: Upload de Anexos (Vercel Blob)

**Descrição:** Permitir upload de arquivos (evidências, documentos) nas tarefas.

**Executor Assignment:**
```yaml
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: [code_review, security_scan, file_upload_validation]
```

**Acceptance Criteria:**
- [ ] Tabela `tarefas_anexos` criada (id, tarefa_id, usuario_id, nome_arquivo, url_blob, tamanho, created_at)
- [ ] API route: `POST /api/tarefas/[id]/anexos` (upload via Vercel Blob SDK)
- [ ] API route: `GET /api/tarefas/[id]/anexos` (listar anexos)
- [ ] API route: `DELETE /api/tarefas/[id]/anexos/[anexoId]` (apenas criador ou gestor)
- [ ] Componente de upload com drag-and-drop
- [ ] Validação: max 10MB por arquivo, tipos permitidos (PDF, PNG, JPG, DOCX, XLSX)
- [ ] Preview de imagens e links de download
- [ ] Integração com histórico (ANEXO_ADICIONADO, ANEXO_REMOVIDO)

**Quality Gates:**
- Pre-Commit: File type validation, size limits, security scan (malware prevention)
- Pre-PR: Upload flow test, storage quota check

**Focus:** Vercel Blob SDK (@vercel/blob), file validation, drag-drop UX, security

---

## Compatibility Requirements

- [ ] **Existing APIs remain unchanged**: Nenhuma rota de cotações ou dashboard será alterada
- [ ] **Database schema backward compatible**: Novas tabelas não afetam schema existente
- [ ] **UI follows existing patterns**: Reutiliza componentes, cores, tipografia do CRM
- [ ] **Performance impact minimal**: Queries otimizadas com índices, lazy loading de anexos
- [ ] **Authentication preservado**: Sistema de roles Auth.js não muda

---

## Risk Mitigation

### Primary Risk
**Aumento de complexidade do CRM**: Adicionar 4 novas tabelas e múltiplas features pode sobrecarregar o sistema se mal implementado.

### Mitigation
- **Database Design**: Foreign keys e índices desde o início para garantir performance
- **Code Quality**: CodeRabbit validation em todas as stories (pre-commit + pre-PR)
- **Phased Rollout**: Deploy progressivo (MVP = Stories 13.1 + 13.2, depois resto)
- **Monitoring**: Adicionar logging de performance (query times, upload sizes)

### Rollback Plan
- **Database**: Migrations reversíveis (down migrations prontas)
- **Feature Flag**: Adicionar env var `FEATURE_TAREFAS_ENABLED` para desabilitar se necessário
- **Backup**: Snapshot do banco antes de aplicar migrations
- **UI**: Nova aba `/tarefas` não afeta rotas existentes — remover link do menu desabilita acesso

---

## Quality Assurance Strategy

### CodeRabbit Validation

Todas as stories incluem validação automatizada:

| Story | Pre-Commit | Pre-PR | Pre-Deployment |
|-------|-----------|--------|----------------|
| 13.1 | Schema, RLS, service filters | SQL review, migration safety | — |
| 13.2 | Security scan, input validation | API contracts, backward compat | — |
| 13.3 | Accessibility, responsive | UI consistency, bundle size | — |
| 13.4 | Secrets validation, templates | Integration tests, error handling | Cron syntax, env vars |
| 13.5 | Schema, indexes | Query performance, data integrity | — |
| 13.6 | File validation, security scan | Upload flow, storage quota | — |

### Specialized Expertise

- **@data-engineer**: Reviews schema design (13.1, 13.5)
- **@ux-design-expert**: Reviews UI/UX (13.3)
- **@architect**: Reviews API contracts, security (13.2, 13.4, 13.6)
- **@dev**: Code review, integration tests (todas)

### Quality Gates Aligned with Risk

- **LOW RISK** (13.3 — UI apenas): Pre-Commit only
- **MEDIUM RISK** (13.1, 13.2, 13.5): Pre-Commit + Pre-PR
- **HIGH RISK** (13.4, 13.6 — integrações externas): Pre-Commit + Pre-PR + Pre-Deployment

### Regression Prevention

Cada story inclui:
- [ ] Testes de integração verificando funcionalidades existentes (login, dashboard, cotações)
- [ ] Performance baseline: queries não devem aumentar tempo de carregamento >10%
- [ ] UI regression test: screenshots automatizados de páginas críticas
- [ ] Feature flag: `FEATURE_TAREFAS_ENABLED=false` desabilita tudo se necessário

---

## Definition of Done

- [ ] Todas as 6 stories completadas com acceptance criteria atendidos
- [ ] Funcionalidades existentes verificadas (smoke tests: login, dashboard, cotações)
- [ ] Migration aplicada em produção sem downtime
- [ ] Testes E2E passando (Playwright ou similar)
- [ ] Documentação atualizada (README, API docs se aplicável)
- [ ] Deploy em produção sem erros de build
- [ ] Métricas de performance validadas (tempo de resposta, query time)
- [ ] Nenhuma regressão detectada em funcionalidades existentes

---

## Execution Plan (Wave-Based Parallel Development)

### Wave 1: Foundation (Dias 1-2)
- **Story 13.1**: CRUD + Permissões (blocker para todas as outras)

### Wave 2: Core Features (Dias 2-3)
- **Story 13.2**: Status + Briefings (depende de 13.1)
- **Story 13.5**: Histórico (depende de 13.1, pode rodar em paralelo com 13.2)

### Wave 3: Enhanced Features (Dias 3-4)
- **Story 13.3**: Dashboard (depende de 13.1)
- **Story 13.6**: Anexos (depende de 13.1)

### Wave 4: Automações (Dia 5)
- **Story 13.4**: Notificações (depende de 13.1, pode rodar após qualquer wave)

**Total Estimado:** 5 dias (3-5 dias conforme requisitado)

---

## Handoff to Story Manager

**Story Manager Handoff:**

"Please develop detailed user stories for this brownfield epic. Key considerations:

- **Technology Stack**: Next.js 16.2.1 (App Router), Neon PostgreSQL, Drizzle ORM, Auth.js v5, Vercel Blob, Resend, Zod v4
- **Integration Points**:
  - Tabela `users` existente (foreign keys para cotador_id, criador_id)
  - Auth.js session (`getServerSession()` em API routes)
  - Vercel Blob SDK (`@vercel/blob`) para uploads
  - Resend API para notificações
- **Existing Patterns**:
  - API routes em `app/api/**/route.ts` com validação via Zod
  - Componentes React Server Components + Client Components
  - Tailwind CSS com design tokens Apolizza (Poppins, `#03a4ed`, `#ff695f`)
  - SQL Views para queries complexas
- **Critical Compatibility Requirements**:
  - Não modificar schema de `users`, `cotacoes`, ou outras tabelas existentes
  - Seguir padrão de autenticação via `proxy.ts` (session validation)
  - Reutilizar componentes visuais existentes (cards, modals, buttons)
- **Each Story Must Include**:
  - Verificação de que funcionalidades existentes permanecem intactas (login, dashboard, cotações)
  - Testes unitários para API routes
  - Validação de segurança (input sanitization, SQL injection prevention)

The epic should maintain system integrity while delivering a robust daily task management system for insurance brokers."

---

## Related Documents

- **PRD Base**: `docs/prd/PRD-001-apolizza-crm.md`
- **Stories**: `docs/stories/13.*.story.md` (a serem criadas por @sm)
- **Execution Plan**: `docs/epics/EPIC-003-EXECUTION.yaml` (opcional, se usar `*execute-epic`)

---

**Epic criado por @pm (Morgan) em 2026-04-02**
