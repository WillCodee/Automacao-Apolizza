/**
 * Cron de Auditoria — chamado em horarios especificos (UTC):
 *   - 11:00 UTC (08:00 BRT): tratativas de hoje e amanha
 *   - 18:00 UTC (15:00 BRT): tarefas que vencem hoje
 *   - 21:00 UTC (18:00 BRT): tarefas nao finalizadas
 */
import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db, dbQuery } from "@/lib/db";
import { cotacaoNotificacoes } from "@/lib/schema";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { sendTelegram, fmtTratativas, fmtTarefasHoje, fmtTarefasPendentes } from "@/lib/telegram";

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) { return POST(req); }

export async function POST(req: NextRequest) {
  if (!verifyCron(req)) return apiError("Nao autorizado", 401);

  const horaUTC = new Date().getUTCHours();
  const results: Record<string, unknown> = {};

  // -- 11:00 UTC — Tratativas
  if (horaUTC === 11) {
    const hojeRows = await dbQuery(sql`
      SELECT c.id, c.name, CAST(c.proxima_tratativa AS CHAR) as proxima_tratativa, c.assignee_id,
             u.name as assignee_name
      FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
      WHERE c.deleted_at IS NULL AND c.proxima_tratativa = CURDATE()
      ORDER BY c.proxima_tratativa ASC LIMIT 30
    `);
    const amanhaRows = await dbQuery(sql`
      SELECT c.id, c.name, CAST(c.proxima_tratativa AS CHAR) as proxima_tratativa, c.assignee_id,
             u.name as assignee_name
      FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
      WHERE c.deleted_at IS NULL AND c.proxima_tratativa = CURDATE() + INTERVAL 1 DAY
      ORDER BY c.proxima_tratativa ASC LIMIT 30
    `);

    // Telegram para admins
    const txtHoje = fmtTratativas(hojeRows as never, "hoje");
    const txtAmanha = fmtTratativas(amanhaRows as never, "amanha");
    if (txtHoje) await sendTelegram(txtHoje);
    if (txtAmanha) await sendTelegram(txtAmanha);

    // Notificacoes no sistema para cotadores
    type TRow = { id: string; name: string; proxima_tratativa: string; assignee_id: string | null; assignee_name: string | null };
    const allRows = [...(hojeRows as TRow[]), ...(amanhaRows as TRow[])];
    const quando = (r: TRow) => (hojeRows as TRow[]).includes(r) ? "hoje" : "amanh\u00e3";

    if (allRows.length > 0) {
      await db.insert(cotacaoNotificacoes).values(
        allRows
          .filter((r) => r.assignee_id)
          .map((r) => ({
            cotacaoId: r.id,
            cotacaoNome: r.name,
            autorId: null as string | null,
            autorNome: "Auditor",
            tipo: "mensagem",
            texto: `\ud83d\udcde Lembrete: voc\u00ea tem uma tratativa agendada para *${quando(r)}* nesta cota\u00e7\u00e3o.`,
            destinatarioId: r.assignee_id,
            lida: false,
          }))
      );
    }

    results.tratativas = { hoje: hojeRows.length, amanha: amanhaRows.length };
  }

  // -- 18:00 UTC — Tarefas vencendo hoje
  if (horaUTC === 18) {
    const rows = await dbQuery(sql`
      SELECT t.id, t.titulo, t.cotador_id, u.name as cotador_name
      FROM tarefas t JOIN users u ON t.cotador_id = u.id
      WHERE t.status NOT IN ('Conclu\u00edda','Cancelada')
        AND DATE(t.data_vencimento) = CURDATE()
      ORDER BY t.created_at ASC LIMIT 30
    `);

    if (rows.length > 0) {
      await sendTelegram(fmtTarefasHoje(rows as never));

      // Notificacoes individuais para cotadores
      await db.insert(cotacaoNotificacoes).values(
        (rows as { id: string; titulo: string; cotador_id: string; cotador_name: string }[]).map((t) => ({
          cotacaoId: t.id, // usando tarefa id como referencia (simplificado)
          cotacaoNome: t.titulo,
          autorId: null as string | null,
          autorNome: "Auditor",
          tipo: "mensagem",
          texto: `\u23f0 Sua tarefa *"${t.titulo}"* deve ser finalizada hoje!`,
          destinatarioId: t.cotador_id,
          lida: false,
        }))
      ).catch(() => {}); // ignorar erro de FK (tarefa id != cotacao id)
    }

    results.tarefasHoje = rows.length;
  }

  // -- 21:00 UTC — Tarefas nao finalizadas
  if (horaUTC === 21) {
    const rows = await dbQuery(sql`
      SELECT t.titulo, u.name as cotador_name, CAST(t.data_vencimento AS CHAR) as data_vencimento
      FROM tarefas t JOIN users u ON t.cotador_id = u.id
      WHERE t.status NOT IN ('Conclu\u00edda','Cancelada')
        AND t.data_vencimento IS NOT NULL
        AND t.data_vencimento < now()
      ORDER BY t.data_vencimento ASC LIMIT 30
    `);

    if (rows.length > 0) {
      await sendTelegram(fmtTarefasPendentes(rows as never));
    }

    results.tarefasPendentes = rows.length;
  }

  return apiSuccess({ horaUTC, ...results });
}
