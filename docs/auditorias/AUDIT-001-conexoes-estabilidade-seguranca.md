# AUDIT-001 — Auditoria de Conexoes, Estabilidade e Seguranca

**Data:** 2026-04-20
**Analista:** Atlas (@analyst)
**Escopo:** `apolizza-crm/` — ~65 handlers em ~50 arquivos route.ts
**Total de findings:** 19 (3 Critical, 5 High, 6 Medium, 5 Low)

---

## CRITICAL (3)

### C1. Endpoint `/api/pedido` totalmente aberto — sem autenticacao

**Arquivo:** `src/app/api/pedido/route.ts` (linhas 12-106)

Este endpoint POST aceita dados de qualquer pessoa na internet, cria cotacoes no banco de dados, faz upload de arquivos ao Vercel Blob, e envia mensagens ao Telegram. Nao ha nenhuma verificacao de identidade, CAPTCHA, rate limiting ou validacao de origem.

**Riscos:**
- Spam/abuso: qualquer bot pode criar milhares de cotacoes
- Upload de arquivos maliciosos ao Vercel Blob (linha 27: `access: "public"`)
- Consumo de recursos (banco, Blob storage, Telegram API)
- Dados falsos poluindo o sistema

**Fix recomendado:** Implementar pelo menos: (a) rate limiting por IP, (b) CAPTCHA ou token anti-abuse, (c) validacao de tamanho/tipo de arquivo, (d) Zod schema para input validation.

### C2. Webhook Telegram totalmente aberto — sem verificacao de origem

**Arquivo:** `src/app/api/telegram/webhook/route.ts` (linha 38)

O endpoint POST do webhook nao verifica se a requisicao vem realmente do Telegram. Qualquer pessoa que conheca a URL pode enviar payloads falsos e executar queries no banco de dados.

**Riscos:**
- Execucao de queries arbitrarias (os comandos /atrasados, /relatorio etc. consultam o banco)
- Exfiltracao de dados via resposta do Telegram (nomes de clientes, valores, responsaveis)

**Fix recomendado:** Implementar verificacao do `X-Telegram-Bot-Api-Secret-Token` header (setado via `setWebhook` com `secret_token` param) ou verificar que `chatId` pertence ao grupo autorizado.

### C3. Arquivos enviados ao Vercel Blob com `access: "public"` sem restricao

**Arquivos:**
- `src/app/api/pedido/route.ts` (linha 27)
- `src/app/api/pedidos/route.ts` (linha 33)

Arquivos de pedidos sao armazenados com acesso publico. Combinado com C1, qualquer pessoa pode fazer upload de conteudo arbitrario que fica acessivel publicamente.

**Fix recomendado:** Usar `access: "private"` ou pelo menos validar mime types permitidos e limitar tamanho de arquivo.

---

## HIGH (5)

### H1. Ausencia de middleware.ts — proxy.ts pode nao ser invocado

**Arquivo:** `src/proxy.ts`

O arquivo esta em `src/proxy.ts` ao inves de `src/middleware.ts`. O Next.js so executa automaticamente o middleware se o arquivo se chamar `middleware.ts` na raiz do `src/` ou do projeto. Se `proxy.ts` nao esta sendo reconhecido, NENHUMA rota tem protecao de autenticacao via middleware.

Na documentacao do CLAUDE.md consta: "proxy.ts (NAO middleware.ts) — protege rotas server-side". Isso funciona no Next.js se o build reconhece o export. Porem, pela convencao Next.js, o arquivo DEVE ser `middleware.ts`. E necessario verificar se o deploy na Vercel esta de fato executando este proxy.

**Fix recomendado:** Renomear para `middleware.ts` ou confirmar via logs de producao que o proxy esta ativo.

### H2. Falta de validacao Zod na maioria dos endpoints que recebem dados

A maioria dos endpoints POST/PUT/PATCH NAO usa Zod para validar input. Apenas ~12 handlers usam `safeParse` ou `.parse()`. Os demais aceitam `req.json()` cru.

**Endpoints sem validacao de input (exemplos):**
- `/api/users` POST (linha 46-47): `const { name, email, username, password, role } = body;`
- `/api/metas` POST: aceita body cru
- `/api/comissao-tabela` POST: aceita body cru
- `/api/pedido` POST: aceita body cru
- `/api/status-config/[id]` PUT: aceita body cru
- `/api/situacao-config` POST: aceita body cru
- `/api/situacao-config/[id]` PUT: aceita body cru

**Fix recomendado:** Criar Zod schemas para todos os endpoints que recebem dados.

### H3. Criacao de usuario aceita `role` arbitrario do body

**Arquivo:** `src/app/api/users/route.ts` (linha 75)

```typescript
role: role || "cotador",
```

O campo `role` vem diretamente do request body sem validacao de enum. Um proprietario poderia criar um usuario com role arbitrario.

**Fix recomendado:** Validar `role` contra um set permitido (`["admin", "cotador"]`) e impedir criacao de "proprietario" via API.

### H4. Ausencia de Content-Security-Policy

**Arquivo:** `next.config.ts`

Os security headers incluem X-Frame-Options, HSTS, etc., mas NAO incluem `Content-Security-Policy`. Isso deixa o sistema vulneravel a XSS via injecao de scripts.

**Fix recomendado:** Adicionar header CSP com policy restritiva.

### H5. Nao existe rate limiting em nenhum endpoint

Nenhum endpoint possui rate limiting. Especialmente critico para:
- `/api/auth/[...nextauth]` (brute force de senha)
- `/api/pedido` (spam — ver C1)
- `/api/telegram/webhook` (abuse)

**Fix recomendado:** Implementar rate limiting via middleware (ex: `@upstash/ratelimit` compativel com serverless Vercel).

---

## MEDIUM (6)

### M1. Cron endpoints acessiveis sem camada adicional

Os cron endpoints (`/api/cron/manha`, `/api/cron/tarde`, `/api/cron/atrasados`, `/api/cron/alertas`, `/api/cron/auditoria`) verificam corretamente o `Bearer CRON_SECRET`. Porem, como o proxy.ts exclui `/api/cron/` da autenticacao, qualquer pessoa pode enviar requests. Se o CRON_SECRET for fraco ou leakado, nao ha camada adicional de protecao.

**Fix recomendado:** Considerar adicionar verificacao de IP de origem (Vercel Cron IPs) como camada adicional.

### M2. `requireAuth()` usa `throw new Response()` — pattern fragil

**Arquivo:** `src/lib/auth-helpers.ts` (linhas 37-43)

Fazer `throw` de um `Response` nao e um pattern suportado nativamente pelo Next.js App Router. Na pratica, nenhum endpoint usa `requireAuth()` — todos usam `getCurrentUser()` manualmente, tornando essas funcoes dead code.

**Fix recomendado:** Remover dead code ou refatorar para pattern suportado.

### M3. Consulta por nome para buscar cotacao recem-criada — race condition

**Arquivos:**
- `src/app/api/pedido/route.ts` (linhas 59-61)
- `src/app/api/pedidos/route.ts` (linhas 92-97)

Busca por `name` apos insert sem usar o ID da insercao. Se dois pedidos com mesmo nome chegarem simultaneamente, pode retornar a cotacao errada.

**Fix recomendado:** Usar `LAST_INSERT_ID()` ou gerar UUID client-side antes do insert.

### M4. Error messages expondo detalhes internos

**Arquivos:**
- `src/app/api/pedido/route.ts` (linha 104)
- `src/app/api/pedidos/route.ts` (linha 169)
- `src/app/api/cron/tarefas-notificacoes/route.ts` (linha 164)

`e.message` pode conter detalhes do banco (nome de tabela, coluna, constraint).

**Fix recomendado:** Nunca retornar `error.message` bruto ao cliente. Usar mensagem generica e logar o detalhe no servidor.

### M5. Falta de validacao CSRF explicita

Nao ha protecao CSRF alem do SameSite cookie padrao do Auth.js. Endpoints que aceitam POST sem verificar um token CSRF (como `/api/pedido`) sao vulneraveis.

### M6. Email HTML injection em `/api/pedidos/route.ts`

**Arquivo:** `src/app/api/pedidos/route.ts` (linhas 149-160)

Os campos `nomeCliente`, `contatoCliente`, `descricao` sao inseridos diretamente no HTML do email sem sanitizacao. Isso pode permitir injecao de HTML/JS no email.

**Fix recomendado:** Sanitizar todos os campos antes de inserir no HTML do email.

---

## LOW (5)

### L1. `error: any` sem tipagem

**Arquivo:** `src/app/api/health/route.ts` (linha 86)

Pattern inconsistente — a maioria dos handlers usa `catch (error)` sem tipo.

### L2. `.catch(() => {})` silenciando erros

Varios locais engolem erros silenciosamente:
- `pedido/route.ts` linha 98: `.catch(() => {})`
- `pedidos/route.ts` linha 141: `.catch(() => {})`
- `cron/tarde/route.ts` linha 55: `.catch(() => {})`
- `cron/auditoria/route.ts` linha 103: `.catch(() => {})`

### L3. Pool MySQL com `queueLimit: 0` pode causar starvation

**Arquivo:** `src/lib/db.ts` (linha 18)

Com `connectionLimit: 1` e `queueLimit: 0` (ilimitado), requests concorrentes ficam enfileiradas indefinidamente. Se um query travar, todas as requests subsequentes bloqueiam.

**Fix recomendado:** Definir `queueLimit` finito (ex: 10) para rejeitar requests excedentes com erro.

### L4. Telegram bot token avaliado em module scope

**Arquivo:** `src/app/api/telegram/diagnostico/route.ts` (linha 5)

```typescript
const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
```

Se o env var nao estiver definido, a URL fica com `botundefined`. Nao e leak de seguranca (server-side only), mas e fragil.

### L5. CLAUDE.md diz Neon PostgreSQL mas codigo usa MySQL

A documentacao do CRM (`apolizza-crm/CLAUDE.md`) referencia "Neon PostgreSQL 16" mas o codigo usa `mysql2/promise`, queries MySQL, e o pool config referencia HostGator. Documentacao desatualizada.

---

## Pontos Positivos Identificados

- `getCurrentUser()` usado consistentemente em todos os endpoints autenticados
- Security headers bem configurados no `next.config.ts` (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- Soft delete implementado corretamente com `deleted_at IS NULL` em todas as queries
- Retry com backoff exponencial para erros de conexao MySQL (`dbQuery`)
- Cron endpoints validam CRON_SECRET via Bearer token
- Senhas hasheadas com bcrypt cost 12
- Audit trail field-level (cotacao_history) para mudancas em cotacoes
- Role-based access control funcional (cotador so acessa seus dados)
- Upload com validacao de BLOB_READ_WRITE_TOKEN antes de tentar upload

---

## Resumo

| Severidade | Qtd | IDs |
|-----------|-----|-----|
| CRITICAL | 3 | C1, C2, C3 |
| HIGH | 5 | H1, H2, H3, H4, H5 |
| MEDIUM | 6 | M1, M2, M3, M4, M5, M6 |
| LOW | 5 | L1, L2, L3, L4, L5 |
| **Total** | **19** | |

## Prioridade de Correcao Recomendada

1. **Imediato:** C1 + C2 + C3 (endpoints expostos a internet)
2. **Curto prazo:** H5 (rate limiting) + H2 (Zod validation) + H3 (role enum)
3. **Medio prazo:** H1 (middleware) + H4 (CSP) + M3-M6
4. **Quando possivel:** L1-L5 (cleanup e docs)
