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
import { db } from "@/lib/db";
import { cotacaoNotificacoes } from "@/lib/schema";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import {
  sendTelegram,
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

// ─── 1. Cotações atrasadas ───────────────────────────────────────────────────

async function processarAtrasados() {
  const result = await db.execute(sql`
    UPDATE cotacoes
    SET status = 'atrasado', updated_at = now()
    WHERE deleted_at IS NULL
      AND due_date < now()
      AND status NOT IN ('fechado', 'perda', 'concluido ocultar', 'atrasado')
    RETURNING id, name, assignee_id, status
  `);

  const updated = result.rows as { id: string; name: string; assignee_id: string | null; status: string }[];

  if (updated.length > 0) {
    await db.insert(cotacaoNotificacoes).values(
      updated.map((c) => ({
        cotacaoId: c.id,
        cotacaoNome: c.name,
        autorId: null as string | null,
        autorNome: "Sistema",
        tipo: "atrasado",
        texto: `Cotação "${c.name}" passou do prazo e foi marcada como atrasada.`,
        destinatarioId: null as string | null,
        lida: false,
      }))
    );

    const telegramRows = updated.map((c) => ({ id: c.id, name: c.name, due_date: "", assignee_name: null }));
    await sendTelegram(fmtAtrasado(telegramRows));
  }

  return updated.length;
}

// ─── 2. Tratativas (hoje + amanhã) ──────────────────────────────────────────

async function processarTratativas() {
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

  const txtHoje = fmtTratativas(hoje.rows as never, "hoje");
  const txtAmanha = fmtTratativas(amanha.rows as never, "amanha");
  if (txtHoje) await sendTelegram(txtHoje);
  if (txtAmanha) await sendTelegram(txtAmanha);

  type TRow = { id: string; name: string; proxima_tratativa: string; assignee_id: string | null; assignee_name: string | null };
  const hojeRows = hoje.rows as TRow[];
  const amanhaRows = amanha.rows as TRow[];
  const allRows = [...hojeRows, ...amanhaRows];

  if (allRows.length > 0) {
    const hojeIds = new Set(hojeRows.map((r) => r.id));
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

  return { hoje: hoje.rows.length, amanha: amanha.rows.length };
}

// ─── 3. Alertas de vigência (Telegram) ──────────────────────────────────────

async function processarAlertasVigencia() {
  const result = await db.execute(sql`
    SELECT c.id, c.name, c.status, c.seguradora, c.fim_vigencia::text,
           u.name as assignee_name
    FROM cotacoes c
    LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL
      AND c.status NOT IN ('fechado', 'perda', 'concluido ocultar')
      AND c.fim_vigencia IS NOT NULL
      AND c.fim_vigencia BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
    ORDER BY c.fim_vigencia ASC
  `);

  const rows = result.rows as { id: string; name: string; seguradora: string | null; fim_vigencia: string; assignee_name: string | null }[];
  const msg = fmtVigenciaAlerta(rows);
  if (msg) await sendTelegram(msg);

  return rows.length;
}

// ─── 4. Novas tarefas + concluídas (Telegram) ───────────────────────────────

async function processarNotificacoesTarefas() {
  const novas = await db.execute(sql`
    SELECT t.id, t.titulo, t.data_vencimento::text,
           u.name as cotador_name, criador.name as criador_name
    FROM tarefas t
    JOIN users u ON t.cotador_id = u.id
    JOIN users criador ON t.criador_id = criador.id
    WHERE t.created_at::date = NOW()::date AND u.is_active = true
  `);

  const concluidas = await db.execute(sql`
    SELECT t.id, t.titulo, u.name as cotador_name
    FROM tarefas t
    JOIN users u ON t.cotador_id = u.id
    WHERE t.updated_at::date = NOW()::date AND t.status = 'Concluída' AND u.is_active = true
  `);

  const msgNovas = fmtNovasTarefas(novas.rows as { id: string; titulo: string; cotador_name: string; criador_name: string; data_vencimento: string | null }[]);
  const msgConcluidas = fmtTarefasConcluidas(concluidas.rows as { id: string; titulo: string; cotador_name: string }[]);

  if (msgNovas) await sendTelegram(msgNovas);
  if (msgConcluidas) await sendTelegram(msgConcluidas);

  return { novas: novas.rows.length, concluidas: concluidas.rows.length };
}

// ─── 5. Tarefas pendentes atrasadas (Telegram) ──────────────────────────────

async function processarTarefasPendentes() {
  const r = await db.execute(sql`
    SELECT t.id, t.titulo, u.name as cotador_name, t.data_vencimento::text
    FROM tarefas t JOIN users u ON t.cotador_id = u.id
    WHERE t.status NOT IN ('Concluída','Cancelada')
      AND t.data_vencimento IS NOT NULL
      AND t.data_vencimento < now()
    ORDER BY t.data_vencimento ASC LIMIT 30
  `);

  const msg = fmtTarefasPendentes(r.rows as { id: string; titulo: string; cotador_name: string; data_vencimento: string | null }[]);
  if (msg) await sendTelegram(msg);

  return r.rows.length;
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
