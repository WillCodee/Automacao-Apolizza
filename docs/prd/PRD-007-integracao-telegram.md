# PRD-007 — Integração Telegram Bot (Apolizza CRM)

> **Status:** Implementado
> **Data:** 2026-04-17
> **Autor:** Atlas (@analyst) + Aria (@architect)
> **Bot:** @auditor_crm_bot ("Apolizza CRM")
> **Grupo:** CRM APOLIZZA (ID: -1003995781173)

---

## 1. Objetivo

Integrar o Apolizza CRM ao Telegram para que a equipe receba alertas automáticos e consulte dados do CRM diretamente no grupo, sem precisar abrir o sistema.

---

## 2. Escopo

### 2.1 Incluído

- Bot Telegram com 7 comandos de consulta
- Alertas automáticos de manhã (08h) e tarde (15h)
- Notificação de novos pedidos de cotação
- Consulta manual de auditoria via Telegram
- Comandos customizáveis via tabela `regras_auditoria`
- Painel de diagnóstico no CRM (admin only)

### 2.2 Fora de escopo

- Inline keyboards (interação por botões)
- Envio de arquivos/documentos pelo bot
- Preferências individuais de notificação (opt-in/opt-out)
- Múltiplos grupos/canais

---

## 3. Arquitetura

### 3.1 Componentes

```
Telegram API
    ↕ (webhook HTTPS)
Vercel Serverless
    ├── /api/telegram/webhook    ← recebe comandos do grupo
    ├── /api/telegram/test       ← teste manual (admin)
    ├── /api/telegram/diagnostico ← health check (admin)
    ├── /api/cron/manha          ← alerta 08h BRT
    ├── /api/cron/tarde          ← alerta 15h BRT
    ├── /api/pedidos             ← notifica novo pedido
    └── /api/auditoria/consultar ← envio manual (admin)
         ↓
    src/lib/telegram.ts          ← biblioteca central (sendTelegram, formatters)
         ↓
    Neon PostgreSQL              ← dados do CRM
```

### 3.2 Fluxo do Webhook

```
Usuário digita /atrasados no grupo
    → Telegram envia POST para /api/telegram/webhook
    → Route identifica comando, consulta banco
    → Formata resposta HTML via fmtAtrasado()
    → Envia resposta via sendTelegram()
    → Mensagem aparece no grupo
```

### 3.3 Fluxo dos Alertas Automáticos

```
Vercel Cron (08h / 15h)
    → Executa /api/cron/manha ou /api/cron/tarde
    → Consulta banco (atrasados, tarefas, tratativas)
    → Formata mensagens via telegram.ts
    → Envia para grupo via sendTelegram()
    → Também envia emails via Resend (quando configurado)
```

---

## 4. Comandos do Bot

| Comando | Descrição | Fonte de dados |
|---------|-----------|----------------|
| `/consulta` | Menu com todos os comandos | Estático + regras_auditoria |
| `/atrasados` | Cotações atrasadas com responsável e data | cotacoes (status=atrasado) |
| `/tarefas` | Tarefas que vencem hoje | tarefas (due_date=today) |
| `/tratativas` | Tratativas agendadas hoje e amanhã | cotacoes (proxima_tratativa) |
| `/pendentes` | Tarefas vencidas não concluídas | tarefas (due_date < today) |
| `/relatorio` | Relatório mensal com ranking | cotacoes + users agregados |
| `/resumo` | Resumo diário consolidado | cotacoes + tarefas agregados |
| Customizados | Definidos na tabela regras_auditoria | Dinâmico |

---

## 5. Alertas Automáticos

| Horário | Cron | Conteúdo Telegram | Conteúdo Email |
|---------|------|-------------------|----------------|
| **08h BRT** | `/api/cron/manha` | Atrasados + Tratativas hoje/amanhã | Vigência 60/30/15d + Tratativas + Tarefas |
| **15h BRT** | `/api/cron/tarde` | Tarefas hoje + Pendentes vencidas | Tarefas atrasadas + Prazo + Resumo diário |

---

## 6. Arquivos do Sistema

| Arquivo | Tipo | Linhas | Descrição |
|---------|------|--------|-----------|
| `src/lib/telegram.ts` | Lib | ~108 | Funções core: send, register, 7 formatters |
| `src/app/api/telegram/webhook/route.ts` | API | ~206 | Handler de comandos (GET/POST) |
| `src/app/api/telegram/test/route.ts` | API | ~31 | Teste + registro webhook (POST, admin) |
| `src/app/api/telegram/diagnostico/route.ts` | API | ~58 | Health check (GET, admin) |
| `src/app/api/cron/manha/route.ts` | Cron | ~308 | Alerta matinal (Telegram + Email) |
| `src/app/api/cron/tarde/route.ts` | Cron | ~223 | Alerta vespertino (Telegram + Email) |
| `src/app/api/cron/atrasados/route.ts` | Cron | ~74 | Marcar atrasados + notificar |
| `src/app/api/cron/auditoria/route.ts` | Cron | ~126 | Auditoria por horário (legado) |
| `src/app/api/pedidos/route.ts` | API | ~158 | Notifica novo pedido no grupo |
| `src/app/api/auditoria/consultar/route.ts` | API | ~161 | Envio manual para Telegram |

---

## 7. Variáveis de Ambiente

| Variável | Onde | Status |
|----------|------|--------|
| `TELEGRAM_BOT_TOKEN` | `.env.local` + Vercel | Configurado (2026-04-17) |
| `TELEGRAM_CHAT_ID` | `.env.local` + Vercel | Configurado (2026-04-17) |
| `NEXT_PUBLIC_APP_URL` | Vercel | Default: `https://apolizza-crm.vercel.app` |

---

## 8. Segurança

| Controle | Status | Detalhe |
|----------|--------|---------|
| Webhook público (Telegram exige) | Implementado | Retorna 200 sempre (evita retry) |
| `/api/telegram/test` protegido | Implementado | getCurrentUser() + admin check |
| `/api/telegram/diagnostico` protegido | Implementado | getCurrentUser() + admin check |
| CHAT_ID mascarado no diagnóstico | Implementado | Mostra "definido", não o valor |
| Cron protegido por CRON_SECRET | Implementado | Bearer token no header |
| Validação de assinatura do webhook | Pendente | Telegram suporta `secret_token` |
| Rate limiting | Pendente | Risco se muitas cotações atrasadas |

---

## 9. Configuração Vercel (vercel.json)

```json
{
  "crons": [
    { "path": "/api/cron/manha", "schedule": "0 11 * * *" },
    { "path": "/api/cron/tarde", "schedule": "0 18 * * *" }
  ]
}
```

Nota: horários em UTC. 11:00 UTC = 08:00 BRT, 18:00 UTC = 15:00 BRT.

---

## 10. Crons não agendados

Os seguintes endpoints existem mas **não estão no vercel.json** (trigger manual ou legado):

- `/api/cron/atrasados` — redundante com `/api/cron/manha`
- `/api/cron/auditoria` — redundante com `manha` + `tarde`
- `/api/cron/tarefas-notificacoes` — apenas email, sem Telegram
- `/api/cron/alertas` — apenas email, sem Telegram

---

## 11. Banco de Dados

### Tabela: regras_auditoria

Permite criar comandos customizados no bot sem alterar código.

```sql
CREATE TABLE regras_auditoria (
  id UUID PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  comando VARCHAR(50) NOT NULL,    -- ex: "/meucomando"
  tipo VARCHAR(50) NOT NULL,       -- atrasados|tarefas_hoje|tratativas|pendentes|relatorio|resumo
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 12. Melhorias Futuras

| Prioridade | Melhoria | Esforço |
|-----------|----------|---------|
| P1 | Validação de assinatura no webhook (`secret_token`) | 1h |
| P1 | Rate limiting nas mensagens (max 20/min) | 2h |
| P2 | Remover crons redundantes (auditoria, atrasados) | 30min |
| P2 | Retry com backoff para falhas de envio | 2h |
| P3 | Inline keyboards para ações rápidas | 4h |
| P3 | Opt-in/opt-out individual por usuário | 4h |
| P3 | Envio de PDFs/relatórios pelo bot | 3h |

---

## 13. Histórico

| Data | Evento |
|------|--------|
| 2026-04-17 | Configuração de env vars (token + chat_id) |
| 2026-04-17 | Deploy com segurança no endpoint de diagnóstico |
| 2026-04-17 | Webhook registrado e testado com sucesso |
| 2026-04-17 | Mensagem de teste enviada ao grupo "CRM APOLIZZA" |
| 2026-04-17 | PRD-007 documentado |
