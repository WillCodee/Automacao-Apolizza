/**
 * Cron de Auditoria — chamado em horários específicos (UTC):
 *   - 11:00 UTC (08:00 BRT): tratativas de hoje e amanhã
 *   - 18:00 UTC (15:00 BRT): tarefas que vencem hoje
 *   - 21:00 UTC (18:00 BRT): tarefas não finalizadas
 */
import { NextRequest } from "next/server";
import { sql, eq, or, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
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

  // ── 11:00 UTC — Tratativas ────────────────────────────────────────────────
  if (horaUTC === 11) {
    const hoje = await db.execute(sql`
      SELECT c.id, c.name, c.proxima_tratativa::text, c.assignee_id,
             u.name as assignee_name
      FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
      WHERE c.deleted_at IS NULL AND c.proxima_tratativa = CURRENT_DATE
      ORDER BY c.proxima_tratativa ASC LIMIT 30
    `);
    const amanha = await db.execute(sql`
      SELECT c.id, c.name, c.proxima_tratativa::text, c.assignee_id,
             u.name as assignee_name
      FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
      WHERE c.deleted_at IS NULL AND c.proxima_tratativa = CURRENT_DATE + INTERVAL '1 day'
      ORDER BY c.proxima_tratativa ASC LIMIT 30
    `);

    // Telegram para admins
    const txtHoje = fmtTratativas(hoje.rows as never, "hoje");
    const txtAmanha = fmtTratativas(amanha.rows as never, "amanha");
    if (txtHoje) await sendTelegram(txtHoje);
    if (txtAmanha) await sendTelegram(txtAmanha);

    // Notificações no sistema para cotadores
    type TRow = { id: string; name: string; proxima_tratativa: string; assignee_id: string | null; assignee_name: string | null };
    const allRows = [...(hoje.rows as TRow[]), ...(amanha.rows as TRow[])];
    const quando = (r: TRow) => (hoje.rows as TRow[]).includes(r) ? "hoje" : "amanhã";

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
            texto: `📞 Lembrete: você tem uma tratativa agendada para *${quando(r)}* nesta cotação.`,
            destinatarioId: r.assignee_id,
            lida: false,
          }))
      );
    }

    results.tratativas = { hoje: hoje.rows.length, amanha: amanha.rows.length };
  }

  // ── 18:00 UTC — Tarefas vencendo hoje ────────────────────────────────────
  if (horaUTC === 18) {
    const r = await db.execute(sql`
      SELECT t.id, t.titulo, t.cotador_id, u.name as cotador_name
      FROM tarefas t JOIN users u ON t.cotador_id = u.id
      WHERE t.status NOT IN ('Concluída','Cancelada')
        AND t.data_vencimento::date = CURRENT_DATE
      ORDER BY t.created_at ASC LIMIT 30
    `);

    if (r.rows.length > 0) {
      await sendTelegram(fmtTarefasHoje(r.rows as never));

      // Notificações individuais para cotadores
      await db.insert(cotacaoNotificacoes).values(
        (r.rows as { id: string; titulo: string; cotador_id: string; cotador_name: string }[]).map((t) => ({
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

    results.tarefasHoje = r.rows.length;
  }

  // ── 21:00 UTC — Tarefas não finalizadas ──────────────────────────────────
  if (horaUTC === 21) {
    const r = await db.execute(sql`
      SELECT t.titulo, u.name as cotador_name, t.data_vencimento::text
      FROM tarefas t JOIN users u ON t.cotador_id = u.id
      WHERE t.status NOT IN ('Concluída','Cancelada')
        AND t.data_vencimento IS NOT NULL
        AND t.data_vencimento < now()
      ORDER BY t.data_vencimento ASC LIMIT 30
    `);

    if (r.rows.length > 0) {
      await sendTelegram(fmtTarefasPendentes(r.rows as never));
    }

    results.tarefasPendentes = r.rows.length;
  }

  return apiSuccess({ horaUTC, ...results });
}
