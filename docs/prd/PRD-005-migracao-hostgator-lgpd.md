# PRD-005: Migração para Servidor Dedicado HostGator (LGPD)

**Versão:** 1.0
**Data:** 2026-04-16
**Status:** Draft — Aguardando validação LGPD
**Autor:** Gustavo + Claude
**Precede:** PRD-004 (Proteção de Dados)

---

## 1. Resumo Executivo

Migração da infraestrutura do Apolizza CRM de **Vercel + Neon PostgreSQL** para **Servidor Dedicado HostGator (Brasil)**, motivada por conformidade LGPD — garantia de que toda a cadeia de processamento de dados pessoais (aplicação + banco) ocorre em território nacional, sob contrato regido pela legislação brasileira.

A migração é **opcional** e deve ser precedida de validação jurídica: se o Neon sa-east-1 (São Paulo) e o Vercel atendem aos requisitos LGPD do negócio, a migração pode ser dispensada em favor de um reforço de backup 3-2-1 sobre a stack atual.

---

## 2. Contexto e Motivação

### 2.1 Situação atual (2026-04-16)

| Componente | Provedor | Região | Status LGPD |
|---|---|---|---|
| Frontend/API | Vercel | Edge global (processamento em região do DB) | Cinza |
| Banco de dados | Neon PostgreSQL | sa-east-1 (São Paulo, BR) | Atende data residency |
| Storage de docs | Vercel Blob | Regiões Vercel | Cinza |
| Email | Resend | EUA | Fora do BR |
| Auth | Auth.js (JWT) | Runtime Vercel | Depende do runtime |

**Volume:** 3.368 cotações, 11 usuários, histórico completo, ~180 MB de dados estruturados.

### 2.2 Por que considerar migração

- **LGPD (Art. 33):** transferência internacional de dados pessoais exige base legal específica. Stack 100% BR elimina essa complexidade.
- **Controle contratual:** contrato HostGator é regido pela lei brasileira, facilita resposta a ANPD.
- **Auditoria:** clientes corporativos ou órgãos públicos podem exigir atestado de infra 100% BR.
- **Custo previsível:** plano fixo mensal vs. cobrança por uso do Vercel/Neon em crescimento.

### 2.3 Por que pode NÃO ser necessário

- Neon sa-east-1 já mantém os dados pessoais no Brasil.
- Vercel processa apenas no runtime; dados ficam no banco (SP).
- LGPD **não proíbe** processamento internacional — exige base legal e transparência, o que Vercel/Neon já oferecem via DPA (Data Processing Agreement).
- Self-hosted transfere toda responsabilidade operacional (patches, uptime, segurança) para a equipe interna.

### 2.4 Decisão bloqueante

**Antes de executar qualquer fase desta migração, é obrigatório:**

1. Consultar advogado/DPO da Apolizza com o cenário atual (Neon SP + Vercel)
2. Validar se contratos de DPA do Vercel/Neon atendem os requisitos
3. Confirmar se há contrato/cliente específico que exige infra 100% BR
4. Documentar a decisão formalmente

**Se a validação jurídica aprovar a stack atual, este PRD é arquivado como "não executado" e implementa-se apenas o PRD-006 (Backup 3-2-1 externo).**

---

## 3. Escopo

### 3.1 Dentro do escopo

- Migração da aplicação Next.js 16 para servidor dedicado HostGator BR
- Migração do banco PostgreSQL (Neon → PostgreSQL self-hosted no dedicado)
- Migração do storage de documentos (Vercel Blob → S3 BR ou filesystem local)
- Configuração de CDN/WAF (Cloudflare)
- Configuração de backup 3-2-1 com destinos em território BR
- Substituição do Resend por provedor de email BR-compliant (opcional — ver 3.3)
- Documentação operacional (runbooks)
- Plano de rollback

### 3.2 Fora do escopo

- Refatoração de código da aplicação (exceto ajustes necessários para a nova infra)
- Migração para outra stack tecnológica (continua Next.js + PostgreSQL)
- Mudanças no schema do banco
- Novas features de produto

### 3.3 Itens a decidir

- **Email:** manter Resend (servidor nos EUA) ou migrar para SendGrid BR / Mailjet / SMTP próprio
- **Storage de docs:** filesystem no dedicado, MinIO self-hosted, ou S3 em provedor BR (ex: Magalu Cloud)
- **PostgreSQL:** manter Neon (apenas migra a aplicação) ou self-hosted no dedicado
- **DNS/CDN:** Cloudflare (EUA mas com PoPs BR) ou Registro.br + Akamai BR
- **Monitoramento:** UptimeRobot, Grafana self-hosted, ou solução BR

---

## 4. Arquitetura Alvo

### 4.1 Diagrama lógico

```
┌──────────────────────────────────────────────────────────────┐
│                          Internet                             │
└─────────────────────────────┬────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│          Cloudflare (DNS + WAF + SSL terminação)             │
│                    (opcional mas recomendado)                 │
└─────────────────────────────┬────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│          Servidor Dedicado HostGator (IP fixo BR)             │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Nginx (reverse proxy, gzip, cache estático)           │  │
│  │  SSL Let's Encrypt (auto-renew)                        │  │
│  │  Rate limiting, fail2ban                               │  │
│  └────────────────────┬───────────────────────────────────┘  │
│                       │                                        │
│                       ▼                                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Next.js 16 via PM2 (cluster mode, 3 workers)          │  │
│  │  Porta interna 3000, auto-restart, log rotation        │  │
│  └────────────────────┬───────────────────────────────────┘  │
│                       │                                        │
│                       ▼                                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL 16 (self-hosted)                           │  │
│  │  pgBouncer (connection pooling, max 100 conns)         │  │
│  │  Porta 5432 apenas localhost                           │  │
│  │  WAL archiving para point-in-time recovery             │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  MinIO (S3-compatible) ou filesystem /var/www/blob     │  │
│  │  Documentos de cotações                                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Backup daemon (cron)                                  │  │
│  │  - pg_dump diário → S3 BR (Magalu Cloud)               │  │
│  │  - pg_basebackup semanal → Backblaze B2                │  │
│  │  - WAL shipping contínuo (PITR)                        │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Especificação mínima do servidor

| Recurso | Mínimo | Recomendado |
|---|---|---|
| CPU | 4 vCores | 8 vCores |
| RAM | 8 GB | 16 GB |
| Disco | 100 GB SSD NVMe | 200 GB SSD NVMe |
| Banda | 1 TB/mês | Ilimitada |
| IP | 1 IPv4 fixo | 1 IPv4 + IPv6 |
| OS | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |
| Backup snapshot | Semanal | Diário |
| SLA | 99.5% | 99.9% |

---

## 5. Fases de Execução

### Fase 0 — Validação LGPD (Pré-requisito)

**Duração estimada:** 1-5 dias (depende de consulta jurídica)

**Entregáveis:**
- Parecer jurídico sobre necessidade real da migração
- Decisão formal: executar PRD-005 ou arquivar em favor de PRD-006
- Documentação do caso de uso LGPD que motiva (se aplicável)

**Critério de saída:** Decisão GO / NO-GO assinada pelo responsável legal.

---

### Fase 1 — Backup Externo Preventivo

**Duração estimada:** 1 dia

**Pré-requisito obrigatório antes de qualquer mudança de infra.**

**Entregáveis:**
- GitHub Actions workflow com cron diário 03:00 BRT
- pg_dump compactado enviado para Backblaze B2 (bucket sa-east-1 se disponível)
- Segundo destino: Google Drive via rclone
- Retenção: 30 dias hot, 12 meses cold
- Script de restore validado em ambiente de staging
- Teste de restore completo documentado

**Critério de saída:** Restore de backup externo reproduzindo 100% das linhas em DB temporário.

---

### Fase 2 — Contratação e Hardening do Servidor

**Duração estimada:** 2-3 dias (depende do provisionamento HostGator)

**Atividades:**
- Contratar plano dedicado HostGator
- Validar acesso root via SSH
- Hardening inicial:
  - Desabilitar login root direto
  - SSH apenas por chave pública (ed25519)
  - UFW firewall: abrir apenas 22, 80, 443
  - fail2ban configurado (SSH, Nginx)
  - Unattended-upgrades ativo (security patches)
  - Timezone `America/Sao_Paulo`
  - Usuário `apolizza` com sudo sem senha (para CI/CD)
- Instalar monitoring básico:
  - Node Exporter (Prometheus)
  - Logrotate configurado
  - Uptime Kuma ou UptimeRobot free

**Entregáveis:**
- Servidor acessível via SSH com chave
- Relatório de hardening (checklist CIS Ubuntu baseline)
- Credenciais armazenadas em 1Password da equipe

**Critério de saída:** `sudo apt upgrade` rodando sem warnings, firewall ativo, fail2ban bloqueando tentativas de brute-force.

---

### Fase 3 — Instalação da Stack Base

**Duração estimada:** 1 dia

**Atividades:**
- Node.js 20 LTS via NodeSource
- PostgreSQL 16 via repo oficial PGDG
- Nginx via repo oficial
- PM2 global
- Certbot (Let's Encrypt)
- pgBouncer
- rclone (para backup)
- Docker + docker-compose (para MinIO, Uptime Kuma, etc — opcional)

**Configurações chave:**

**PostgreSQL (`postgresql.conf`):**
```
listen_addresses = 'localhost'
max_connections = 100
shared_buffers = 4GB         # 25% da RAM
effective_cache_size = 12GB  # 75% da RAM
work_mem = 40MB
maintenance_work_mem = 1GB
wal_level = replica
archive_mode = on
archive_command = 'rclone copy %p backblaze:apolizza-wal/'
```

**pg_hba.conf:**
```
local   all   all                   peer
host    all   all   127.0.0.1/32    scram-sha-256
```

**Entregáveis:**
- `stack-install.sh` (idempotente) versionado no repo
- Credenciais PostgreSQL rotacionadas (não reusar do Neon)
- pgBouncer ouvindo em porta 6432

**Critério de saída:** `psql -h localhost -U apolizza -d apolizza_crm` conecta; `pg_isready` retorna OK.

---

### Fase 4 — Migração de Dados

**Duração estimada:** 1 dia (janela de 2-4h para o corte final)

**Estratégia:** dump-and-load com validação bit-a-bit.

**Passos:**
1. `pg_dump --format=custom --no-owner` do Neon para arquivo local
2. Transferir dump via SCP para servidor dedicado
3. `pg_restore` no PostgreSQL local
4. Recriar as 4 SQL Views (`scripts/create-views.ts`)
5. Validação:
   - Row count por tabela (Neon vs. dedicado)
   - Checksum MD5 das colunas críticas
   - Teste de queries das views
   - Sample manual de 20 cotações aleatórias
6. Ajuste de sequences (`SELECT setval(...)`) para evitar conflito de PK

**Entregáveis:**
- `scripts/migrate-to-dedicated.ts` (reproduzível)
- Relatório de validação (row counts, checksums)
- Backup do dump em 2 locais adicionais

**Critério de saída:** Todas as queries do relatório de validação retornam IDÊNTICO entre Neon e dedicado.

---

### Fase 5 — Deploy da Aplicação

**Duração estimada:** 1 dia

**Atividades:**
- `git clone` do repo no `/var/www/apolizza-crm`
- Criar `.env.production` com:
  - `DATABASE_URL` apontando para PostgreSQL local via pgBouncer
  - `AUTH_URL` apontando para domínio final
  - `AUTH_SECRET` **rotacionado** (não reusar)
  - `BLOB_READ_WRITE_TOKEN` vazio ou MinIO
  - `RESEND_API_KEY` (mantém ou troca em Fase 7)
- `npm ci --production=false && npm run build`
- Configurar PM2 com ecosystem file:

```js
module.exports = {
  apps: [{
    name: 'apolizza-crm',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3000',
    instances: 3,
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    env: { NODE_ENV: 'production' },
    error_file: '/var/log/apolizza/error.log',
    out_file: '/var/log/apolizza/out.log'
  }]
}
```

- `pm2 startup` para auto-start no boot
- `pm2 save` para persistir processos

**Entregáveis:**
- Aplicação rodando em `localhost:3000` no dedicado
- Health check `/api/health` retornando 200 com DB conectado
- Logs estruturados em `/var/log/apolizza/`

**Critério de saída:** Login, listagem de cotações e dashboard funcionais em acesso via SSH tunnel.

---

### Fase 6 — Nginx + SSL + Domínio

**Duração estimada:** 1 dia (pode aguardar propagação DNS)

**Atividades:**
- Configurar domínio (ex: `crm.apolizza.com.br`) apontando para IP HostGator
- Nginx config:

```nginx
server {
    listen 443 ssl http2;
    server_name crm.apolizza.com.br;

    ssl_certificate /etc/letsencrypt/live/crm.apolizza.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.apolizza.com.br/privkey.pem;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name crm.apolizza.com.br;
    return 301 https://$server_name$request_uri;
}
```

- Certbot: `certbot --nginx -d crm.apolizza.com.br`
- Cron de renovação: `0 3 * * * certbot renew --quiet`
- (Opcional) Cloudflare proxy `ON` para WAF e DDoS grátis

**Entregáveis:**
- HTTPS funcional com A+ em ssllabs.com
- HSTS, security headers configurados
- Auto-renew SSL testado

**Critério de saída:** `curl -I https://crm.apolizza.com.br` retorna 200/307 com headers corretos.

---

### Fase 7 — DNS Switch (Cut-over)

**Duração estimada:** 2h de operação + 48h monitoramento

**Estratégia:** cut-over com fallback para Vercel por 7 dias.

**Passos:**
1. Reduzir TTL do DNS atual para 300s (24h antes do cut-over)
2. Freeze de escritas no Vercel (modo read-only por 15min)
3. `pg_dump` incremental final do Neon
4. `pg_restore` das mudanças no dedicado
5. Switch DNS: `crm.apolizza.com.br` → IP HostGator
6. Validação smoke test (login, criar cotação, editar, exportar CSV)
7. Reativar escritas
8. Monitorar por 48h: logs de erro, latência, uptime

**Rollback plan:**
- Se falha crítica em < 2h: reverter DNS para Vercel, replay dos escritos no Neon
- Se falha tardia (> 2h): manter dedicado, fix forward, ou rollback com perda aceitável

**Entregáveis:**
- Runbook de cut-over executado
- Dashboard de monitoramento 48h (requests/min, error rate, p95 latency)
- Relatório pós-migração

**Critério de saída:** 48h sem incidentes P1/P2 + todos os KPIs dentro de SLA definido.

---

### Fase 8 — Desativação Vercel/Neon

**Duração estimada:** 1 semana após cut-over

**Pré-requisitos:**
- 7 dias de operação estável no dedicado
- Backup completo do Neon baixado e arquivado (retenção 12 meses mínimo)
- Confirmação formal do responsável técnico

**Atividades:**
- Cancelar plano Neon (pode exportar final antes)
- Deletar projeto Vercel
- Remover DNS records antigos
- Atualizar documentação (CLAUDE.md, README, runbooks)
- Comunicar equipe

**Entregáveis:**
- Confirmação de cancelamento de ambos os serviços
- Último backup Neon arquivado em cold storage
- Documentação atualizada

---

## 6. Backup e Disaster Recovery (Pós-Migração)

### 6.1 Estratégia 3-2-1 aplicada

| Cópia | Local | Tipo | Retenção |
|---|---|---|---|
| 1 | PostgreSQL local (dedicado) | Primária | N/A |
| 2 | Backblaze B2 (pg_dump diário) | Off-site cloud | 30d hot + 12m cold |
| 3 | S3 BR (Magalu Cloud, semanal) | Off-site cloud BR | 12m |
| 4 (bônus) | HD externo físico (mensal) | Off-line | 24m |

### 6.2 Point-in-Time Recovery (PITR)

- WAL archiving contínuo para Backblaze B2
- Base backup semanal
- Capacidade de restaurar para qualquer segundo dos últimos 30 dias

### 6.3 Testes de restore

- **Automático:** 1x/semana, script restaura último dump em DB temporário e valida row counts
- **Manual:** 1x/mês, restore completo em servidor separado com validação funcional
- **DR drill:** 1x/semestre, simulação de perda total do servidor com cronômetro

### 6.4 RTO e RPO alvo

| Métrica | Alvo |
|---|---|
| RPO (perda máxima de dados) | 5 minutos (via WAL) |
| RTO (tempo máximo de recuperação) | 4 horas |
| Uptime alvo | 99.5% (~43h downtime/ano) |

---

## 7. Segurança

### 7.1 Controles obrigatórios

- SSH apenas via chave pública, root desabilitado
- Firewall UFW com default DENY
- Fail2ban em SSH, Nginx, PostgreSQL
- Unattended-upgrades para patches de segurança
- SSL A+ (HSTS, TLS 1.2+, cipher suite moderna)
- Secrets em `.env.production` com permissão 600, owner `apolizza`
- Rotação de credenciais trimestral
- Logs centralizados em `/var/log/apolizza/` com rotate 90 dias
- Monitoramento de disco (alerta em 80% ocupação)
- Audit log habilitado no PostgreSQL (`pgaudit`)

### 7.2 LGPD — controles específicos

- DPA (contrato) assinado com HostGator
- Lista de subprocessadores documentada
- Política de retenção de logs (dados pessoais em logs não podem exceder necessário)
- Anonimização de dados em ambiente de desenvolvimento
- Procedimento documentado de atendimento a direitos do titular (acesso, exclusão, portabilidade)
- DPO/encarregado designado e comunicado à ANPD

---

## 8. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Falha de hardware HostGator | Baixa | Alto | SLA 99.9% + backup externo + RPO 5min |
| Perda de dados na migração | Baixa | Crítico | Validação row-by-row + manter Neon ativo 7d |
| Downtime prolongado | Média | Alto | Cut-over em janela noturna + rollback plan |
| Ataque DDoS | Média | Alto | Cloudflare WAF free tier |
| Vulnerabilidade não patcheada | Média | Alto | Unattended-upgrades + monitoring CVE |
| Equipe sobrecarregada com ops | Alta | Médio | Runbooks detalhados + automação via Ansible |
| Custo operacional maior que previsto | Média | Médio | Revisão orçamentária trimestral |
| LGPD — vazamento de dados | Baixa | Crítico | Criptografia em repouso + audit log + DPO |

---

## 9. Custos Estimados

### 9.1 Vercel + Neon (atual)

| Item | Custo mensal |
|---|---|
| Vercel Hobby (atual) | R$ 0 |
| Vercel Pro (quando escalar) | US$ 20 ≈ R$ 120 |
| Neon Free (atual) | R$ 0 |
| Neon Pro (quando necessário) | US$ 19 ≈ R$ 115 |
| **Total atual** | **R$ 0** |
| **Total pós-escala** | **R$ 235** |

### 9.2 HostGator Dedicado (alvo)

| Item | Custo mensal |
|---|---|
| Servidor Dedicado HostGator (mínimo) | R$ 500-800 |
| Backup Backblaze B2 (10 GB) | R$ 3 |
| Backup Magalu Cloud (10 GB) | R$ 5 |
| Cloudflare Free | R$ 0 |
| Domínio `.com.br` | R$ 40/ano ≈ R$ 3,33/mês |
| Monitoramento UptimeRobot Free | R$ 0 |
| **Total migração** | **R$ 511-811/mês** |

**Investimento inicial único (trabalho de migração):** não quantificado em reais — estimar horas da equipe.

### 9.3 Break-even

- Migração só se paga se Vercel+Neon passar de R$ 500/mês
- Isso ocorre quando: Vercel Pro (R$ 120) + Neon Pro (R$ 115) + Blob excedente + consumo acima do Hobby
- **Estimativa:** break-even apenas em cenários de escala significativa (50+ usuários ativos diários, 10k+ cotações/mês)

**Conclusão:** a migração por LGPD é legítima; a migração por economia não se paga no volume atual.

---

## 10. Critérios de Sucesso

- [ ] Parecer jurídico arquivado (Fase 0)
- [ ] Backup 3-2-1 operacional antes da migração (Fase 1)
- [ ] Servidor dedicado com hardening validado (Fase 2)
- [ ] PostgreSQL local com dados migrados e validados (Fase 4)
- [ ] Aplicação em HTTPS no domínio final (Fase 6)
- [ ] 48h sem incidentes após cut-over (Fase 7)
- [ ] Vercel e Neon desativados (Fase 8)
- [ ] Runbooks documentados e testados
- [ ] DR drill bem-sucedido com RTO < 4h
- [ ] Custos mensais dentro do orçado

---

## 11. Dependências

### 11.1 Externas

- Contratação formal do servidor dedicado HostGator
- Consulta jurídica (advogado/DPO)
- Aquisição/transferência de domínio `.com.br`
- Conta em provedor de backup (Backblaze B2 ou Magalu Cloud)

### 11.2 Internas

- Aprovação orçamentária (~R$ 500-800/mês recorrente)
- Disponibilidade do time técnico para executar as fases
- Janela de manutenção aprovada para cut-over (Fase 7)
- Comunicação prévia aos usuários do CRM

---

## 12. Alternativas Consideradas

### 12.1 Manter Vercel + Neon + Reforçar backup

**Prós:** Zero trabalho operacional, custo atual R$ 0, Neon já em SP (atende LGPD para maioria dos casos).
**Contras:** Não atende se cliente exigir infra 100% BR contratualmente.
**Recomendação:** Default se validação LGPD (Fase 0) não identificar bloqueio real.

### 12.2 Railway / Render com região BR

**Prós:** Self-service, deploy git-based, gerenciado.
**Contras:** Nenhum oferece região BR nativa em 2026 (apenas EUA/Europa). Não resolve o motivador LGPD.
**Recomendação:** Descartado.

### 12.3 AWS São Paulo (EC2 + RDS)

**Prós:** Infra robusta, região BR nativa, certificações SOC/ISO.
**Contras:** Complexidade operacional alta, custo superior a HostGator dedicado (RDS db.t3.medium ~US$ 80 + EC2 t3.medium ~US$ 30 + tráfego).
**Recomendação:** Considerar se escala justificar (100+ usuários ativos).

### 12.4 VPS HostGator (em vez de dedicado)

**Prós:** Mais barato (R$ 80-200/mês), mesma região BR.
**Contras:** Recursos compartilhados, SLA menor, performance imprevisível em picos.
**Recomendação:** Opção intermediária se volume atual não justificar dedicado.

---

## 13. Cronograma Resumido

| Fase | Duração | Dependência |
|---|---|---|
| 0. Validação LGPD | 1-5 dias | — |
| 1. Backup 3-2-1 | 1 dia | Fase 0 GO |
| 2. Hardening servidor | 2-3 dias | Contratação |
| 3. Stack base | 1 dia | Fase 2 |
| 4. Migração de dados | 1 dia | Fase 3 |
| 5. Deploy app | 1 dia | Fase 4 |
| 6. DNS + SSL | 1 dia | Fase 5 + domínio |
| 7. Cut-over | 2h + 48h monitor | Fase 6 |
| 8. Desativação | 7 dias após cut-over | Fase 7 estável |

**Duração total estimada (execução sequencial):** 2-3 semanas de trabalho efetivo, distribuídas ao longo de 4-6 semanas calendário (respeitando janelas de manutenção e validações).

---

## 14. Decisões em Aberto

- [ ] LGPD realmente exige infra 100% BR para o caso Apolizza? (Fase 0)
- [ ] Plano HostGator específico (modelo, CPU, RAM, SSD)
- [ ] Domínio final (`crm.apolizza.com.br` ou outro)
- [ ] Manter Neon ou migrar PostgreSQL também?
- [ ] Substituir Resend (EUA) por provedor BR?
- [ ] Storage de documentos: filesystem, MinIO ou S3 BR?
- [ ] Cloudflare (EUA com PoPs BR) ou CDN 100% BR?
- [ ] DPA (contrato de tratamento de dados) com HostGator — já assinado?

---

## 15. Referências

- LGPD — Lei 13.709/2018
- ANPD — Guia Orientativo para Definições dos Agentes de Tratamento de Dados
- Neon Data Residency — https://neon.tech/docs/introduction/regions
- Vercel Data Processing Agreement — https://vercel.com/legal/dpa
- CIS Ubuntu 24.04 Benchmark
- PostgreSQL 16 documentation — Continuous Archiving and PITR

---

**Documento sujeito a revisão após Fase 0 (validação LGPD).**
