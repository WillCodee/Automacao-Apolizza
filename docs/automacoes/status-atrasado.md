# Automacao Status ATRASADO

## Objetivo
Tasks com prazo vencido e status diferente de "fechado", "perda" ou "atrasado" devem ser automaticamente movidas para o status **ATRASADO**.

## Implementacao via N8N (Recomendado)

### Workflow: Apolizza - Auto Status ATRASADO
- **ID:** RrXEErnyVF0ICUsd
- **URL:** https://jgsancho.app.n8n.cloud/workflow/RrXEErnyVF0ICUsd
- **Frequencia:** A cada 1 hora

### Fluxo
1. **Schedule Trigger** — dispara a cada 1h
2. **HTTP Request** — busca tasks abertas da lista de cotacoes (900701916229) via ClickUp API
3. **Code Node** — filtra tasks onde `due_date < agora` e status nao esta em [fechado, perda, atrasado]
4. **IF Node** — verifica se ha tasks para atualizar
5. **HTTP Request (PUT)** — atualiza status para "atrasado" via `PUT /api/v2/task/{id}`

### Setup
1. Abrir o workflow no N8N
2. Em ambos os nodes "HTTP Request", configurar credencial:
   - Tipo: Header Auth
   - Name: `Authorization`
   - Value: `pk_XXXXXXX` (token da API do ClickUp)
3. Ativar o workflow (toggle no canto superior direito)

## Alternativa: Automacao Nativa do ClickUp

### Configuracao
1. Abrir o Space de Cotacoes no ClickUp
2. Ir em **Automations** (icone de raio na barra superior)
3. Criar nova automacao:
   - **Trigger:** "When due date arrives"
   - **Condition:** Status is not "fechado" AND Status is not "perda" AND Status is not "atrasado"
   - **Action:** Change status to "atrasado"
4. Salvar e ativar

### Limitacoes da Automacao Nativa
- Depende do plano do ClickUp (pode nao estar disponivel em todos os planos)
- Menor controle sobre a logica de filtragem
- Nao permite customizacao alem do que o trigger oferece

## Manutencao
- Se novos status forem criados no ClickUp, atualizar a lista de status ignorados no Code Node do N8N
- O workflow nao processa tasks sem `due_date` definida
