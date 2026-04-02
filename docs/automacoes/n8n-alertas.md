# N8N Workflows de Alertas — Apolizza

## Visao Geral

4 workflows de alerta automatico configurados no N8N Cloud, todos integrados com a API do ClickUp.

## Workflows

### 1. Alerta Prazo Diario 15h/16h
- **ID:** Gw3K4NdIM8wMytDj
- **URL:** https://jgsancho.app.n8n.cloud/workflow/Gw3K4NdIM8wMytDj
- **Schedule:** Seg-Sex as 15h e 16h (BRT)
- **Funcao:** Lista tasks com `due_date` = hoje e status != "fechado"
- **Mensagem:** Inclui nome, status, responsavel e link do ClickUp

### 2. Alerta Fim de Vigencia
- **ID:** myYymlD2xCWkf5pH
- **URL:** https://jgsancho.app.n8n.cloud/workflow/myYymlD2xCWkf5pH
- **Schedule:** Seg-Sex as 08h (BRT)
- **Funcao:** Verifica o campo custom "Fim Vigencia" (UUID: 640d44b3-818e-4957-ac1b-2426d2e59e5d)
- **Categorias:** Vigencia vencida, vence hoje, vence em ate 7 dias

### 3. Alerta Proxima Tratativa
- **ID:** s4q2JDoYEIw6Us28
- **URL:** https://jgsancho.app.n8n.cloud/workflow/s4q2JDoYEIw6Us28
- **Schedule:** Seg-Sex as 08h (BRT)
- **Funcao:** Verifica o campo custom "Proxima Tratativa" (UUID: f3e53744-f27d-4e6e-acae-ee69b25daed8)
- **Alerta:** Clientes que devem ser contatados hoje

### 4. Alerta Seguro Fora do Prazo
- **ID:** oK7B5isTcQIyO2tL
- **URL:** https://jgsancho.app.n8n.cloud/workflow/oK7B5isTcQIyO2tL
- **Schedule:** A cada 2 horas
- **Funcao:** Detecta tasks com `due_date` ultrapassada e status != fechado/perda
- **Urgencia:** Indicadores por cor (vermelho >7 dias, amarelo >3 dias, verde ate 3 dias)

## Setup Necessario

### 1. Configurar Credencial Header Auth
Em cada workflow, nos nodes "HTTP Request":
1. Clicar no node → Credential → Create New
2. Tipo: **Header Auth**
3. Name: `Authorization`
4. Value: token da API do ClickUp (ex: `pk_XXXXXXX`)

### 2. Adicionar Node de Notificacao
Cada workflow termina com um node "Formatar Alerta" que gera a mensagem pronta.
Adicionar node de envio apos ele, conforme canal escolhido:

| Canal | Node N8N | Requisitos |
|-------|----------|------------|
| Telegram | Telegram | Bot Token + Chat ID |
| WhatsApp | WhatsApp Business | WhatsApp Business API |
| Email | Send Email / Gmail | SMTP ou OAuth Gmail |
| Slack | Slack | Slack Bot Token + Channel |

### 3. Ativar Workflows
Apos configurar credenciais e canal de notificacao, ativar cada workflow pelo toggle no N8N.

## Custom Fields Utilizados

| Campo | UUID | Usado em |
|-------|------|----------|
| Fim Vigencia | 640d44b3-818e-4957-ac1b-2426d2e59e5d | Alerta Fim de Vigencia |
| Proxima Tratativa | f3e53744-f27d-4e6e-acae-ee69b25daed8 | Alerta Proxima Tratativa |

## Lista ClickUp
- **Lista Cotacoes:** 900701916229
