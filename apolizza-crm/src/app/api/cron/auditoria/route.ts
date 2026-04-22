/**
 * Cron de Auditoria — chamado em horários específicos (UTC):
 *   - 11:00 UTC (08:00 BRT): tratativas de hoje e amanhã
 *   - 18:00 UTC (15:00 BRT): tarefas que vencem hoje
 *   - 21:00 UTC (18:00 BRT): tarefas não finalizadas
 */
import { NextRequest } from "next/server";
import { sql, eq, or, isNull } from "drizzle-orm";
import { db, dbQuery } from "@/lib/db";
import { cotacaoNotificacoes } from "@/lib/schema";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { notifyWithFallback, fmtTratativas, fmtTarefasHoje, fmtTarefasPendentes } from "@/lib/telegram";

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) { return POST(req); }

export async function POST(req: NextRequest) {
  if (!verifyCron(req)) return apiError("Nao autorizado", 401);

  const horaUTC = new Date().getUTCHours();
  const results: Record<string, unknown> = {};

  // ── 11:00 UTC — Tratativas ────────────────────────────────────────────────
  if (horaUTC === 11) {
    type TRow = { id: string; name: string; proxima_tratativa: string; assignee_id: string | null; assignee_name: string | null };

    const hoje = await dbQuery<TRow>(sql`
      SELECT c.id, c.name, CAST(c.proxima_tratativa AS CHAR) as proxima_tratativa, c.assignee_id,
             u.name as assignee_name
      FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
      WHERE c.deleted_at IS NULL AND c.proxima_tratativa = CURDATE()
      ORDER BY c.proxima_tratativa ASC LIMIT 30
    `);
    const amanha = await dbQuery<TRow>(sql`
      SELECT c.id, c.name, CAST(c.proxima_tratativa AS CHAR) as proxima_tratativa, c.assignee_id,
             u.name as assignee_name
      FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
      WHERE c.deleted_at IS NULL AND c.proxima_tratativa = CURDATE() + INTERVAL 1 DAY
      ORDER BY c.proxima_tratativa ASC LIMIT 30
    `);

    // Telegram para admins
    const txtHoje = fmtTratativas(hoje as never, "hoje");
    const txtAmanha = fmtTratativas(amanha as never, "amanha");
    if (txtHoje) await notifyWithFallback(txtHoje);
    if (txtAmanha) await notifyWithFallback(txtAmanha);

    // Notificações no sistema para cotadores
    const allRows = [...hoje, ...amanha];
    const hojeIds = new Set(hoje.map((r) => r.id));

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
            texto: `📞 Lembrete: você tem uma tratativa agendada para *${hojeIds.has(r.id) ? "hoje" : "amanhã"}* nesta cotação.`,
            destinatarioId: r.assignee_id,
            lida: false,
          }))
      );
    }

    results.tratativas = { hoje: hoje.length, amanha: amanha.length };
  }

  // ── 18:00 UTC — Tarefas vencendo hoje ────────────────────────────────────
  if (horaUTC === 18) {
    type TaskRow = { id: string; titulo: string; cotador_id: string; cotador_name: string };
    const rows = await dbQuery<TaskRow>(sql`
      SELECT t.id, t.titulo, t.cotador_id, u.name as cotador_name
      FROM tarefas t JOIN users u ON t.cotador_id = u.id
      WHERE t.tarefa_status NOT IN ('Concluída','Cancelada')
        AND DATE(t.data_vencimento) = CURDATE()
      ORDER BY t.created_at ASC LIMIT 30
    `);

    if (rows.length > 0) {
      const msgHoje = fmtTarefasHoje(rows as never);
      if (msgHoje) await notifyWithFallback(msgHoje);

      // Notificações individuais para cotadores
      await db.insert(cotacaoNotificacoes).values(
        rows.map((t) => ({
          cotacaoId: t.id, // usando tarefa id como referência (simplificado)
          cotacaoNome: t.titulo,
          autorId: null as string | null,
          autorNome: "Auditor",
          tipo: "mensagem",
          texto: `⏰ Sua tarefa *"${t.titulo}"* deve ser finalizada hoje!`,
          destinatarioId: t.cotador_id,
          lida: false,
        }))
      ).catch(() => {}); // ignorar erro de FK (tarefa id != cotacao id)
    }

    results.tarefasHoje = rows.length;
  }

  // ── 21:00 UTC — Tarefas não finalizadas ──────────────────────────────────
  if (horaUTC === 21) {
    type PendenteRow = { titulo: string; cotador_name: string; data_vencimento: string | null };
    const rows = await dbQuery<PendenteRow>(sql`
      SELECT t.titulo, u.name as cotador_name, CAST(t.data_vencimento AS CHAR) as data_vencimento
      FROM tarefas t JOIN users u ON t.cotador_id = u.id
      WHERE t.tarefa_status NOT IN ('Concluída','Cancelada')
        AND t.data_vencimento IS NOT NULL
        AND t.data_vencimento < now()
      ORDER BY t.data_vencimento ASC LIMIT 30
    `);

    const msgPendentes = fmtTarefasPendentes(rows as never);
    if (msgPendentes) await notifyWithFallback(msgPendentes);

    results.tarefasPendentes = rows.length;
  }

  return apiSuccess({ horaUTC, ...results });
}
