/**
 * Cron da Manhã — 11:00 UTC (08:00 BRT)
 * - Marca cotações como atrasado + notificações sistema + Telegram
 * - Tratativas de hoje e amanhã → Telegram + notificações cotadores
 * - Alertas de vigência (60/30/15 dias) → Telegram
 * - Novas tarefas criadas hoje → Telegram
 * - Tarefas concluídas hoje → Telegram
 * - Tarefas pendentes atrasadas → Telegram
 */
import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db, dbQuery } from "@/lib/db";
import { cotacaoNotificacoes, cotacaoHistory } from "@/lib/schema";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import {
  notifyWithFallback,
  fmtAtrasado,
  fmtTratativas,
  fmtTarefasPendentes,
  fmtVigenciaAlerta,
  fmtNovasTarefas,
  fmtTarefasConcluidas,
} from "@/lib/telegram";

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

// ─── 1. Cotações atrasadas (FLAG, não status) ───────────────────────────────
//
// Marca/desmarca a flag `atrasado_desde` sem tocar no campo `status`. O status real
// (implantando, pendencia, raut, etc.) é preservado. Toda mudança é registrada em
// cotacao_history para auditoria.

async function processarAtrasados() {
  // 1) Marca como atrasada (set atrasado_desde = hoje) cotações vencidas que não
  //    estão em status terminal e ainda não foram marcadas como atrasadas.
  const novasAtrasadas = await dbQuery<{ id: string; name: string; assignee_id: string | null; status: string }>(sql`
    SELECT id, name, assignee_id, status
    FROM cotacoes
    WHERE deleted_at IS NULL
      AND atrasado_desde IS NULL
      AND due_date < CURDATE()
      AND status NOT IN ('fechado', 'perda', 'concluido ocultar')
  `);

  if (novasAtrasadas.length > 0) {
    const ids = novasAtrasadas.map((c) => c.id);
    await db.execute(sql`
      UPDATE cotacoes
      SET atrasado_desde = CURDATE(), updated_at = NOW()
      WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
    `);

    // Audit trail (D4: todo write sistêmico grava history)
    await db.insert(cotacaoHistory).values(
      novasAtrasadas.map((c) => ({
        cotacaoId: c.id,
        userId: null,
        fieldName: "atrasado_desde",
        oldValue: null,
        newValue: new Date().toISOString().slice(0, 10),
      }))
    );

    await db.insert(cotacaoNotificacoes).values(
      novasAtrasadas.map((c) => ({
        cotacaoId: c.id,
        cotacaoNome: c.name,
        autorId: null as string | null,
        autorNome: "Sistema",
        tipo: "atrasado",
        texto: `Cotação "${c.name}" passou do prazo (status real: ${c.status}).`,
        destinatarioId: null as string | null,
        lida: false,
      }))
    );

    const telegramRows = novasAtrasadas.map((c) => ({ id: c.id, name: c.name, due_date: "", assignee_name: null }));
    await notifyWithFallback(fmtAtrasado(telegramRows));
  }

  // 2) Desmarca (atrasado_desde = NULL) quando a cotação virou terminal ou
  //    o due_date foi ajustado para o futuro.
  const desmarcadas = await dbQuery<{ id: string }>(sql`
    SELECT id FROM cotacoes
    WHERE deleted_at IS NULL
      AND atrasado_desde IS NOT NULL
      AND (status IN ('fechado', 'perda', 'concluido ocultar') OR due_date >= CURDATE() OR due_date IS NULL)
  `);
  if (desmarcadas.length > 0) {
    const ids = desmarcadas.map((d) => d.id);
    await db.execute(sql`
      UPDATE cotacoes
      SET atrasado_desde = NULL, updated_at = NOW()
      WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
    `);
    await db.insert(cotacaoHistory).values(
      desmarcadas.map((d) => ({
        cotacaoId: d.id,
        userId: null,
        fieldName: "atrasado_desde",
        oldValue: "(set)",
        newValue: null,
      }))
    );
  }

  return novasAtrasadas.length;
}

// ─── 2. Tratativas (hoje + amanhã) ──────────────────────────────────────────

async function processarTratativas() {
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

  const txtHoje = fmtTratativas(hoje as never, "hoje");
  const txtAmanha = fmtTratativas(amanha as never, "amanha");
  if (txtHoje) await notifyWithFallback(txtHoje);
  if (txtAmanha) await notifyWithFallback(txtAmanha);

  const hojeIds = new Set(hoje.map((r) => r.id));
  const allRows = [...hoje, ...amanha];

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

  return { hoje: hoje.length, amanha: amanha.length };
}

// ─── 3. Alertas de vigência (Telegram) ──────────────────────────────────────

async function processarAlertasVigencia() {
  const rows = await dbQuery<{ id: string; name: string; seguradora: string | null; fim_vigencia: string; assignee_name: string | null }>(sql`
    SELECT c.id, c.name, c.status, c.seguradora, CAST(c.fim_vigencia AS CHAR) as fim_vigencia,
           u.name as assignee_name
    FROM cotacoes c
    LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL
      AND c.status NOT IN ('fechado', 'perda', 'concluido ocultar')
      AND c.fim_vigencia IS NOT NULL
      AND c.fim_vigencia BETWEEN CURDATE() AND CURDATE() + INTERVAL 60 DAY
    ORDER BY c.fim_vigencia ASC
  `);

  const msg = fmtVigenciaAlerta(rows);
  if (msg) await notifyWithFallback(msg);

  return rows.length;
}

// ─── 4. Novas tarefas + concluídas (Telegram) ───────────────────────────────

async function processarNotificacoesTarefas() {
  const novas = await dbQuery<{ id: string; titulo: string; cotador_name: string; criador_name: string; data_vencimento: string | null }>(sql`
    SELECT t.id, t.titulo, CAST(t.data_vencimento AS CHAR) as data_vencimento,
           u.name as cotador_name, criador.name as criador_name
    FROM tarefas t
    JOIN users u ON t.cotador_id = u.id
    JOIN users criador ON t.criador_id = criador.id
    WHERE DATE(t.created_at) = CURDATE() AND u.is_active = true
  `);

  const concluidas = await dbQuery<{ id: string; titulo: string; cotador_name: string }>(sql`
    SELECT t.id, t.titulo, u.name as cotador_name
    FROM tarefas t
    JOIN users u ON t.cotador_id = u.id
    WHERE DATE(t.updated_at) = CURDATE() AND t.status = 'Concluída' AND u.is_active = true
  `);

  const msgNovas = fmtNovasTarefas(novas);
  const msgConcluidas = fmtTarefasConcluidas(concluidas);

  if (msgNovas) await notifyWithFallback(msgNovas);
  if (msgConcluidas) await notifyWithFallback(msgConcluidas);

  return { novas: novas.length, concluidas: concluidas.length };
}

// ─── 5. Tarefas pendentes atrasadas (Telegram) ──────────────────────────────

async function processarTarefasPendentes() {
  const rows = await dbQuery<{ id: string; titulo: string; cotador_name: string; data_vencimento: string | null }>(sql`
    SELECT t.id, t.titulo, u.name as cotador_name, CAST(t.data_vencimento AS CHAR) as data_vencimento
    FROM tarefas t JOIN users u ON t.cotador_id = u.id
    WHERE t.status NOT IN ('Concluída','Cancelada')
      AND t.data_vencimento IS NOT NULL
      AND t.data_vencimento < now()
    ORDER BY t.data_vencimento ASC LIMIT 30
  `);

  const msg = fmtTarefasPendentes(rows);
  if (msg) await notifyWithFallback(msg);

  return rows.length;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

async function handler(req: NextRequest) {
  if (!verifyCron(req)) return apiError("Nao autorizado", 401);

  try {
    const [atrasados, tratativas, vigencia, tarefas, tarefasPendentes] = await Promise.all([
      processarAtrasados(),
      processarTratativas(),
      processarAlertasVigencia(),
      processarNotificacoesTarefas(),
      processarTarefasPendentes(),
    ]);

    return apiSuccess({
      message: "Cron da manhã executado com sucesso",
      atrasados,
      tratativas,
      vigencia,
      tarefas,
      tarefasPendentes,
    });
  } catch (error) {
    console.error("API /api/cron/manha:", error);
    return apiError("Erro ao executar cron da manhã", 500);
  }
}

export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }
