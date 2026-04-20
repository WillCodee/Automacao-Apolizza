import { NextRequest } from "next/server";
import { sql, eq } from "drizzle-orm";
import { db, dbQuery } from "@/lib/db";
import { regrasAuditoria } from "@/lib/schema";
import {
  sendTelegram, fmtAtrasado, fmtTarefasHoje, fmtTratativas,
  fmtTarefasPendentes, fmtRelatorio, MENU_CONSULTA,
} from "@/lib/telegram";

async function buildMenuConsulta(): Promise<string> {
  const regras = await db
    .select()
    .from(regrasAuditoria)
    .where(eq(regrasAuditoria.ativo, true))
    .orderBy(regrasAuditoria.createdAt);

  let extra = "";
  if (regras.length > 0) {
    extra = "\n\n\ud83d\udccc <b>REGRAS CUSTOMIZADAS</b>\n" +
      regras.map((r) => `${r.comando} \u2014 ${r.descricao || r.nome}`).join("\n");
  }
  return MENU_CONSULTA + extra;
}

async function runTipoQuery(tipo: string): Promise<string> {
  switch (tipo) {
    case "atrasados":   return getAtrasados();
    case "tarefas_hoje": return getTarefasHoje();
    case "tratativas":  return getTratativas();
    case "pendentes":   return getTarefasPendentes();
    case "relatorio":   return getRelatorio();
    case "resumo":      return getResumo();
    default:            return "\u2753 Tipo de consulta desconhecido.";
  }
}

// Telegram envia POST para este endpoint quando ha mensagem no grupo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Suporta grupos (message) e canais/supergrupos (channel_post)
    const message = body?.message || body?.channel_post;
    if (!message) return new Response("ok");

    const chatId = String(message.chat?.id);
    const text: string = message.text || "";
    const cmd = text.split(" ")[0].toLowerCase().replace(/@\w+$/, "");

    switch (cmd) {
      case "/consulta":
      case "/start":
        await sendTelegram(await buildMenuConsulta(), chatId);
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
          // Verifica se e uma regra customizada
          const regras = await db
            .select()
            .from(regrasAuditoria)
            .where(eq(regrasAuditoria.ativo, true));
          const regra = regras.find((r) => r.comando.toLowerCase() === cmd);
          if (regra) {
            await sendTelegram(await runTipoQuery(regra.tipo), chatId);
          } else {
            await sendTelegram(`\u2753 Comando n\u00e3o reconhecido.\n\nUse /consulta para ver os comandos dispon\u00edveis.`, chatId);
          }
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

// --- Data fetchers ---

async function getAtrasados() {
  const rows = await dbQuery(sql`
    SELECT c.id, c.name, CAST(c.due_date AS CHAR) as due_date, u.name as assignee_name
    FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL AND c.status = 'atrasado'
    ORDER BY c.due_date ASC LIMIT 20
  `);
  return fmtAtrasado(rows as never);
}

async function getTarefasHoje() {
  const rows = await dbQuery(sql`
    SELECT t.id, t.titulo, u.name as cotador_name
    FROM tarefas t JOIN users u ON t.cotador_id = u.id
    WHERE t.status NOT IN ('Conclu\u00edda','Cancelada')
      AND DATE(t.data_vencimento) = CURDATE()
    ORDER BY t.created_at ASC LIMIT 20
  `);
  return fmtTarefasHoje(rows as never);
}

async function getTratativas() {
  const hojeRows = await dbQuery(sql`
    SELECT c.id, c.name, CAST(c.proxima_tratativa AS CHAR) as proxima_tratativa, u.name as assignee_name
    FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL AND c.proxima_tratativa = CURDATE()
    ORDER BY c.proxima_tratativa ASC LIMIT 15
  `);
  const amanhaRows = await dbQuery(sql`
    SELECT c.id, c.name, CAST(c.proxima_tratativa AS CHAR) as proxima_tratativa, u.name as assignee_name
    FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL AND c.proxima_tratativa = CURDATE() + INTERVAL 1 DAY
    ORDER BY c.proxima_tratativa ASC LIMIT 15
  `);
  const h = fmtTratativas(hojeRows as never, "hoje");
  const a = fmtTratativas(amanhaRows as never, "amanha");
  return [h, a].filter(Boolean).join("\n\n") || "\u2705 Nenhuma tratativa para hoje ou amanh\u00e3.";
}

async function getTarefasPendentes() {
  const rows = await dbQuery(sql`
    SELECT t.titulo, u.name as cotador_name, CAST(t.data_vencimento AS CHAR) as data_vencimento
    FROM tarefas t JOIN users u ON t.cotador_id = u.id
    WHERE t.status NOT IN ('Conclu\u00edda','Cancelada')
      AND (t.data_vencimento IS NULL OR t.data_vencimento < NOW())
    ORDER BY t.data_vencimento ASC LIMIT 20
  `);
  return fmtTarefasPendentes(rows as never);
}

async function getRelatorio() {
  const ano = new Date().getFullYear();
  const kpiRows = await dbQuery(sql`
    SELECT
      CAST(count(*) AS SIGNED) as totalCotacoes,
      CAST(sum(case when status='fechado' then 1 else 0 end) AS SIGNED) as fechadas,
      CAST(sum(case when status='perda' then 1 else 0 end) AS SIGNED) as perdas,
      CAST(sum(case when status not in ('fechado','perda','concluido ocultar') then 1 else 0 end) AS SIGNED) as emAndamento,
      coalesce(sum(case when status='fechado' then cast(a_receber as decimal(12,2)) else 0 end),0) as totalAReceber
    FROM cotacoes WHERE deleted_at IS NULL AND ano_referencia=${ano}
  `);
  const kpi = kpiRows[0];
  const rankingRows = await dbQuery(sql`
    SELECT u.name, CAST(count(c.id) AS SIGNED) as fechadas,
      coalesce(sum(case when c.status='fechado' then cast(c.a_receber as decimal(12,2)) else 0 end),0) as faturamento
    FROM cotacoes c JOIN users u ON u.id = c.assignee_id
    WHERE c.deleted_at IS NULL AND c.ano_referencia=${ano}
    GROUP BY u.name ORDER BY faturamento DESC LIMIT 5
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fmtRelatorio({ ...(kpi as any), ranking: rankingRows as never });
}

async function getResumo() {
  const countsRows = await dbQuery(sql`
    SELECT
      CAST(sum(case when status='atrasado' then 1 else 0 end) AS SIGNED) as atrasadas,
      CAST(sum(case when proxima_tratativa = CURDATE() then 1 else 0 end) AS SIGNED) as tratativas_hoje,
      CAST(sum(case when proxima_tratativa = CURDATE() + INTERVAL 1 DAY then 1 else 0 end) AS SIGNED) as tratativas_amanha
    FROM cotacoes WHERE deleted_at IS NULL
  `);
  const counts = countsRows[0] as { atrasadas: number; tratativas_hoje: number; tratativas_amanha: number };

  const tarefasRows = await dbQuery(sql`
    SELECT
      CAST(sum(case when status not in ('Conclu\u00edda','Cancelada') and DATE(data_vencimento) = CURDATE() then 1 else 0 end) AS SIGNED) as hoje,
      CAST(sum(case when status not in ('Conclu\u00edda','Cancelada') and (data_vencimento is null or data_vencimento < now()) then 1 else 0 end) AS SIGNED) as pendentes
    FROM tarefas
  `);
  const tarefas = tarefasRows[0] as { hoje: number; pendentes: number };

  return (
    `\ud83d\udcca <b>RESUMO DO DIA \u2014 ${new Date().toLocaleDateString("pt-BR")}</b>\n\n` +
    `\ud83d\udea8 Cota\u00e7\u00f5es atrasadas: <b>${counts?.atrasadas ?? 0}</b>\n` +
    `\ud83d\udcde Tratativas hoje: <b>${counts?.tratativas_hoje ?? 0}</b>\n` +
    `\ud83d\udcc5 Tratativas amanh\u00e3: <b>${counts?.tratativas_amanha ?? 0}</b>\n` +
    `\u23f0 Tarefas para hoje: <b>${tarefas?.hoje ?? 0}</b>\n` +
    `\ud83d\udccb Tarefas pendentes: <b>${tarefas?.pendentes ?? 0}</b>\n\n` +
    `Use /consulta para mais comandos.`
  );
}
