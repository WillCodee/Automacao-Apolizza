/**
 * Cron da Manha — 11:00 UTC (08:00 BRT)
 * - Marca cotacoes como atrasado + notificacoes sistema + Telegram
 * - Tratativas de hoje e amanha -> Telegram + notificacoes cotadores
 * - Alertas de vigencia (60/30/15 dias) -> email admins + responsaveis
 * - Alertas de tratativa -> email responsaveis
 * - Novas tarefas criadas hoje -> email cotadores
 * - Tarefas concluidas hoje -> email admins
 */
import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db, dbQuery } from "@/lib/db";
import { cotacaoNotificacoes } from "@/lib/schema";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import {
  sendTelegram,
  fmtAtrasado,
  fmtTratativas,
} from "@/lib/telegram";
import {
  getAdminEmails,
  sendAlertEmail,
  buildVigenciaHtml,
  buildTratativaHtml,
  buildNovaTarefaHtml,
  buildTarefaConcluidaHtml,
  type CotacaoAlerta,
} from "@/lib/email";

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

// --- 1. Cotacoes atrasadas ---

async function processarAtrasados() {
  // MySQL does not support RETURNING, so we need to do UPDATE + SELECT
  await db.execute(sql`
    UPDATE cotacoes
    SET status = 'atrasado', updated_at = NOW()
    WHERE deleted_at IS NULL
      AND due_date < NOW()
      AND status NOT IN ('fechado', 'perda', 'concluido ocultar', 'atrasado')
  `);

  const updatedRows = await dbQuery(sql`
    SELECT id, name, assignee_id, status
    FROM cotacoes
    WHERE deleted_at IS NULL
      AND status = 'atrasado'
      AND updated_at >= NOW() - INTERVAL 1 MINUTE
      AND due_date < NOW()
  `);

  const updated = updatedRows as { id: string; name: string; assignee_id: string | null; status: string }[];

  if (updated.length > 0) {
    await db.insert(cotacaoNotificacoes).values(
      updated.map((c) => ({
        cotacaoId: c.id,
        cotacaoNome: c.name,
        autorId: null as string | null,
        autorNome: "Sistema",
        tipo: "atrasado",
        texto: `Cota\u00e7\u00e3o "${c.name}" passou do prazo e foi marcada como atrasada.`,
        destinatarioId: null as string | null,
        lida: false,
      }))
    );

    const telegramRows = updated.map((c) => ({ id: c.id, name: c.name, due_date: "", assignee_name: null }));
    await sendTelegram(fmtAtrasado(telegramRows));
  }

  return updated.length;
}

// --- 2. Tratativas (hoje + amanha) ---

async function processarTratativas() {
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

  const txtHoje = fmtTratativas(hojeRows as never, "hoje");
  const txtAmanha = fmtTratativas(amanhaRows as never, "amanha");
  if (txtHoje) await sendTelegram(txtHoje);
  if (txtAmanha) await sendTelegram(txtAmanha);

  type TRow = { id: string; name: string; proxima_tratativa: string; assignee_id: string | null; assignee_name: string | null };
  const hoje = hojeRows as TRow[];
  const amanha = amanhaRows as TRow[];
  const allRows = [...hoje, ...amanha];

  if (allRows.length > 0) {
    const hojeIds = new Set(hoje.map((r) => r.id));
    await db.insert(cotacaoNotificacoes).values(
      allRows
        .filter((r) => r.assignee_id)
        .map((r) => ({
          cotacaoId: r.id,
          cotacaoNome: r.name,
          autorId: null as string | null,
          autorNome: "Auditor",
          tipo: "mensagem",
          texto: `\ud83d\udcde Lembrete: voc\u00ea tem uma tratativa agendada para *${hojeIds.has(r.id) ? "hoje" : "amanh\u00e3"}* nesta cota\u00e7\u00e3o.`,
          destinatarioId: r.assignee_id,
          lida: false,
        }))
    );
  }

  return { hoje: hoje.length, amanha: amanha.length };
}

// --- 3. Alertas de vigencia (email) ---

async function processarAlertasVigencia() {
  const resultRows = await dbQuery(sql`
    SELECT c.id, c.name, c.status, c.seguradora, CAST(c.fim_vigencia AS CHAR) as fim_vigencia,
           u.name as assignee_name, u.email as assignee_email
    FROM cotacoes c
    LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL
      AND c.status NOT IN ('fechado', 'perda', 'concluido ocultar')
      AND c.fim_vigencia IS NOT NULL
      AND c.fim_vigencia BETWEEN CURDATE() AND CURDATE() + INTERVAL 60 DAY
    ORDER BY c.fim_vigencia ASC
  `);

  const rows = resultRows as unknown as CotacaoAlerta[];
  if (rows.length === 0) return { sent: 0, cotacoes: 0 };

  const now = new Date();
  const d15 = new Date(now); d15.setDate(d15.getDate() + 15);
  const d30 = new Date(now); d30.setDate(d30.getDate() + 30);

  const groups = [
    { label: "At\u00e9 15 dias", badge: "badge-red", cotacoes: [] as CotacaoAlerta[] },
    { label: "16\u201330 dias", badge: "badge-orange", cotacoes: [] as CotacaoAlerta[] },
    { label: "31\u201360 dias", badge: "badge-blue", cotacoes: [] as CotacaoAlerta[] },
  ];
  for (const row of rows) {
    const fv = new Date(row.fim_vigencia!);
    if (fv <= d15) groups[0].cotacoes.push(row);
    else if (fv <= d30) groups[1].cotacoes.push(row);
    else groups[2].cotacoes.push(row);
  }

  const admins = await getAdminEmails();
  let sent = 0;

  if (admins.length > 0) {
    const res = await sendAlertEmail({ to: admins, subject: `\u26a0\ufe0f ${rows.length} cota\u00e7\u00e3o(\u00f5es) com vig\u00eancia pr\u00f3xima`, html: buildVigenciaHtml(groups) });
    if (res.success) sent++;
  }

  const byAssignee = new Map<string, CotacaoAlerta[]>();
  for (const row of rows) {
    if (row.assignee_email) {
      const list = byAssignee.get(row.assignee_email) || [];
      list.push(row);
      byAssignee.set(row.assignee_email, list);
    }
  }
  for (const [email, cotacoes] of byAssignee) {
    if (admins.includes(email)) continue;
    const pg = [
      { label: "At\u00e9 15 dias", badge: "badge-red", cotacoes: [] as CotacaoAlerta[] },
      { label: "16\u201330 dias", badge: "badge-orange", cotacoes: [] as CotacaoAlerta[] },
      { label: "31\u201360 dias", badge: "badge-blue", cotacoes: [] as CotacaoAlerta[] },
    ];
    for (const c of cotacoes) {
      const fv = new Date(c.fim_vigencia!);
      if (fv <= d15) pg[0].cotacoes.push(c);
      else if (fv <= d30) pg[1].cotacoes.push(c);
      else pg[2].cotacoes.push(c);
    }
    const res = await sendAlertEmail({ to: email, subject: `\u26a0\ufe0f ${cotacoes.length} cota\u00e7\u00e3o(\u00f5es) com vig\u00eancia pr\u00f3xima`, html: buildVigenciaHtml(pg) });
    if (res.success) sent++;
  }

  return { sent, cotacoes: rows.length };
}

// --- 4. Alertas de tratativa (email) ---

async function processarAlertasTratativa() {
  const resultRows = await dbQuery(sql`
    SELECT c.id, c.name, c.status, c.seguradora, CAST(c.proxima_tratativa AS CHAR) as proxima_tratativa,
           u.name as assignee_name, u.email as assignee_email
    FROM cotacoes c
    LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL
      AND c.status NOT IN ('fechado', 'perda', 'concluido ocultar')
      AND c.proxima_tratativa IS NOT NULL
      AND c.proxima_tratativa BETWEEN CURDATE() AND CURDATE() + INTERVAL 1 DAY
    ORDER BY c.proxima_tratativa ASC
  `);

  const rows = resultRows as unknown as CotacaoAlerta[];
  if (rows.length === 0) return { sent: 0, cotacoes: 0 };

  const byAssignee = new Map<string, CotacaoAlerta[]>();
  for (const row of rows) {
    const email = row.assignee_email || "admins";
    const list = byAssignee.get(email) || [];
    list.push(row);
    byAssignee.set(email, list);
  }

  const admins = await getAdminEmails();
  let sent = 0;
  for (const [email, cotacoes] of byAssignee) {
    const to = email === "admins" ? admins : [email];
    if (to.length === 0) continue;
    const res = await sendAlertEmail({ to, subject: `\ud83d\udccb ${cotacoes.length} tratativa(s) agendada(s) para hoje/amanh\u00e3`, html: buildTratativaHtml(cotacoes) });
    if (res.success) sent++;
  }

  return { sent, cotacoes: rows.length };
}

// --- 5. Novas tarefas + concluidas (email) ---

interface TarefaRow extends Record<string, unknown> {
  id: string;
  titulo: string;
  descricao: string | null;
  data_vencimento: string | null;
  status: string;
  cotador_id: string;
  cotador_name: string;
  cotador_email: string;
  criador_name: string;
}

async function processarNotificacoesTarefas() {
  const admins = await getAdminEmails();
  let emailsEnviados = 0;

  // Novas tarefas criadas hoje -> email para cotador
  const novasRows = await dbQuery(sql`
    SELECT t.id, t.titulo, t.descricao, t.data_vencimento, t.status, t.cotador_id,
           u.name as cotador_name, u.email as cotador_email,
           criador.name as criador_name
    FROM tarefas t
    JOIN users u ON t.cotador_id = u.id
    JOIN users criador ON t.criador_id = criador.id
    WHERE DATE(t.created_at) = CURDATE() AND u.is_active = true
  `);
  for (const t of novasRows as TarefaRow[]) {
    const res = await sendAlertEmail({ to: t.cotador_email, subject: `\ud83c\udd95 Nova Tarefa: ${t.titulo}`, html: buildNovaTarefaHtml(t) });
    if (res.success) emailsEnviados++;
  }

  // Tarefas concluidas hoje -> email para admins
  const concluidasRows = await dbQuery(sql`
    SELECT t.id, t.titulo, t.descricao, t.data_vencimento, t.status, t.cotador_id,
           u.name as cotador_name, u.email as cotador_email,
           criador.name as criador_name
    FROM tarefas t
    JOIN users u ON t.cotador_id = u.id
    JOIN users criador ON t.criador_id = criador.id
    WHERE DATE(t.updated_at) = CURDATE() AND t.status = 'Conclu\u00edda' AND u.is_active = true
  `);
  for (const t of concluidasRows as TarefaRow[]) {
    const res = await sendAlertEmail({ to: admins, subject: `\u2705 Tarefa Conclu\u00edda: ${t.titulo}`, html: buildTarefaConcluidaHtml(t) });
    if (res.success) emailsEnviados++;
  }

  return { novas: novasRows.length, concluidas: concluidasRows.length, emailsEnviados };
}

// --- Handler ---

async function handler(req: NextRequest) {
  if (!verifyCron(req)) return apiError("Nao autorizado", 401);

  try {
    const [atrasados, tratativas, vigencia, alertaTratativa, tarefas] = await Promise.all([
      processarAtrasados(),
      processarTratativas(),
      processarAlertasVigencia(),
      processarAlertasTratativa(),
      processarNotificacoesTarefas(),
    ]);

    return apiSuccess({
      message: "Cron da manha executado com sucesso",
      atrasados,
      tratativas,
      vigencia,
      alertaTratativa,
      tarefas,
    });
  } catch (error) {
    console.error("API /api/cron/manha:", error);
    return apiError("Erro ao executar cron da manha", 500);
  }
}

export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }
