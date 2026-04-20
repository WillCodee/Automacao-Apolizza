import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { dbQuery } from "@/lib/db";
import { getCurrentUser, isAdminOrProprietario } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import {
  sendTelegram, fmtAtrasado, fmtTarefasHoje,
  fmtTratativas, fmtTarefasPendentes, fmtRelatorio, MENU_CONSULTA,
} from "@/lib/telegram";
import { sendAlertEmail } from "@/lib/email";

type Tipo = "atrasados" | "tarefas_hoje" | "tratativas" | "pendentes" | "relatorio" | "resumo" | "consulta";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("Nao autenticado", 401);
  if (!isAdminOrProprietario(user.role)) return apiError("Acesso negado", 403);

  const { tipo, enviar_telegram, email }: { tipo: Tipo; enviar_telegram?: boolean; email?: string } = await req.json();

  let texto = "";
  let dados: unknown = null;

  switch (tipo) {
    case "consulta":
      texto = MENU_CONSULTA;
      break;

    case "atrasados": {
      const rows = await dbQuery(sql`
        SELECT c.id, c.name, CAST(c.due_date AS CHAR) as due_date, u.name as assignee_name
        FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
        WHERE c.deleted_at IS NULL AND c.status = 'atrasado'
        ORDER BY c.due_date ASC LIMIT 30
      `);
      dados = rows;
      texto = fmtAtrasado(rows as never);
      break;
    }

    case "tarefas_hoje": {
      const rows = await dbQuery(sql`
        SELECT t.id, t.titulo, u.name as cotador_name
        FROM tarefas t JOIN users u ON t.cotador_id = u.id
        WHERE t.status NOT IN ('Conclu\u00edda','Cancelada')
          AND DATE(t.data_vencimento) = CURDATE()
        ORDER BY t.created_at ASC LIMIT 30
      `);
      dados = rows;
      texto = fmtTarefasHoje(rows as never);
      break;
    }

    case "tratativas": {
      const hojeRows = await dbQuery(sql`
        SELECT c.id, c.name, CAST(c.proxima_tratativa AS CHAR) as proxima_tratativa, u.name as assignee_name
        FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
        WHERE c.deleted_at IS NULL AND c.proxima_tratativa = CURDATE()
        ORDER BY c.proxima_tratativa ASC LIMIT 20
      `);
      const amanhaRows = await dbQuery(sql`
        SELECT c.id, c.name, CAST(c.proxima_tratativa AS CHAR) as proxima_tratativa, u.name as assignee_name
        FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
        WHERE c.deleted_at IS NULL AND c.proxima_tratativa = CURDATE() + INTERVAL 1 DAY
        ORDER BY c.proxima_tratativa ASC LIMIT 20
      `);
      dados = { hoje: hojeRows, amanha: amanhaRows };
      const h = fmtTratativas(hojeRows as never, "hoje");
      const a = fmtTratativas(amanhaRows as never, "amanha");
      texto = [h, a].filter(Boolean).join("\n\n") || "\u2705 Nenhuma tratativa para hoje ou amanh\u00e3.";
      break;
    }

    case "pendentes": {
      const rows = await dbQuery(sql`
        SELECT t.titulo, u.name as cotador_name, CAST(t.data_vencimento AS CHAR) as data_vencimento
        FROM tarefas t JOIN users u ON t.cotador_id = u.id
        WHERE t.status NOT IN ('Conclu\u00edda','Cancelada')
          AND (t.data_vencimento IS NULL OR t.data_vencimento < now())
        ORDER BY t.data_vencimento ASC LIMIT 30
      `);
      dados = rows;
      texto = fmtTarefasPendentes(rows as never);
      break;
    }

    case "relatorio": {
      const ano = new Date().getFullYear();
      const kpiRows = await dbQuery(sql`
        SELECT CAST(count(*) AS SIGNED) as totalCotacoes,
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
      dados = { kpi, ranking: rankingRows };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      texto = fmtRelatorio({ ...(kpi as any), ranking: rankingRows as never });
      break;
    }

    case "resumo": {
      const countsRows = await dbQuery(sql`
        SELECT
          CAST(sum(case when status='atrasado' then 1 else 0 end) AS SIGNED) as atrasadas,
          CAST(sum(case when proxima_tratativa = CURDATE() then 1 else 0 end) AS SIGNED) as tratativas_hoje,
          CAST(sum(case when proxima_tratativa = CURDATE() + INTERVAL 1 DAY then 1 else 0 end) AS SIGNED) as tratativas_amanha
        FROM cotacoes WHERE deleted_at IS NULL
      `);
      const counts = countsRows[0] as Record<string, number>;
      const tarefasRows = await dbQuery(sql`
        SELECT
          CAST(sum(case when status not in ('Conclu\u00edda','Cancelada') and DATE(data_vencimento) = CURDATE() then 1 else 0 end) AS SIGNED) as hoje,
          CAST(sum(case when status not in ('Conclu\u00edda','Cancelada') and (data_vencimento is null or data_vencimento < now()) then 1 else 0 end) AS SIGNED) as pendentes
        FROM tarefas
      `);
      const tarefas = tarefasRows[0] as Record<string, number>;
      dados = { counts, tarefas };
      texto = (
        `\ud83d\udcca *RESUMO DO DIA \u2014 ${new Date().toLocaleDateString("pt-BR")}*\n\n` +
        `\ud83d\udea8 Cota\u00e7\u00f5es atrasadas: *${counts?.atrasadas ?? 0}*\n` +
        `\ud83d\udcde Tratativas hoje: *${counts?.tratativas_hoje ?? 0}*\n` +
        `\ud83d\udcc5 Tratativas amanh\u00e3: *${counts?.tratativas_amanha ?? 0}*\n` +
        `\u23f0 Tarefas para hoje: *${tarefas?.hoje ?? 0}*\n` +
        `\ud83d\udccb Tarefas pendentes: *${tarefas?.pendentes ?? 0}*`
      );
      break;
    }

    default:
      return apiError("Tipo invalido", 400);
  }

  // Sempre envia para o Telegram quando solicitado
  let telegramOk: boolean | null = null;
  if (enviar_telegram) {
    telegramOk = await sendTelegram(texto);
  }

  // Envia por email se fornecido
  let emailOk: boolean | null = null;
  if (email && email.includes("@")) {
    try {
      const subject = `[Apolizza] Consulta: ${tipo}`;
      const htmlBody = `<pre style="font-family:monospace;font-size:13px;line-height:1.6">${texto.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre><br><a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/dashboard">Ver Dashboard</a>`;
      const result = await sendAlertEmail({ to: email, subject, html: htmlBody });
      emailOk = result.success;
    } catch {
      emailOk = false;
    }
  }

  return apiSuccess({ texto, dados, telegramOk, emailOk });
}
