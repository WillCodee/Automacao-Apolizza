import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
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
      const r = await db.execute(sql`
        SELECT c.id, c.name, c.due_date::text, u.name as assignee_name
        FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
        WHERE c.deleted_at IS NULL AND c.status = 'atrasado'
        ORDER BY c.due_date ASC LIMIT 30
      `);
      dados = r.rows;
      texto = fmtAtrasado(r.rows as never);
      break;
    }

    case "tarefas_hoje": {
      const r = await db.execute(sql`
        SELECT t.id, t.titulo, u.name as cotador_name
        FROM tarefas t JOIN users u ON t.cotador_id = u.id
        WHERE t.status NOT IN ('Concluída','Cancelada')
          AND t.data_vencimento::date = CURRENT_DATE
        ORDER BY t.created_at ASC LIMIT 30
      `);
      dados = r.rows;
      texto = fmtTarefasHoje(r.rows as never);
      break;
    }

    case "tratativas": {
      const hoje = await db.execute(sql`
        SELECT c.id, c.name, c.proxima_tratativa::text, u.name as assignee_name
        FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
        WHERE c.deleted_at IS NULL AND c.proxima_tratativa = CURRENT_DATE
        ORDER BY c.proxima_tratativa ASC LIMIT 20
      `);
      const amanha = await db.execute(sql`
        SELECT c.id, c.name, c.proxima_tratativa::text, u.name as assignee_name
        FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
        WHERE c.deleted_at IS NULL AND c.proxima_tratativa = CURRENT_DATE + INTERVAL '1 day'
        ORDER BY c.proxima_tratativa ASC LIMIT 20
      `);
      dados = { hoje: hoje.rows, amanha: amanha.rows };
      const h = fmtTratativas(hoje.rows as never, "hoje");
      const a = fmtTratativas(amanha.rows as never, "amanha");
      texto = [h, a].filter(Boolean).join("\n\n") || "✅ Nenhuma tratativa para hoje ou amanhã.";
      break;
    }

    case "pendentes": {
      const r = await db.execute(sql`
        SELECT t.titulo, u.name as cotador_name, t.data_vencimento::text
        FROM tarefas t JOIN users u ON t.cotador_id = u.id
        WHERE t.status NOT IN ('Concluída','Cancelada')
          AND (t.data_vencimento IS NULL OR t.data_vencimento < now())
        ORDER BY t.data_vencimento ASC NULLS LAST LIMIT 30
      `);
      dados = r.rows;
      texto = fmtTarefasPendentes(r.rows as never);
      break;
    }

    case "relatorio": {
      const ano = new Date().getFullYear();
      const [kpi] = await db.execute(sql`
        SELECT count(*)::int as "totalCotacoes",
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
      dados = { kpi, ranking };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      texto = fmtRelatorio({ ...(kpi as any), ranking: ranking as never });
      break;
    }

    case "resumo": {
      const [counts] = await db.execute(sql`
        SELECT
          sum(case when status='atrasado' then 1 else 0 end)::int as atrasadas,
          sum(case when proxima_tratativa = CURRENT_DATE then 1 else 0 end)::int as tratativas_hoje,
          sum(case when proxima_tratativa = CURRENT_DATE + interval '1 day' then 1 else 0 end)::int as tratativas_amanha
        FROM cotacoes WHERE deleted_at IS NULL
      `).then((r) => r.rows) as [Record<string, number>];
      const [tarefas] = await db.execute(sql`
        SELECT
          sum(case when status not in ('Concluída','Cancelada') and data_vencimento::date = CURRENT_DATE then 1 else 0 end)::int as hoje,
          sum(case when status not in ('Concluída','Cancelada') and (data_vencimento is null or data_vencimento < now()) then 1 else 0 end)::int as pendentes
        FROM tarefas
      `).then((r) => r.rows) as [Record<string, number>];
      dados = { counts, tarefas };
      texto = (
        `📊 *RESUMO DO DIA — ${new Date().toLocaleDateString("pt-BR")}*\n\n` +
        `🚨 Cotações atrasadas: *${counts?.atrasadas ?? 0}*\n` +
        `📞 Tratativas hoje: *${counts?.tratativas_hoje ?? 0}*\n` +
        `📅 Tratativas amanhã: *${counts?.tratativas_amanha ?? 0}*\n` +
        `⏰ Tarefas para hoje: *${tarefas?.hoje ?? 0}*\n` +
        `📋 Tarefas pendentes: *${tarefas?.pendentes ?? 0}*`
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
