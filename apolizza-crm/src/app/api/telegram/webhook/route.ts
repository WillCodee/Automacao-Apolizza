import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  sendTelegram, fmtAtrasado, fmtTarefasHoje, fmtTratativas,
  fmtTarefasPendentes, fmtRelatorio, MENU_CONSULTA,
} from "@/lib/telegram";

// Telegram envia POST para este endpoint quando há mensagem no grupo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body?.message;
    if (!message) return new Response("ok");

    const chatId = String(message.chat?.id);
    const text: string = message.text || "";
    const cmd = text.split(" ")[0].toLowerCase().replace(/@\w+$/, "");

    switch (cmd) {
      case "/consulta":
      case "/start":
        await sendTelegram(MENU_CONSULTA, chatId);
        break;

      case "/atrasados":
        await sendTelegram(await getAtrasados(), chatId);
        break;

      case "/tarefas":
        await sendTelegram(await getTarefasHoje(), chatId);
        break;

      case "/tratativas":
        await sendTelegram(await getTratativas(), chatId);
        break;

      case "/pendentes":
        await sendTelegram(await getTarefasPendentes(), chatId);
        break;

      case "/relatorio":
        await sendTelegram(await getRelatorio(), chatId);
        break;

      case "/resumo":
        await sendTelegram(await getResumo(), chatId);
        break;

      default:
        if (cmd.startsWith("/")) {
          await sendTelegram(`❓ Comando não reconhecido.\n\nUse /consulta para ver os comandos disponíveis.`, chatId);
        }
    }

    return new Response("ok");
  } catch (e) {
    console.error("Telegram webhook error:", e);
    return new Response("ok"); // sempre 200 para Telegram
  }
}

export async function GET() {
  return new Response("Telegram webhook ativo");
}

// ─── Data fetchers ─────────────────────────────────────────────────────────────

async function getAtrasados() {
  const r = await db.execute(sql`
    SELECT c.id, c.name, c.due_date::text, u.name as assignee_name
    FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL AND c.status = 'atrasado'
    ORDER BY c.due_date ASC LIMIT 20
  `);
  return fmtAtrasado(r.rows as never);
}

async function getTarefasHoje() {
  const r = await db.execute(sql`
    SELECT t.id, t.titulo, u.name as cotador_name
    FROM tarefas t JOIN users u ON t.cotador_id = u.id
    WHERE t.status NOT IN ('Concluída','Cancelada')
      AND t.data_vencimento::date = CURRENT_DATE
    ORDER BY t.created_at ASC LIMIT 20
  `);
  return fmtTarefasHoje(r.rows as never);
}

async function getTratativas() {
  const hoje = await db.execute(sql`
    SELECT c.id, c.name, c.proxima_tratativa::text, u.name as assignee_name
    FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL AND c.proxima_tratativa = CURRENT_DATE
    ORDER BY c.proxima_tratativa ASC LIMIT 15
  `);
  const amanha = await db.execute(sql`
    SELECT c.id, c.name, c.proxima_tratativa::text, u.name as assignee_name
    FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL AND c.proxima_tratativa = CURRENT_DATE + INTERVAL '1 day'
    ORDER BY c.proxima_tratativa ASC LIMIT 15
  `);
  const h = fmtTratativas(hoje.rows as never, "hoje");
  const a = fmtTratativas(amanha.rows as never, "amanha");
  return [h, a].filter(Boolean).join("\n\n") || "✅ Nenhuma tratativa para hoje ou amanhã.";
}

async function getTarefasPendentes() {
  const r = await db.execute(sql`
    SELECT t.titulo, u.name as cotador_name, t.data_vencimento::text
    FROM tarefas t JOIN users u ON t.cotador_id = u.id
    WHERE t.status NOT IN ('Concluída','Cancelada')
      AND (t.data_vencimento IS NULL OR t.data_vencimento < now())
    ORDER BY t.data_vencimento ASC NULLS LAST LIMIT 20
  `);
  return fmtTarefasPendentes(r.rows as never);
}

async function getRelatorio() {
  const ano = new Date().getFullYear();
  const [kpi] = await db.execute(sql`
    SELECT
      count(*)::int as "totalCotacoes",
      sum(case when status='fechado' then 1 else 0 end)::int as "fechadas",
      sum(case when status='perda' then 1 else 0 end)::int as "perdas",
      sum(case when status not in ('fechado','perda','concluido ocultar') then 1 else 0 end)::int as "emAndamento",
      coalesce(sum(case when status='fechado' then cast(a_receber as float) else 0 end),0)::float as "totalAReceber"
    FROM cotacoes WHERE deleted_at IS NULL AND ano_referencia=${ano}
  `).then((r) => r.rows);
  const ranking = await db.execute(sql`
    SELECT u.name, count(c.id)::int as "fechadas",
      coalesce(sum(case when c.status='fechado' then cast(c.a_receber as float) else 0 end),0)::float as "faturamento"
    FROM cotacoes c JOIN users u ON u.id = c.assignee_id
    WHERE c.deleted_at IS NULL AND c.ano_referencia=${ano}
    GROUP BY u.name ORDER BY faturamento DESC LIMIT 5
  `).then((r) => r.rows);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fmtRelatorio({ ...(kpi as any), ranking: ranking as never });
}

async function getResumo() {
  const [counts] = await db.execute(sql`
    SELECT
      sum(case when status='atrasado' then 1 else 0 end)::int as atrasadas,
      sum(case when proxima_tratativa = CURRENT_DATE then 1 else 0 end)::int as tratativas_hoje,
      sum(case when proxima_tratativa = CURRENT_DATE + interval '1 day' then 1 else 0 end)::int as tratativas_amanha
    FROM cotacoes WHERE deleted_at IS NULL
  `).then((r) => r.rows) as [{ atrasadas: number; tratativas_hoje: number; tratativas_amanha: number }];

  const [tarefas] = await db.execute(sql`
    SELECT
      sum(case when status not in ('Concluída','Cancelada') and data_vencimento::date = CURRENT_DATE then 1 else 0 end)::int as hoje,
      sum(case when status not in ('Concluída','Cancelada') and (data_vencimento is null or data_vencimento < now()) then 1 else 0 end)::int as pendentes
    FROM tarefas
  `).then((r) => r.rows) as [{ hoje: number; pendentes: number }];

  return (
    `📊 *RESUMO DO DIA — ${new Date().toLocaleDateString("pt-BR")}*\n\n` +
    `🚨 Cotações atrasadas: *${counts?.atrasadas ?? 0}*\n` +
    `📞 Tratativas hoje: *${counts?.tratativas_hoje ?? 0}*\n` +
    `📅 Tratativas amanhã: *${counts?.tratativas_amanha ?? 0}*\n` +
    `⏰ Tarefas para hoje: *${tarefas?.hoje ?? 0}*\n` +
    `📋 Tarefas pendentes: *${tarefas?.pendentes ?? 0}*\n\n` +
    `Use /consulta para mais comandos.`
  );
}
