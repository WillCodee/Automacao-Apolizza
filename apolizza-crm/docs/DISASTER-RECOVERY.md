# 🚨 DISASTER RECOVERY - Apolizza CRM

## Guia de Recuperação de Desastres

Este documento descreve os procedimentos para recuperar dados em caso de falha crítica no sistema.

---

## 📋 Índice

1. [Tipos de Desastres](#tipos-de-desastres)
2. [Sistema de Backup](#sistema-de-backup)
3. [Procedimentos de Restore](#procedimentos-de-restore)
4. [Validação Pós-Restore](#validação-pós-restore)
5. [Prevenção](#prevenção)
6. [Contatos de Emergência](#contatos-de-emergência)

---

## 🔥 Tipos de Desastres

### 1. Views SQL Deletadas
**Sintoma:** Dashboard vazio, sem KPIs ou gráficos
**Severidade:** 🟡 Média (dados intactos, views faltando)
**Tempo de Recuperação:** 1-2 minutos

**Solução Rápida:**
```bash
cd apolizza-crm
npx tsx scripts/create-views.ts
```

ou use o health check automático:
```bash
npx tsx scripts/health-check.ts
```

---

### 2. Dados Deletados Acidentalmente
**Sintoma:** Cotações, usuários ou outros dados sumiram
**Severidade:** 🔴 Alta (perda de dados)
**Tempo de Recuperação:** 10-30 minutos

**Solução:**
1. Identifique o backup mais recente
2. Restaure em modo preview primeiro
3. Execute restore em modo safe

```bash
# Preview do backup
npx tsx scripts/restore-backup.ts backups/daily/backup-daily-latest.json preview

# Restore seguro (não sobrescreve dados existentes)
npx tsx scripts/restore-backup.ts backups/daily/backup-daily-latest.json safe
```

---

### 3. Corrupção Total do Banco
**Sintoma:** Erros em todas as queries, banco inacessível
**Severidade:** 🔴 Crítica (sistema offline)
**Tempo de Recuperação:** 30-60 minutos

**Solução:**
1. Provisione novo banco Neon
2. Execute migrations
3. Restaure backup completo
4. Recrie views
5. Valide dados

```bash
# 1. Atualizar DATABASE_URL em .env.local
# 2. Executar migrations (se houver)
npx drizzle-kit push

# 3. Restaurar backup
npx tsx scripts/restore-backup.ts backups/weekly/backup-weekly-latest.json force

# 4. Recriar views
npx tsx scripts/create-views.ts

# 5. Validar
npx tsx scripts/validate-data.ts
```

---

### 4. Falha do Vercel/Deploy
**Sintoma:** Site fora do ar, erros 500/502
**Severidade:** 🔴 Alta (sistema inacessível)
**Tempo de Recuperação:** 5-15 minutos

**Solução:**
1. Verificar status do Vercel
2. Rollback para deploy anterior
3. Verificar logs de erro

```bash
# Ver deployments
vercel ls

# Promover deployment anterior
vercel promote <deployment-url>

# Ver logs
vercel logs
```

---

## 💾 Sistema de Backup

### Estrutura de Backups

```
apolizza-crm/backups/
├── daily/          # Backups diários (últimos 7 dias)
├── weekly/         # Backups semanais (últimas 4 semanas)
├── monthly/        # Backups mensais (últimos 12 meses)
└── manual/         # Backups manuais (indefinido)
```

### Política de Retenção

| Tipo | Frequência | Retenção | Comando |
|------|------------|----------|---------|
| Daily | Todo dia às 3h | 7 dias | `npx tsx scripts/backup-database.ts daily` |
| Weekly | Segunda às 3h | 4 semanas | `npx tsx scripts/backup-database.ts weekly` |
| Monthly | Dia 1 às 3h | 12 meses | `npx tsx scripts/backup-database.ts monthly` |
| Manual | On-demand | Indefinido | `npx tsx scripts/backup-database.ts manual` |

### Conteúdo dos Backups

Cada backup contém:
- ✅ Todas as **cotações** (incluindo deletadas)
- ✅ Todos os **usuários** (sem senhas hasheadas)
- ✅ Todos os **documentos** (metadados, não arquivos Blob)
- ✅ Todo o **histórico** de mudanças
- ✅ Todas as **metas**
- ✅ Todas as **configurações** (status_config, comissao_tabela)
- ✅ Todas as **tarefas**
- ✅ Todas as **notificações**
- ✅ Todos os **grupos**

### Criar Backup Manual

```bash
# Backup manual antes de operações críticas
npx tsx scripts/backup-database.ts manual

# Exemplo de output:
# 📁 Arquivo: backups/manual/backup-manual-2026-04-15T15-30-00.json
# 📊 Tamanho: 12.45 MB
# 📈 Total de registros: 5.234
```

---

## 🔄 Procedimentos de Restore

### Modo Preview (Recomendado para análise)

```bash
npx tsx scripts/restore-backup.ts <caminho-backup> preview
```

**Exemplo:**
```bash
npx tsx scripts/restore-backup.ts backups/daily/backup-daily-latest.json preview
```

**Output:**
```
👁️  MODO PREVIEW - Nenhuma mudança será feita

  cotacoes: 3367 registros
  users: 11 registros
  cotacao_docs: 245 registros
  ...
```

### Modo Safe (Restaura apenas novos registros)

```bash
npx tsx scripts/restore-backup.ts <caminho-backup> safe
```

- ✅ **Seguro:** Não sobrescreve dados existentes
- ✅ Baseado em ID único
- ✅ Recomendado para recuperação parcial

### Modo Force (Sobrescreve dados existentes)

```bash
npx tsx scripts/restore-backup.ts <caminho-backup> force
```

- ⚠️  **PERIGOSO:** Sobrescreve dados existentes
- ⚠️  Aguarda 5 segundos antes de executar (cancelar com Ctrl+C)
- ⚠️  Use apenas se tiver certeza!

---

## ✅ Validação Pós-Restore

Sempre execute validação após restore:

```bash
npx tsx scripts/validate-data.ts
```

**Verifica:**
- ✅ Existência de todas as tabelas
- ✅ Existência de todas as views
- ✅ Integridade referencial (FK válidas)
- ✅ Dados órfãos
- ✅ Consistência de dados

**Com auto-fix:**
```bash
npx tsx scripts/validate-data.ts --fix
```

---

## 🛡️ Prevenção

### 1. Backups Automáticos

Configure cron jobs para backups automáticos:

```bash
# Editar crontab
crontab -e

# Adicionar linhas:
0 3 * * * cd /home/gustavo/Automacao-Apolizza/apolizza-crm && npx tsx scripts/backup-database.ts daily
0 3 * * 1 cd /home/gustavo/Automacao-Apolizza/apolizza-crm && npx tsx scripts/backup-database.ts weekly
0 3 1 * * cd /home/gustavo/Automacao-Apolizza/apolizza-crm && npx tsx scripts/backup-database.ts monthly
```

### 2. Health Check Automático

Configure health check via Vercel Cron:

**vercel.json:**
```json
{
  "crons": [
    {
      "path": "/api/health",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

### 3. Monitoramento Externo

Use serviços como UptimeRobot para monitorar:
```
GET https://apolizza-crm.vercel.app/api/health
```

**Status esperado:** 200 (healthy) ou 200 (degraded)
**Status crítico:** 503

### 4. Redundância de Backups

Mantenha cópias dos backups em:
- ✅ Servidor local
- ✅ Vercel Blob Storage (opcional)
- ✅ Google Drive (manual)
- ✅ Outro servidor/cloud

---

## 🆘 Contatos de Emergência

### Suporte Técnico
- **Desenvolvedor:** Claude Code + Gustavo
- **Hosting:** Vercel Support (vercel.com/support)
- **Database:** Neon Support (neon.tech/docs/introduction/support)

### Escalação

1. **Nível 1:** Health check automático (auto-recovery de views)
2. **Nível 2:** Restore de backup daily (recuperação de dados)
3. **Nível 3:** Restore de backup weekly (falha maior)
4. **Nível 4:** Contatar Neon/Vercel support (infraestrutura)

---

## 📝 Checklist Pós-Desastre

Após recuperação, verificar:

- [ ] Login funciona
- [ ] Dashboard mostra dados
- [ ] Cotações aparecem na lista
- [ ] Filtros e busca funcionam
- [ ] Criação de nova cotação funciona
- [ ] Edição de cotação funciona
- [ ] Upload de documentos funciona
- [ ] Histórico de mudanças está intacto
- [ ] Usuários conseguem acessar
- [ ] Permissões (admin/cotador) funcionam
- [ ] Views SQL retornam dados
- [ ] Health check passa: `npx tsx scripts/health-check.ts`
- [ ] Validação passa: `npx tsx scripts/validate-data.ts`

---

## 🎯 SLA de Recuperação

| Tipo de Desastre | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) |
|------------------|--------------------------------|--------------------------------|
| Views deletadas | < 5 minutos | 0 (sem perda de dados) |
| Dados deletados | < 30 minutos | Último backup (max 24h) |
| Corrupção total | < 1 hora | Último backup (max 24h) |
| Falha Vercel | < 15 minutos | 0 (rollback) |

---

**Última atualização:** 2026-04-15
**Versão:** 1.0.0
**Responsável:** Equipe Apolizza
