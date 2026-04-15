# 🛠️ Scripts de Manutenção - Apolizza CRM

## Índice

1. [Backup e Recovery](#-backup-e-recovery)
2. [Validação e Health Check](#-validação-e-health-check)
3. [Database Setup](#-database-setup)
4. [Migração ClickUp](#-migração-clickup)
5. [Uso Diário](#-uso-diário)

---

## 💾 Backup e Recovery

### `backup-database.ts`
Cria backup completo do banco de dados em JSON.

**Uso:**
```bash
npx tsx scripts/backup-database.ts [tipo]
```

**Tipos:**
- `daily` - Backup diário (padrão, retenção 7 dias)
- `weekly` - Backup semanal (retenção 4 semanas)
- `monthly` - Backup mensal (retenção 12 meses)
- `manual` - Backup manual (retenção indefinida)

**Exemplo:**
```bash
# Backup manual antes de operação crítica
npx tsx scripts/backup-database.ts manual

# Output:
# 📁 Arquivo: backups/manual/backup-manual-2026-04-15T15-30-00.json
# 📊 Tamanho: 12.45 MB
# 📈 Total de registros: 5.234
#    - Cotações: 3.367
#    - Usuários: 11
#    - Documentos: 245
#    - Histórico: 1.523
```

**Dados incluídos:**
- ✅ cotacoes
- ✅ users (sem senha)
- ✅ cotacao_docs
- ✅ cotacao_history
- ✅ metas
- ✅ status_config
- ✅ comissao_tabela
- ✅ tarefas
- ✅ notificacoes
- ✅ grupos

---

### `restore-backup.ts`
Restaura dados de um backup JSON.

**Uso:**
```bash
npx tsx scripts/restore-backup.ts <caminho-backup> [modo]
```

**Modos:**
- `preview` - **Recomendado!** Mostra o que seria restaurado sem executar
- `safe` - Restaura apenas registros que não existem (baseado em ID)
- `force` - **PERIGOSO!** Sobrescreve dados existentes

**Exemplos:**
```bash
# 1. Preview (sempre faça isso primeiro!)
npx tsx scripts/restore-backup.ts backups/daily/backup-daily-latest.json preview

# 2. Restore seguro (não sobrescreve)
npx tsx scripts/restore-backup.ts backups/daily/backup-daily-latest.json safe

# 3. Restore forçado (sobrescreve - CUIDADO!)
npx tsx scripts/restore-backup.ts backups/daily/backup-daily-latest.json force
```

**⚠️  ATENÇÃO:**
- Sempre use `preview` primeiro
- Use `safe` para recuperação parcial
- Use `force` apenas em caso de desastre total
- Faça backup antes de restore com `force`

---

## ✅ Validação e Health Check

### `validate-data.ts`
Validação completa de integridade dos dados.

**Uso:**
```bash
npx tsx scripts/validate-data.ts [--fix]
```

**Verifica:**
- ✅ Existência de tabelas críticas
- ✅ Existência de views SQL
- ✅ Integridade referencial (FK válidas)
- ✅ Dados órfãos
- ✅ Consistência de dados

**Exemplo:**
```bash
# Apenas validar
npx tsx scripts/validate-data.ts

# Validar e corrigir automaticamente
npx tsx scripts/validate-data.ts --fix
```

**Output:**
```
✅ [TABELAS] users: Tabela existe
✅ [TABELAS] cotacoes: Tabela existe
✅ [VIEWS] vw_kpis: View existe com 113 registros
...

📊 RESUMO DA VALIDAÇÃO
Total de testes: 25
✅ OK: 23
⚠️  Avisos: 2
❌ Erros: 0
```

---

### `health-check.ts`
Health check automático com auto-recovery.

**Uso:**
```bash
npx tsx scripts/health-check.ts
```

**Executa:**
1. Verifica conexão com banco
2. Verifica existência das views SQL
3. **Auto-recria views** se estiverem faltando
4. Verifica dados críticos (cotações, usuários)

**Exemplo:**
```bash
npx tsx scripts/health-check.ts

# 🏥 HEALTH CHECK INICIADO
# 1️⃣  Verificando conexão com banco...
#    ✅ Banco conectado
#
# 2️⃣  Verificando views SQL...
#    ❌ vw_kpis não encontrada
#    🔧 Recriando 4 views...
#    ✅ Views recriadas com sucesso
#
# ✅ Sistema saudável!
```

**Quando usar:**
- Rotina diária (cron job)
- Após deploy
- Antes de operações críticas
- Quando dashboard estiver vazio

---

### `check-data.ts`
Script de diagnóstico rápido (gerado temporariamente).

**Uso:**
```bash
npx tsx scripts/check-data.ts
```

**Mostra:**
- Total de cotações (ativas/deletadas)
- Total de usuários (ativos/inativos)
- Total de tarefas
- Distribuição por status
- Status das views SQL

---

## 🗄️ Database Setup

### `create-views.ts`
Cria as 4 views SQL usadas pelo dashboard.

**Uso:**
```bash
npx tsx scripts/create-views.ts
```

**Views criadas:**
- `vw_kpis` - KPIs por ano/mês/assignee
- `vw_status_breakdown` - Contagem e total por status
- `vw_cotadores` - Desempenho por cotador
- `vw_monthly_trend` - Tendência mensal

**Quando usar:**
- Após provisionar novo banco
- Se dashboard estiver vazio
- Após migrations que deletam views
- **Automático via health-check.ts**

---

### `seed-admin-users.ts`
Cria os 3 usuários admin iniciais.

**Uso:**
```bash
npx tsx scripts/seed-admin-users.ts
```

**Cria:**
- `gustavo` / Apolizza@2026 (admin)
- `admin` / Apolizza@2026 (admin)
- `gestor` / Apolizza@2026 (admin)

**Quando usar:**
- Primeiro setup do banco
- Após reset total
- Para criar novos admins

---

### `seed-demo.ts`
Cria 10 cotações de demonstração.

**Uso:**
```bash
npx tsx scripts/seed-demo.ts
```

**Quando usar:**
- Ambiente de desenvolvimento
- Demonstrações
- Testes

---

### `seed-status-config.ts`
Cria configurações dos 12 status.

**Uso:**
```bash
npx tsx scripts/seed-status-config.ts
```

**Status criados:**
- aberto, em andamento, pendente, etc.

**Quando usar:**
- Primeiro setup
- Após reset da tabela status_config

---

## 🔄 Migração ClickUp

### `migrate-clickup.ts`
Migração completa ClickUp → Neon.

**Uso:**
```bash
npx tsx scripts/migrate-clickup.ts
```

**Faz:**
1. Backup do estado atual
2. Fetch de todas as tasks do ClickUp
3. Upsert no banco Neon
4. Fallback para campo ANO
5. Preserva campos CRM-only
6. Gera relatório detalhado

**Output:**
```
📥 MIGRAÇÃO CLICKUP → NEON INICIADA
✅ 6.701 tasks obtidas do ClickUp
✅ 170 cotações novas inseridas
✅ 6.531 cotações atualizadas
📊 Cobertura ANO: 100% (0 nulos)
```

**Quando usar:**
- Sincronização periódica com ClickUp
- Importação inicial
- Atualização de dados legados

---

## 📅 Uso Diário

### Rotina Recomendada

**Todo dia (automático via cron):**
```bash
# 3h da manhã
0 3 * * * npx tsx scripts/backup-database.ts daily
```

**Toda semana (automático via cron):**
```bash
# Segunda, 3h da manhã
0 3 * * 1 npx tsx scripts/backup-database.ts weekly
```

**Todo mês (automático via cron):**
```bash
# Dia 1, 3h da manhã
0 3 1 * * npx tsx scripts/backup-database.ts monthly
```

**A cada 15 minutos (via Vercel Cron):**
```
GET /api/health
```

---

### Antes de Operações Críticas

```bash
# 1. Backup manual
npx tsx scripts/backup-database.ts manual

# 2. Validar dados
npx tsx scripts/validate-data.ts

# 3. Health check
npx tsx scripts/health-check.ts

# 4. Executar operação
# ...

# 5. Validar novamente
npx tsx scripts/validate-data.ts
```

---

### Recuperação de Emergência

**Se dashboard estiver vazio:**
```bash
# 1. Health check (tenta corrigir automaticamente)
npx tsx scripts/health-check.ts

# 2. Se não resolver, recriar views manualmente
npx tsx scripts/create-views.ts

# 3. Validar
npx tsx scripts/validate-data.ts
```

**Se dados sumirem:**
```bash
# 1. Preview do último backup
npx tsx scripts/restore-backup.ts backups/daily/backup-daily-latest.json preview

# 2. Restore seguro
npx tsx scripts/restore-backup.ts backups/daily/backup-daily-latest.json safe

# 3. Validar
npx tsx scripts/validate-data.ts
```

---

## 🔐 Segurança

**Backups contêm dados sensíveis!**

- ✅ Arquivos gitignored (`/backups/`)
- ✅ Senhas NÃO são incluídas (apenas hash)
- ⚠️  Mantenha backups em local seguro
- ⚠️  Não commite backups no git
- ⚠️  Não compartilhe backups publicamente

---

## 📊 Estrutura de Diretórios

```
scripts/
├── README.md                   # Este arquivo
├── backup-database.ts          # Backup completo
├── restore-backup.ts           # Restore de backup
├── validate-data.ts            # Validação de integridade
├── health-check.ts             # Health check auto-recovery
├── create-views.ts             # Criar views SQL
├── seed-admin-users.ts         # Seed usuários admin
├── seed-demo.ts                # Seed dados demo
├── seed-status-config.ts       # Seed configurações
└── migrate-clickup.ts          # Migração ClickUp

backups/                        # Gitignored
├── daily/
│   ├── backup-daily-latest.json
│   └── backup-daily-2026-04-15.json
├── weekly/
├── monthly/
└── manual/
```

---

**Última atualização:** 2026-04-15
**Versão:** 1.0.0
