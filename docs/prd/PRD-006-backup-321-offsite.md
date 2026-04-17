# PRD-006: Backup 3-2-1 Off-Site — Proteção Profissional de Dados

**Versão:** 1.0
**Data:** 2026-04-16
**Status:** Draft — Pronto para execução
**Autor:** Gustavo + Claude
**Precede:** PRD-004 (Proteção de Dados)
**Relacionado:** PRD-005 (Migração HostGator)

---

## 1. Resumo Executivo

Implementação da estratégia de backup **3-2-1** (padrão da indústria) para garantir que os dados do Apolizza CRM estejam protegidos contra qualquer cenário de falha: erro humano, comprometimento da conta Neon, falha de infra, ransomware, ou mesmo descontinuação do provedor.

**Regra 3-2-1:**
- **3 cópias** dos dados
- em **2 mídias diferentes**
- com **1 cópia off-site** (fora do provedor primário)

Este PRD é **independente do PRD-005** (migração HostGator) e deve ser executado **antes** de qualquer migração de infra. Representa o mínimo aceitável de proteção de dados para um CRM operacional com 3.368 cotações e dados pessoais sensíveis de clientes.

---

## 2. Contexto e Motivação

### 2.1 Situação atual (2026-04-16)

| Camada | Status | Risco |
|---|---|---|
| Dados primários | Neon PostgreSQL (sa-east-1) | Cópia única |
| Point-in-time recovery | Neon Free: 7 dias | Limitado |
| Backup local | `scripts/backup-database.ts` | Manual, não automatizado |
| Backup off-site | Nenhum | **Crítico** |
| Teste de restore | Nunca executado | Backup não validado |
| Audit trail | `cotacao_history` | OK |

### 2.2 Cenários de falha não cobertos atualmente

| Cenário | Probabilidade | Impacto | Cobertura atual |
|---|---|---|---|
| Deleção acidental de registro | Alta | Médio | PITR Neon 7d ✓ |
| Deleção acidental de tabela | Média | Alto | PITR Neon 7d ✓ |
| Drop de schema/database | Baixa | Crítico | PITR Neon 7d ✓ |
| Comprometimento da conta Neon | Baixa | Crítico | **Nenhuma** ❌ |
| Descontinuação do Neon como serviço | Muito baixa | Crítico | **Nenhuma** ❌ |
| Ransomware na máquina local | Média | Variável | **Nenhuma** ❌ |
| Vazamento de credenciais DB | Média | Crítico | **Nenhuma** ❌ |
| Erro em migração de schema | Média | Alto | Parcial |
| Backup corrompido | Baixa | Crítico | **Não testado** ❌ |
| Prazo > 7 dias para descobrir corrupção | Baixa | Crítico | **Nenhuma** ❌ |

### 2.3 Por que agora

- **3.368 cotações** = patrimônio operacional irrecuperável se perdido
- Dados pessoais de clientes = obrigação legal (LGPD Art. 46: segurança dos dados)
- Histórico financeiro (R$ 23.5M em prêmios) = auditoria fiscal/contábil
- Custo da solução é **trivial** (~US$ 1-3/mês) comparado ao risco

### 2.4 Princípio norteador

> "Um backup que nunca foi testado é um backup que não existe."

Este PRD define não apenas como **gerar** backups, mas como **validar** periodicamente que eles são restauráveis.

---

## 3. Escopo

### 3.1 Dentro do escopo

- Automação de backup diário/semanal/mensal
- Destinos off-site em 2 provedores independentes
- Criptografia em trânsito e em repouso
- Rotação automática de backups antigos (retention policy)
- Testes de restore automatizados semanais
- Testes de restore manual mensais (DR drill)
- Monitoramento + alertas em caso de falha
- Documentação operacional (runbook)

### 3.2 Fora do escopo

- Migração de infra (PRD-005)
- Backup de arquivos de documentos (`cotacao_docs` apontam para Vercel Blob — tratado separadamente em seção 8.3)
- Backup de código-fonte (já coberto por GitHub)
- Mudanças no schema do banco

### 3.3 Dados cobertos

**Tabelas críticas (backup completo):**
- `cotacoes` (3.368+ registros)
- `users` (11 registros)
- `cotacao_docs` (metadata)
- `cotacao_history` (audit trail)
- `metas`
- `status_config`
- `situacao_config`
- `comissao_tabela`
- `tarefas` e relacionadas
- `regras_auditoria`
- `chat_mensagens`, `chat_leituras`
- `grupos_usuarios`, `grupo_membros`
- `cotacao_notificacoes`

**Dados NÃO incluídos:**
- Documentos físicos em Vercel Blob (tratamento separado)
- Sessões ativas (JWT, não persiste)
- Cache

---

## 4. Arquitetura da Solução

### 4.1 Diagrama

```
┌──────────────────────────────────────────────────────────┐
│            Neon PostgreSQL (primário — SP)               │
└──────────────────────┬───────────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         │                            │
         ▼                            ▼
┌─────────────────┐         ┌─────────────────────┐
│  GitHub Actions │         │  PITR Neon (7-30d)  │
│  Cron diário    │         │  (automático)       │
│  03:00 BRT      │         └─────────────────────┘
└────────┬────────┘
         │ pg_dump --format=custom + gzip + gpg
         │
         ├──────────────────────┬─────────────────┐
         ▼                      ▼                 ▼
┌─────────────────┐   ┌───────────────────┐   ┌──────────────┐
│  Backblaze B2   │   │  Google Drive     │   │  Local dev   │
│  (BR region)    │   │  (rclone)         │   │  (semanal)   │
│  Primary off-   │   │  Secondary off-   │   │  Tertiary    │
│  site           │   │  site             │   │              │
└─────────────────┘   └───────────────────┘   └──────────────┘
         │
         │ 1x/semana: restore automático em DB temp
         ▼
┌─────────────────────────────────────────────────────────┐
│  GitHub Actions: Restore Test                           │
│  - Cria DB temp no Neon                                 │
│  - pg_restore do backup mais recente                    │
│  - Valida row counts vs. produção                       │
│  - Deleta DB temp                                       │
│  - Notifica via Telegram: PASS/FAIL                     │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Cumprimento da regra 3-2-1

| Cópia | Local | Mídia | Off-site? |
|---|---|---|---|
| 1 | Neon PostgreSQL (primário) | Cloud SSD | — |
| 2 | Backblaze B2 | Object storage | ✓ Off-site |
| 3 | Google Drive | Object storage | ✓ Off-site (provedor diferente) |
| 4 (bônus) | HD externo físico (mensal manual) | Disco magnético | ✓ Off-line |

**Validação 3-2-1:** ✓ 3+ cópias | ✓ 2+ mídias | ✓ 1+ off-site

---

## 5. Frequência e Retenção

### 5.1 Política de retenção

| Tipo | Frequência | Retenção | Tamanho estimado |
|---|---|---|---|
| Daily | Diário 03:00 BRT | 7 dias | ~180 MB × 7 = 1.3 GB |
| Weekly | Domingo 03:30 BRT | 4 semanas | ~180 MB × 4 = 720 MB |
| Monthly | Dia 1 do mês 04:00 BRT | 12 meses | ~180 MB × 12 = 2.2 GB |
| Yearly | 1º de janeiro 04:30 BRT | 7 anos (obrigação fiscal) | ~180 MB × 7 = 1.3 GB |
| Manual | Sob demanda | Indefinido | Variável |

**Total estimado em storage:** ~5.5 GB (crescendo ~2-3 GB/ano)

**Custo Backblaze B2:** US$ 0.006/GB/mês × 5.5 GB = **US$ 0.03/mês** (sim, três centavos)

### 5.2 Estratégia GFS (Grandfather-Father-Son)

- **Son** (diário): últimos 7 dias
- **Father** (semanal): últimas 4 semanas
- **Grandfather** (mensal): últimos 12 meses
- **Great-grandfather** (anual): últimos 7 anos

Permite recuperação precisa em qualquer janela temporal dos últimos 7 anos.

---

## 6. Implementação Técnica

### 6.1 Stack de ferramentas

| Ferramenta | Uso | Custo |
|---|---|---|
| GitHub Actions | Orquestração (cron) | Grátis (2000 min/mês no Free) |
| `pg_dump` (PostgreSQL 16) | Geração de dump | Grátis |
| `gzip` | Compressão | Grátis |
| `gpg` | Criptografia em repouso | Grátis |
| `rclone` | Upload para múltiplos destinos | Grátis |
| Backblaze B2 | Primary off-site | ~US$ 0.50/mês |
| Google Drive | Secondary off-site | Grátis (15 GB plano free) |
| Telegram Bot | Alertas | Grátis |

**Custo mensal total:** ~US$ 0.50 (≈ R$ 3)

### 6.2 Workflow GitHub Actions

**Arquivo:** `.github/workflows/backup-daily.yml`

```yaml
name: Backup Daily

on:
  schedule:
    - cron: '0 6 * * *'  # 03:00 BRT = 06:00 UTC
  workflow_dispatch:     # Permite rodar manualmente

jobs:
  backup:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - name: Install PostgreSQL client
        run: |
          sudo apt-get update
          sudo apt-get install -y postgresql-client-16 gnupg rclone

      - name: Setup rclone config
        env:
          RCLONE_CONFIG: ${{ secrets.RCLONE_CONFIG }}
        run: |
          mkdir -p ~/.config/rclone
          echo "$RCLONE_CONFIG" > ~/.config/rclone/rclone.conf

      - name: Generate backup filename
        id: filename
        run: |
          echo "name=backup-$(date +'%Y-%m-%d-%H%M').sql.gz.gpg" >> $GITHUB_OUTPUT

      - name: Dump + compress + encrypt
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          GPG_PASSPHRASE: ${{ secrets.BACKUP_GPG_PASSPHRASE }}
        run: |
          pg_dump "$DATABASE_URL" \
            --format=custom \
            --no-owner \
            --no-acl \
            --verbose \
          | gzip -9 \
          | gpg --symmetric --cipher-algo AES256 \
                --batch --passphrase "$GPG_PASSPHRASE" \
                --output "${{ steps.filename.outputs.name }}"

      - name: Validate backup size
        run: |
          SIZE=$(stat -c%s "${{ steps.filename.outputs.name }}")
          if [ "$SIZE" -lt 1000000 ]; then
            echo "::error::Backup muito pequeno ($SIZE bytes). Possível falha."
            exit 1
          fi
          echo "Backup size: $SIZE bytes"

      - name: Upload to Backblaze B2
        run: |
          rclone copy "${{ steps.filename.outputs.name }}" \
            backblaze:apolizza-backups/daily/ \
            --progress

      - name: Upload to Google Drive
        run: |
          rclone copy "${{ steps.filename.outputs.name }}" \
            gdrive:apolizza-backups/daily/ \
            --progress

      - name: Cleanup old backups (> 7 days)
        run: |
          rclone delete backblaze:apolizza-backups/daily/ \
            --min-age 7d
          rclone delete gdrive:apolizza-backups/daily/ \
            --min-age 7d

      - name: Notify success
        if: success()
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: |
          curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
            -d "chat_id=$TELEGRAM_CHAT_ID" \
            -d "text=✅ Backup diário OK — ${{ steps.filename.outputs.name }}"

      - name: Notify failure
        if: failure()
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: |
          curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
            -d "chat_id=$TELEGRAM_CHAT_ID" \
            -d "text=🚨 Backup diário FALHOU — verificar GitHub Actions"
```

**Secrets necessários no GitHub:**
- `DATABASE_URL` — connection string Neon (read-only role recomendado)
- `BACKUP_GPG_PASSPHRASE` — senha forte para criptografar backups
- `RCLONE_CONFIG` — conteúdo do arquivo `rclone.conf` com credenciais B2 + GDrive
- `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` — para alertas

### 6.3 Workflow de teste de restore

**Arquivo:** `.github/workflows/backup-restore-test.yml`

```yaml
name: Backup Restore Test

on:
  schedule:
    - cron: '0 9 * * 0'  # Domingo 06:00 BRT = 09:00 UTC
  workflow_dispatch:

jobs:
  restore-test:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Install dependencies
        run: sudo apt-get install -y postgresql-client-16 gnupg rclone

      - name: Setup rclone
        env:
          RCLONE_CONFIG: ${{ secrets.RCLONE_CONFIG }}
        run: |
          mkdir -p ~/.config/rclone
          echo "$RCLONE_CONFIG" > ~/.config/rclone/rclone.conf

      - name: Download latest backup
        run: |
          LATEST=$(rclone lsf backblaze:apolizza-backups/daily/ \
            --include "*.gpg" | sort | tail -1)
          rclone copy "backblaze:apolizza-backups/daily/$LATEST" ./
          echo "BACKUP_FILE=$LATEST" >> $GITHUB_ENV

      - name: Decrypt + decompress
        env:
          GPG_PASSPHRASE: ${{ secrets.BACKUP_GPG_PASSPHRASE }}
        run: |
          gpg --decrypt --batch --passphrase "$GPG_PASSPHRASE" \
            "$BACKUP_FILE" | gunzip > backup.dump

      - name: Create test database in Neon
        env:
          PGURL_ADMIN: ${{ secrets.NEON_ADMIN_URL }}
        run: |
          DBNAME="restore_test_$(date +%s)"
          psql "$PGURL_ADMIN" -c "CREATE DATABASE $DBNAME;"
          echo "TEST_DB=$DBNAME" >> $GITHUB_ENV
          echo "TEST_URL=${PGURL_ADMIN%/*}/$DBNAME" >> $GITHUB_ENV

      - name: Restore backup to test DB
        run: |
          pg_restore --no-owner --no-acl --clean --if-exists \
            -d "$TEST_URL" backup.dump

      - name: Validate row counts
        run: |
          COUNT=$(psql "$TEST_URL" -tAc "SELECT COUNT(*) FROM cotacoes WHERE deleted_at IS NULL;")
          if [ "$COUNT" -lt 3000 ]; then
            echo "::error::Row count suspeito: $COUNT cotações (esperado >3000)"
            exit 1
          fi
          echo "✅ Row count OK: $COUNT cotações"

      - name: Drop test database
        if: always()
        env:
          PGURL_ADMIN: ${{ secrets.NEON_ADMIN_URL }}
        run: |
          psql "$PGURL_ADMIN" -c "DROP DATABASE IF EXISTS $TEST_DB;"

      - name: Notify result
        if: always()
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: |
          STATUS="${{ job.status }}"
          ICON="✅"
          [ "$STATUS" != "success" ] && ICON="🚨"
          curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
            -d "chat_id=$TELEGRAM_CHAT_ID" \
            -d "text=$ICON Restore test semanal: $STATUS"
```

### 6.4 Workflows adicionais

- `backup-weekly.yml` — roda domingo 03:30, retém 4 semanas
- `backup-monthly.yml` — roda dia 1 do mês 04:00, retém 12 meses
- `backup-yearly.yml` — roda 1º janeiro 04:30, retém 7 anos

(Mesmo template do daily, com cron e retention diferentes.)

---

## 7. Criptografia e Segurança

### 7.1 Em trânsito

- Connection string Neon usa `sslmode=require`
- Upload para B2 / GDrive via HTTPS/TLS 1.2+
- Telegram via HTTPS

### 7.2 Em repouso

- **GPG AES-256** simétrico em cada arquivo de backup
- Passphrase armazenada apenas em GitHub Secrets (nunca em código)
- Passphrase backup escrita em papel, guardada em cofre físico (recuperação de última instância)

### 7.3 Controle de acesso

- Bucket Backblaze B2 com **Application Key específica** (apenas write + delete, sem read global)
- Google Drive via OAuth refresh token dedicado ao CI (não conta pessoal)
- GitHub Secrets com acesso restrito ao repo privado

### 7.4 Rotação de credenciais

- Passphrase GPG: rotacionada anualmente ou em caso de suspeita
- Tokens B2/GDrive: rotacionados a cada 6 meses
- Log de quem acessou backups: habilitar em ambos os provedores

### 7.5 Auditoria

- GitHub Actions logs retidos por 90 dias (padrão)
- Backblaze B2 lifecycle/audit log ativo
- Telegram histórico de alertas = histórico de execuções

---

## 8. Cenários Especiais

### 8.1 Crescimento do banco

**Trigger:** Backup passa de 1 GB compactado.

**Ação:** Avaliar migração de `pg_dump` para `pg_basebackup` + WAL archiving, reduzindo tempo e permitindo PITR externo.

### 8.2 Dados sensíveis / PII

O backup contém dados pessoais de clientes (nome, documento, contatos). LGPD Art. 46 exige proteção adequada.

**Medidas:**
- Criptografia GPG obrigatória (não negociável)
- Restrição de acesso à passphrase
- Registro de acessos aos backups
- Contratos de processamento (DPA) com Backblaze e Google

### 8.3 Backup de documentos (Vercel Blob)

Os arquivos físicos de documentos ficam no Vercel Blob, **fora deste PRD**. Cobertura recomendada:

- Workflow adicional semanal: download via API Blob → upload para Backblaze
- Script de inventory: lista todos os blobs via Vercel API e compara com `cotacao_docs`
- Alerta se blob órfão ou registro sem blob

### 8.4 Ransomware / comprometimento da máquina

Se máquina local ou conta GitHub for comprometida:
- Backups em Backblaze têm **Object Lock** habilitado (retenção 30 dias imutável)
- Mesmo com credenciais, atacante não consegue deletar backups recentes
- Google Drive tem versioning (30 dias de histórico)

### 8.5 Descontinuação do Neon

Se o Neon como serviço encerrar:
- Backups ainda estão em B2 + GDrive + local
- Restore em PostgreSQL self-hosted ou outro provedor compatível
- Tempo estimado de recuperação: < 4h

---

## 9. Runbook Operacional

### 9.1 Restore completo (disaster recovery)

**Cenário:** Banco de produção perdido totalmente.

**Passos:**
1. Baixar último backup diário de Backblaze B2
2. Descriptografar com passphrase GPG (guardada no cofre)
3. Decompress (`gunzip`)
4. Criar DB vazio no provedor (Neon ou alternativo)
5. `pg_restore --no-owner --no-acl -d $DATABASE_URL backup.dump`
6. Recriar as 4 SQL Views: `npx tsx scripts/create-views.ts`
7. Atualizar sequences: `SELECT setval(pg_get_serial_sequence(...))`
8. Validação:
   - Row counts por tabela
   - Queries das views retornam dados
   - Login com usuário gustavo funciona
9. Redeploy da aplicação apontando para novo `DATABASE_URL`

**RTO (Recovery Time Objective) alvo:** 2 horas
**RPO (Recovery Point Objective) alvo:** 24 horas (último backup diário)

### 9.2 Restore parcial (deleção acidental de 1 registro)

**Opção preferida:** usar PITR do Neon (até 7 dias)

**Opção fallback:** extrair do dump via `pg_restore --data-only --table=cotacoes` em DB staging, depois `INSERT` manual.

### 9.3 Validação mensal (DR drill)

1º dia útil de cada mês:
1. Executar `workflow_dispatch` do backup-restore-test
2. Documentar resultado em `docs/DR-DRILL-LOG.md`
3. Se falhar: abrir incident, fix, re-test antes de fechar
4. Relatório trimestral para stakeholders

### 9.4 Onboarding de novo responsável técnico

Checklist de transferência:
- [ ] Acesso ao GitHub Secrets (read-only para auditoria)
- [ ] Passphrase GPG comunicada presencialmente (não em chat/email)
- [ ] Acesso ao cofre físico onde está a cópia em papel
- [ ] Runbook revisado em conjunto
- [ ] DR drill executado em conjunto
- [ ] Credenciais B2 e GDrive registradas em 1Password da equipe

---

## 10. Monitoramento e Alertas

### 10.1 Alertas ativos (Telegram)

| Evento | Severidade | Destino |
|---|---|---|
| Backup diário sucesso | Info | Canal dedicado |
| Backup diário falha | Crítico | Canal + SMS (futuro) |
| Restore test sucesso | Info | Canal dedicado |
| Restore test falha | Crítico | Canal + SMS (futuro) |
| Backup tamanho anômalo (< 50% do esperado) | Alto | Canal |
| Backup tamanho anômalo (> 200% do esperado) | Alto | Canal |

### 10.2 Dashboard mensal

Relatório automático no 1º dia útil do mês com:
- Taxa de sucesso dos backups do mês anterior (alvo: 100%)
- Tamanho médio e tendência
- Status do restore test semanal
- Espaço utilizado em cada destino
- Custos (B2 billing export)

### 10.3 Alertas passivos

- GitHub Actions falhou (via email padrão do GitHub)
- Backblaze quota atingida (via email B2)
- Google Drive quota atingida (via email Google)

---

## 11. Critérios de Sucesso

- [ ] Backup diário executando automaticamente há 30 dias consecutivos sem falha
- [ ] Backup semanal e mensal em retenção conforme política GFS
- [ ] Último backup sempre em **3 destinos** simultaneamente
- [ ] Restore test semanal com 4 execuções bem-sucedidas consecutivas
- [ ] DR drill mensal manual executado e documentado
- [ ] Alertas Telegram chegando em tempo real (< 5 min após evento)
- [ ] Runbook validado em transferência para pelo menos 2 pessoas
- [ ] Custo mensal dentro do orçado (< US$ 5)
- [ ] Nenhum backup não-criptografado em nenhum destino

---

## 12. Plano de Implementação

### Fase 1 — Setup de infraestrutura (1 dia)

**Atividades:**
- Criar conta Backblaze B2 (se não existir)
- Criar bucket `apolizza-backups` com Object Lock + lifecycle policy
- Gerar Application Key específica (restricted)
- Criar pasta Google Drive dedicada + OAuth refresh token
- Instalar rclone local e configurar ambos os remotes
- Gerar passphrase GPG forte (openssl rand -base64 48) e registrar em cofre

**Entregáveis:**
- `rclone.conf` funcional localmente
- Passphrase GPG em 1Password + cópia física
- Bucket B2 com política de retenção ativa

**Critério de saída:** `rclone copy test.txt backblaze:apolizza-backups/test/` funciona.

---

### Fase 2 — Workflows de backup (1 dia)

**Atividades:**
- Criar `.github/workflows/backup-daily.yml`
- Criar `.github/workflows/backup-weekly.yml`
- Criar `.github/workflows/backup-monthly.yml`
- Configurar todos os secrets no GitHub
- Executar manualmente (`workflow_dispatch`) cada um
- Validar arquivo em B2 + GDrive
- Testar descriptografia local

**Entregáveis:**
- 3 workflows ativos e com 1 execução manual bem-sucedida cada
- Secrets documentados em `docs/SECRETS.md` (lista de nomes, nunca valores)

**Critério de saída:** `gpg --decrypt backup.sql.gz.gpg | gunzip | head` mostra SQL válido.

---

### Fase 3 — Workflow de teste de restore (1 dia)

**Atividades:**
- Criar `NEON_ADMIN_URL` (connection com permissão CREATE/DROP DATABASE)
- Criar `.github/workflows/backup-restore-test.yml`
- Rodar manualmente
- Validar que DB temporário é criado e deletado corretamente
- Validar alerta Telegram

**Entregáveis:**
- Workflow de restore test ativo
- Primeiro restore test bem-sucedido documentado

**Critério de saída:** Restore test automático reproduz row count de produção (±1%).

---

### Fase 4 — DR drill manual (1 dia)

**Atividades:**
- Executar restore completo em ambiente local (ou Neon branch)
- Medir RTO real
- Validar todas as funcionalidades críticas
- Documentar timing e fricção em `docs/DR-DRILL-LOG.md`
- Ajustar runbook conforme aprendizados

**Entregáveis:**
- DR drill log com RTO medido
- Runbook atualizado

**Critério de saída:** RTO medido ≤ 4 horas.

---

### Fase 5 — Monitoramento e produção (0.5 dia)

**Atividades:**
- Configurar canal Telegram dedicado
- Validar alertas de sucesso e falha (forçar 1 falha para testar)
- Criar dashboard mensal (pode ser planilha ou issue template no GitHub)
- Comunicar equipe sobre o sistema

**Entregáveis:**
- Alertas funcionando em ambas as direções (success/fail)
- Documentação finalizada

**Critério de saída:** Sistema rodando autonomamente por 7 dias sem intervenção humana.

---

### Fase 6 — Backup de documentos Vercel Blob (opcional, 1 dia)

**Atividades:**
- Script de inventory de blobs
- Workflow semanal de sync Vercel Blob → Backblaze B2
- Validação de integridade (checksum)

**Entregáveis:**
- Blobs espelhados em B2
- Relatório de órfãos (se houver)

---

## 13. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Passphrase GPG perdida | Baixa | Crítico | 3 cópias: 1Password + cofre físico + documento selado |
| Quota GitHub Actions excedida | Baixa | Médio | Workflow dura ~3 min × 30d = 90 min/mês (de 2000 grátis) |
| Backblaze quota ou billing | Baixa | Médio | Monitoring + alerta em 80% quota |
| Backup corrompido silenciosamente | Média | Crítico | Restore test semanal + DR drill mensal |
| GitHub Actions indisponível | Baixa | Médio | Fallback: script local + cron em máquina dev |
| Schema muda e quebra restore | Média | Alto | Restore test detecta em < 7 dias |
| Dump demora > timeout (30min) | Baixa | Alto | Monitorar tempo, aumentar timeout antes do limite |

---

## 14. Custos

### 14.1 Mensal recorrente

| Item | Custo |
|---|---|
| Backblaze B2 (5.5 GB) | US$ 0.03 |
| Backblaze B2 egress (restore tests) | US$ 0.01/GB |
| Google Drive (dentro de 15 GB free) | US$ 0.00 |
| GitHub Actions (dentro de 2000 min free) | US$ 0.00 |
| Telegram | US$ 0.00 |
| **Total estimado** | **US$ 0.50/mês** (≈ R$ 3) |

### 14.2 One-time

- Tempo de implementação: ~4 dias de trabalho
- Cofre físico para passphrase: ~R$ 200 (se não existir)

### 14.3 Comparação com não-fazer

- **Custo de não fazer:** perda total de 3.368 cotações = perda operacional incalculável + risco LGPD + reputacional
- **ROI:** virtualmente infinito para os primeiros 2-3 anos

---

## 15. Alternativas Consideradas

### 15.1 Confiar apenas no PITR do Neon

**Prós:** Zero trabalho, incluído no plano.
**Contras:** Apenas 7 dias (Free) ou 30 (Pro), vinculado ao provedor, não protege contra comprometimento da conta.
**Veredito:** Insuficiente. Deve ser complementar, não única estratégia.

### 15.2 Neon Paid com logical replication para outra região

**Prós:** Gerenciado, PITR 30 dias, replica segura.
**Contras:** Custa US$ 19/mês mínimo, continua no mesmo provedor.
**Veredito:** Bom mas não substitui off-site externo.

### 15.3 Self-hosted pgbackrest / barman

**Prós:** Padrão-ouro do mundo PostgreSQL, suporte completo a PITR.
**Contras:** Requer servidor dedicado para orquestrar. Complexidade alta.
**Veredito:** Adequado para grande volume (> 100 GB). Overkill para Apolizza CRM em 2026.

### 15.4 Snapshot manual mensal + nada mais

**Prós:** Zero custo.
**Contras:** RPO de 30 dias é inaceitável para sistema operacional.
**Veredito:** Descartado.

### 15.5 Backup apenas para máquina local via cron

**Prós:** Simples.
**Contras:** Viola 3-2-1 (não é off-site), vulnerável a ransomware local.
**Veredito:** Descartado. Pode ser complemento (cópia 4), não substituto.

---

## 16. Dependências

### 16.1 Externas

- Conta Backblaze B2 ativa
- Conta Google com quota disponível (ou alternativa como Dropbox/OneDrive)
- Conta Telegram + bot configurado (reaproveitar o bot existente do projeto)
- Acesso admin ao repositório GitHub

### 16.2 Internas

- Aprovação para criar workflows no GitHub do projeto
- Acesso ao painel Neon para gerar connection strings
- Definição de canal Telegram para alertas

---

## 17. Cronograma Resumido

| Fase | Duração | Paralelizável? |
|---|---|---|
| 1. Infraestrutura | 1 dia | Não (bloqueia demais) |
| 2. Workflows de backup | 1 dia | Não |
| 3. Workflow de restore test | 1 dia | Sim (após fase 2) |
| 4. DR drill manual | 1 dia | Sim (após fase 3) |
| 5. Monitoramento | 0.5 dia | Sim (após fase 2) |
| 6. Backup de blobs (opcional) | 1 dia | Sim (após fase 2) |

**Duração total:** 4-5 dias de trabalho dedicado, ou 1-2 semanas com outras prioridades em paralelo.

---

## 18. Decisões em Aberto

- [ ] Backblaze B2 ou alternativa (Cloudflare R2, Wasabi, AWS S3 Glacier)?
- [ ] Google Drive ou alternativa como secondary (Dropbox, OneDrive)?
- [ ] Canal Telegram novo ou reaproveitar o existente do projeto?
- [ ] HD externo físico mensal — quem será responsável pela rotação?
- [ ] Backup de Vercel Blob (Fase 6) incluído no escopo inicial ou deixa para depois?
- [ ] Retenção de 7 anos (obrigação fiscal) é requisito real? Confirmar com contabilidade.

---

## 19. Métricas de Sucesso (pós-implementação)

Medir mensalmente:

| Métrica | Alvo | Consequência se não atingir |
|---|---|---|
| Taxa de sucesso de backup diário | 100% | Revisar infra CI ou Neon |
| Taxa de sucesso de restore test | 100% | Incident crítico — backups não confiáveis |
| RTO medido em DR drill | ≤ 4h | Revisar runbook |
| Tempo de propagação de alerta | ≤ 5 min | Revisar config Telegram |
| Custo mensal | ≤ US$ 5 | Revisar retenção ou destinos |
| Cobertura de tabelas no backup | 100% | Regressão no pg_dump |

---

## 20. Referências

- Regra 3-2-1 Backup — US-CERT / CISA recommendations
- LGPD Art. 46 (Segurança dos Dados)
- LGPD Art. 47 (Incidentes de Segurança)
- PostgreSQL 16 — Backup and Restore
- Backblaze B2 — Object Lock documentation
- rclone documentation — multi-destination backups
- GFS Rotation Scheme — 40+ years of proven practice

---

**Este PRD é executável imediatamente. Não depende do PRD-005 (migração HostGator) e deve ser priorizado independentemente.**
