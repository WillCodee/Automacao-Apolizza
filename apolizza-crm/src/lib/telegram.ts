const BASE_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://apolizza-crm.vercel.app";

export async function sendTelegram(text: string, chatId = CHAT_ID): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function registerWebhook(webhookUrl: string): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(`${BASE_URL}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"] }),
  });
  return res.json();
}

export function linkCotacao(id: string, nome: string) {
  return `[${nome}](${APP_URL}/cotacoes/${id})`;
}

// ─── Formatters ────────────────────────────────────────────────────────────────

export function fmtAtrasado(rows: { id: string; name: string; due_date: string; assignee_name: string | null }[]) {
  if (rows.length === 0) return "✅ Nenhuma cotação atrasada no momento.";
  const lines = rows.map(
    (r) => `• ${linkCotacao(r.id, r.name)}\n  👤 ${r.assignee_name || "Sem responsável"} | 📅 ${fmtDate(r.due_date)}`
  );
  return `🚨 *SEGUROS ATRASADOS (${rows.length})*\n\n${lines.join("\n\n")}`;
}

export function fmtTarefasHoje(rows: { id: string; titulo: string; cotador_name: string }[]) {
  if (rows.length === 0) return "✅ Nenhuma tarefa vence hoje.";
  const lines = rows.map((r) => `• *${r.titulo}*\n  👤 ${r.cotador_name}`);
  return `⏰ *TAREFAS PARA FINALIZAR HOJE (${rows.length})*\n\n${lines.join("\n\n")}\n\n🔗 ${APP_URL}/tarefas`;
}

export function fmtTratativas(rows: { id: string; name: string; proxima_tratativa: string; assignee_name: string | null }[], quando: "hoje" | "amanha") {
  if (rows.length === 0) return null;
  const emoji = quando === "hoje" ? "📞" : "📅";
  const label = quando === "hoje" ? "HOJE" : "AMANHÃ";
  const lines = rows.map(
    (r) => `• ${linkCotacao(r.id, r.name)}\n  👤 ${r.assignee_name || "Sem responsável"} | 📅 ${fmtDate(r.proxima_tratativa)}`
  );
  return `${emoji} *TRATATIVAS DE ${label} (${rows.length})*\n\n${lines.join("\n\n")}`;
}

export function fmtTarefasPendentes(rows: { titulo: string; cotador_name: string; data_vencimento: string | null }[]) {
  if (rows.length === 0) return "✅ Nenhuma tarefa pendente atrasada.";
  const lines = rows.map(
    (r) => `• *${r.titulo}*\n  👤 ${r.cotador_name} | 📅 ${r.data_vencimento ? fmtDate(r.data_vencimento) : "Sem prazo"}`
  );
  return `📋 *TAREFAS NÃO FINALIZADAS (${rows.length})*\n\n${lines.join("\n\n")}\n\n🔗 ${APP_URL}/tarefas`;
}

export function fmtRelatorio(data: {
  totalCotacoes: number; fechadas: number; perdas: number; emAndamento: number;
  totalAReceber: number; ranking: { name: string; fechadas: number; faturamento: number }[];
}) {
  const ano = new Date().getFullYear();
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const top3 = data.ranking.slice(0, 3).map((r, i) => `${i + 1}. *${r.name}* — ${r.fechadas} fechadas / ${brl(r.faturamento)}`).join("\n");
  return (
    `📊 *RELATÓRIO ${ano}*\n\n` +
    `📋 Total: *${data.totalCotacoes}* | ✅ Fechadas: *${data.fechadas}* | ❌ Perdas: *${data.perdas}* | 🔄 Em andamento: *${data.emAndamento}*\n` +
    `💰 Faturamento: *${brl(data.totalAReceber)}*\n\n` +
    `🏆 *Top Cotadores*\n${top3 || "Nenhum dado"}\n\n` +
    `🔗 ${APP_URL}/relatorios`
  );
}

export const MENU_CONSULTA = `🔍 *COMANDOS DISPONÍVEIS — APOLIZZA CRM*

/atrasados — Cotações fora do prazo
/tratativas — Próximas tratativas (hoje e amanhã)
/tarefas — Tarefas para hoje
/pendentes — Tarefas não finalizadas
/relatorio — Relatório do mês atual
/resumo — Resumo geral rápido

📌 Use /consulta para ver esta lista novamente.`;

function fmtDate(v: string) {
  return new Date(v).toLocaleDateString("pt-BR");
}
