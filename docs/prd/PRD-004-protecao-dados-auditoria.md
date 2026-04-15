# PRD-004: Proteção de Dados e Correção de Deploy

**Versão:** 1.0
**Data:** 2026-04-15
**Status:** Concluído
**Autor:** Gustavo + Claude

---

## 1. Resumo Executivo

Implementação de sistema completo de proteção de dados para o Apolizza CRM e correção de problemas críticos de deploy que impediam a publicação de features em produção.

---

## 2. Problemas Identificados e Resolvidos

### 2.1 Dashboard Vazio (Severidade: Alta)

**Sintoma:** Dashboard sem dados, KPIs zerados, gráficos vazios.

**Causa raiz:** As 4 SQL Views (`vw_kpis`, `vw_status_breakdown`, `vw_cotadores`, `vw_monthly_trend`) foram deletadas do banco Neon.

**Solução:** Views recriadas via `scripts/create-views.ts`. Health check automático implementado para detectar e recriar views automaticamente.

**Dados preservados:** 3.367 cotações intactas.

---

### 2.2 Página de Auditoria 404 (Severidade: Crítica)

**Sintoma:** Página `/configuracoes/auditoria` retornava erro 404 em produção.

**Causa raiz (camada 1 — código):** Página estruturada como Client Component (`"use client"` + `useSession()`). Next.js 16 App Router exige Server Component no `page.tsx`.

**Correção:** Split em `page.tsx` (Server Component com `auth()`) + `auditoria-content.tsx` (Client Component).

**Causa raiz (camada 2 — deploy):** Campo `comment` no `vercel.json` é propriedade inválida no schema do Vercel. Isso fazia **todos os deploys recentes falharem** com erro `INVALID_VERCEL_CONFIG`, e o Vercel continuava servindo um deploy antigo (commit `844c5f4`, sem auditoria).

**Correção:** Removidos campos `comment` do `vercel.json`.

**Commit do fix:** `f60b724`

---

### 2.3 Role do Usuário Incorreta (Severidade: Média)

**Sintoma:** Usuário `gustavo` não via menus de Configurações e Administração completos.

**Causa raiz:** Role estava como `admin` em vez de `proprietario`.

**Correção:** Atualizado via SQL direto no banco Neon.

---

## 3. Sistema de Proteção de Dados Implementado

### 3.1 Backup Automatizado

**Script:** `scripts/backup-database.ts`

**Tipos de backup:**

| Tipo | Frequência | Retenção | Comando |
|------|------------|----------|---------|
| Daily | Diário | 7 dias | `npx tsx scripts/backup-database.ts daily` |
| Weekly | Semanal | 4 semanas | `npx tsx scripts/backup-database.ts weekly` |
| Monthly | Mensal | 12 meses | `npx tsx scripts/backup-database.ts monthly` |
| Manual | On-demand | Indefinido | `npx tsx scripts/backup-database.ts manual` |

**Dados incluídos por backup:**
- cotacoes (3.367+ registros)
- users (11 registros)
- cotacao_docs
- cotacao_history
- metas
- status_config
- comissao_tabela
- tarefas
- notificacoes (quando existir)
- grupos (quando existir)

**Primeiro backup:** `backups/manual/backup-manual-2026-04-15T18-54-07.json` (3.10 MB)

---

### 3.2 Sistema de Restore

**Script:** `scripts/restore-backup.ts`

**3 modos de segurança:**

| Modo | Descrição | Risco |
|------|-----------|-------|
| `preview` | Mostra o que seria restaurado sem executar | Nenhum |
| `safe` | Restaura apenas registros que não existem (por ID) | Baixo |
| `force` | Sobrescreve dados existentes (aguarda 5s para cancelar) | Alto |

**Uso:**
```bash
npx tsx scripts/restore-backup.ts <caminho> preview
npx tsx scripts/restore-backup.ts <caminho> safe
npx tsx scripts/restore-backup.ts <caminho> force
```

---

### 3.3 Health Check Automático

**Script:** `scripts/health-check.ts`

**Verificações:**
1. Conexão com banco de dados
2. Existência das 4 SQL Views
3. Auto-recovery: recria views se estiverem faltando
4. Validação de dados críticos (cotações e usuários)

**Output:** Status `HEALTHY`, `DEGRADED` ou `CRITICAL`

---

### 3.4 Validação de Integridade

**Script:** `scripts/validate-data.ts`

**20+ testes executados:**
- Existência de 8 tabelas obrigatórias + 2 opcionais
- Existência de 4 views SQL
- Integridade referencial (FK válidas)
- Detecção de dados órfãos
- Consistência de soft delete
- Verificação de usuários ativos

**Flag `--fix`:** Corrige problemas automaticamente quando possível.

---

### 3.5 API de Monitoramento

**Endpoint:** `GET /api/health`

**Respostas:**
- `200` + `{ status: "healthy" }` — Sistema OK
- `200` + `{ status: "degraded" }` — Funcionando com problemas
- `503` + `{ status: "critical" }` — Sistema crítico

**Uso recomendado:** UptimeRobot, Pingdom, Vercel Cron (a cada 15 min)

---

### 3.6 Documentação de Disaster Recovery

**Arquivo:** `docs/DISASTER-RECOVERY.md`

**Cenários documentados:**

| Cenário | RTO | RPO |
|---------|-----|-----|
| Views deletadas | < 5 min | 0 (sem perda) |
| Dados deletados | < 30 min | Último backup (max 24h) |
| Corrupção total | < 1 hora | Último backup (max 24h) |
| Falha Vercel | < 15 min | 0 (rollback) |

---

## 4. Correções de Deploy

### 4.1 vercel.json Inválido

**Antes (INVÁLIDO):**
```json
{
  "crons": [
    {
      "path": "/api/cron/manha",
      "schedule": "0 11 * * *",
      "comment": "08:00 BRT: ..."
    }
  ]
}
```

**Depois (VÁLIDO):**
```json
{
  "crons": [
    {
      "path": "/api/cron/manha",
      "schedule": "0 11 * * *"
    }
  ]
}
```

### 4.2 Estrutura da Página de Auditoria

**Antes (Client Component no page.tsx):**
```
src/app/configuracoes/auditoria/
└── page.tsx          ← "use client" + useSession() (ERRADO)
```

**Depois (Server + Client split):**
```
src/app/configuracoes/auditoria/
├── page.tsx              ← Server Component + auth() (CORRETO)
└── auditoria-content.tsx ← Client Component com UI
```

### 4.3 tsconfig.json

**Adicionado:** `scripts/**/*.ts` ao `exclude` para evitar que scripts de manutenção bloqueiem o build.

---

## 5. Arquivos Criados/Modificados

### Novos Arquivos

| Arquivo | Descrição | Linhas |
|---------|-----------|--------|
| `scripts/backup-database.ts` | Backup automatizado | ~150 |
| `scripts/restore-backup.ts` | Restore de backup | ~130 |
| `scripts/validate-data.ts` | Validação de integridade | ~260 |
| `scripts/health-check.ts` | Health check auto-recovery | ~140 |
| `scripts/README.md` | Documentação dos scripts | ~300 |
| `src/app/api/health/route.ts` | API de monitoramento | ~80 |
| `src/app/configuracoes/auditoria/auditoria-content.tsx` | UI da Sala do Auditor | ~800 |
| `docs/DISASTER-RECOVERY.md` | Guia de recuperação | ~200 |

### Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `vercel.json` | Removido campo `comment` inválido |
| `tsconfig.json` | Adicionado `scripts/**/*.ts` ao exclude |
| `.gitignore` | Adicionado `/backups/` e `/scripts/check-data.ts` |
| `src/app/configuracoes/auditoria/page.tsx` | Reescrito como Server Component |

---

## 6. Commits Relacionados

| Commit | Descrição |
|--------|-----------|
| `039b743` | fix: corrigir estrutura da página de auditoria para Next.js App Router |
| `201aa32` | feat: implementa sistema completo de proteção e backup de dados |
| `02223ef` | fix: corrige erros TypeScript nos scripts de manutenção |
| `f60b724` | fix: remove campo comment inválido do vercel.json |

---

## 7. Configuração Recomendada (Pós-Deploy)

### 7.1 Cron Jobs para Backup

```bash
crontab -e

# Adicionar:
0 3 * * * cd /home/gustavo/Automacao-Apolizza/apolizza-crm && npx tsx scripts/backup-database.ts daily
0 3 * * 1 cd /home/gustavo/Automacao-Apolizza/apolizza-crm && npx tsx scripts/backup-database.ts weekly
0 3 1 * * cd /home/gustavo/Automacao-Apolizza/apolizza-crm && npx tsx scripts/backup-database.ts monthly
```

### 7.2 Monitoramento Externo

Configurar UptimeRobot ou similar para monitorar:
```
GET https://apolizza-crm.vercel.app/api/health
Intervalo: 15 minutos
Alerta: status != 200
```

### 7.3 Redundância de Backups

Copiar backups periodicamente para:
- Google Drive
- Outro servidor/cloud
- Repositório privado separado

---

## 8. Lições Aprendidas

1. **Sempre validar `vercel.json` contra o schema oficial** — Propriedades inválidas causam falha silenciosa no deploy.

2. **Next.js 16 App Router exige Server Components em `page.tsx`** — Usar `"use client"` com `useSession()` causa 404 em produção.

3. **SQL Views podem ser deletadas** — Implementar health check com auto-recovery é essencial.

4. **Backups regulares são obrigatórios** — Dados de 3.367+ cotações representam valor significativo para o negócio.

5. **Verificar qual commit o Vercel está usando** — Deploys falhados fazem o Vercel servir a última versão que funcionou.

---

## 9. Status Final

| Item | Status |
|------|--------|
| Dashboard com dados | ✅ Funcionando |
| Página de auditoria | ✅ Acessível |
| Menu Administração | ✅ Visível (admin + proprietario) |
| Menu Configurações | ✅ Visível (proprietario) |
| Role gustavo | ✅ proprietario |
| Deploy Vercel | ✅ Commit `f60b724` em produção |
| Sistema de backup | ✅ Operacional |
| Health check | ✅ Ativo |
| Validação de dados | ✅ 20+ testes passando |
| API de monitoramento | ✅ `/api/health` disponível |
| Documentação | ✅ Completa |

---

**Data de conclusão:** 2026-04-15
**Próxima revisão:** 2026-05-01
