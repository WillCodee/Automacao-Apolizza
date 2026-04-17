const BASE_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://apolizza-crm.vercel.app";

// Escapa caracteres HTML para uso no parse_mode HTML do Telegram
function esc(text: string) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendTelegram(text: string, chatId = CHAT_ID): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("[Telegram] sendMessage falhou:", res.status, err);
    }
    return res.ok;
  } catch (e) {
    console.error("[Telegram] sendMessage exception:", e);
    return false;
  }
}

export async function registerWebhook(webhookUrl: string): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(`${BASE_URL}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "channel_post"] }),
  });
  return res.json();
}

export function linkCotacao(id: string, nome: string) {
  return `<a href="${APP_URL}/cotacoes/${id}">${esc(nome)}</a>`;
}

export function linkTarefa(id: string, titulo: string) {
  return `<a href="${APP_URL}/tarefas/${id}">${esc(titulo)}</a>`;
}

// ─── Formatters (parse_mode: HTML) ───────────────────────────────────────────

export function fmtAtrasado(rows: { id: string; name: string; due_date: string; assignee_name: string | null }[]) {
  if (rows.length === 0) return "✅ Nenhuma cotação atrasada no momento.";
  const lines = rows.map(
    (r) => `• ${linkCotacao(r.id, r.name)}\n  👤 ${esc(r.assignee_name || "Sem responsável")} | 📅 ${fmtDate(r.due_date)}`
  );
  return `🚨 <b>SEGUROS ATRASADOS (${rows.length})</b>\n\n${lines.join("\n\n")}`;
}

export function fmtTarefasHoje(rows: { id: string; titulo: string; cotador_name: string }[]) {
  if (rows.length === 0) return null;
  const lines = rows.map((r) => `• ${linkTarefa(r.id, r.titulo)}\n  👤 ${esc(r.cotador_name)}`);
  return `⏰ <b>TAREFAS PARA FINALIZAR HOJE (${rows.length})</b>\n\n${lines.join("\n\n")}`;
}

export function fmtTratativas(rows: { id: string; name: string; proxima_tratativa: string; assignee_name: string | null }[], quando: "hoje" | "amanha") {
  if (rows.length === 0) return null;
  const emoji = quando === "hoje" ? "📞" : "📅";
  const label = quando === "hoje" ? "HOJE" : "AMANHÃ";
  const lines = rows.map(
    (r) => `• ${linkCotacao(r.id, r.name)}\n  👤 ${esc(r.assignee_name || "Sem responsável")} | 📅 ${fmtDate(r.proxima_tratativa)}`
  );
  return `${emoji} <b>TRATATIVAS DE ${label} (${rows.length})</b>\n\n${lines.join("\n\n")}`;
}

export function fmtTarefasPendentes(rows: { id: string; titulo: string; cotador_name: string; data_vencimento: string | null }[]) {
  if (rows.length === 0) return null;
  const lines = rows.map(
    (r) => `• ${linkTarefa(r.id, r.titulo)}\n  👤 ${esc(r.cotador_name)} | 📅 ${r.data_vencimento ? fmtDate(r.data_vencimento) : "Sem prazo"}`
  );
  return `📋 <b>TAREFAS PENDENTES ATRASADAS (${rows.length})</b>\n\n${lines.join("\n\n")}`;
}

export function fmtVigenciaHoje(rows: { id: string; name: string; seguradora: string | null; assignee_name: string | null }[]) {
  if (rows.length === 0) return null;
  const lines = rows.map(
    (r) => `• ${linkCotacao(r.id, r.name)}\n  🏢 ${esc(r.seguradora || "—")} | 👤 ${esc(r.assignee_name || "Sem responsável")}`
  );
  return `⚠️ <b>SEGUROS VENCENDO HOJE (${rows.length})</b>\n\n${lines.join("\n\n")}`;
}

export function fmtRelatorio(data: {
  totalCotacoes: number; fechadas: number; perdas: number; emAndamento: number;
  totalAReceber: number; ranking: { name: string; fechadas: number; faturamento: number }[];
}) {
  const ano = new Date().getFullYear();
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const top3 = data.ranking.slice(0, 3).map((r, i) => `${i + 1}. <b>${esc(r.name)}</b> — ${r.fechadas} fechadas / ${brl(r.faturamento)}`).join("\n");
  return (
    `📊 <b>RELATÓRIO ${ano}</b>\n\n` +
    `📋 Total: <b>${data.totalCotacoes}</b> | ✅ Fechadas: <b>${data.fechadas}</b> | ❌ Perdas: <b>${data.perdas}</b> | 🔄 Em andamento: <b>${data.emAndamento}</b>\n` +
    `💰 Faturamento: <b>${brl(data.totalAReceber)}</b>\n\n` +
    `🏆 <b>Top Cotadores</b>\n${top3 || "Nenhum dado"}\n\n` +
    `🔗 ${APP_URL}/relatorios`
  );
}

export const MENU_CONSULTA = `🔍 <b>COMANDOS DISPONÍVEIS — APOLIZZA CRM</b>

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
