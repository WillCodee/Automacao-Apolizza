/**
 * Cron da Tarde — 18:00 UTC (15:00 BRT)
 * - Tarefas vencendo hoje -> Telegram + notificacoes cotadores
 * - Tarefas nao finalizadas (pendentes) -> Telegram
 * - Tarefas atrasadas -> email cotadores + admins
 * - Alertas de prazo (due_date = hoje) -> email responsaveis
 * - Resumo diario -> email admins
 */
import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db, dbQuery } from "@/lib/db";
import { cotacaoNotificacoes } from "@/lib/schema";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import {
  sendTelegram,
  fmtTarefasHoje,
  fmtTarefasPendentes,
} from "@/lib/telegram";
import {
  getAdminEmails,
  sendAlertEmail,
  buildPrazoHtml,
  buildResumoHtml,
  buildTarefaAtrasadaHtml,
  type CotacaoAlerta,
} from "@/lib/email";

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

// --- 1. Tarefas vencendo hoje ---

async function processarTarefasHoje() {
  const rows = await dbQuery(sql`
    SELECT t.id, t.titulo, t.cotador_id, u.name as cotador_name
    FROM tarefas t JOIN users u ON t.cotador_id = u.id
    WHERE t.status NOT IN ('Conclu\u00edda','Cancelada')
      AND DATE(t.data_vencimento) = CURDATE()
    ORDER BY t.created_at ASC LIMIT 30
  `);

  if (rows.length > 0) {
    await sendTelegram(fmtTarefasHoje(rows as never));

    await db.insert(cotacaoNotificacoes).values(
      (rows as { id: string; titulo: string; cotador_id: string; cotador_name: string }[]).map((t) => ({
        cotacaoId: t.id,
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

  return rows.length;
}

// --- 2. Tarefas nao finalizadas (pendentes) ---

async function processarTarefasPendentes() {
  const rows = await dbQuery(sql`
    SELECT t.titulo, u.name as cotador_name, CAST(t.data_vencimento AS CHAR) as data_vencimento
    FROM tarefas t JOIN users u ON t.cotador_id = u.id
    WHERE t.status NOT IN ('Conclu\u00edda','Cancelada')
      AND t.data_vencimento IS NOT NULL
      AND t.data_vencimento < NOW()
    ORDER BY t.data_vencimento ASC LIMIT 30
  `);

  if (rows.length > 0) {
    await sendTelegram(fmtTarefasPendentes(rows as never));
  }

  return rows.length;
}

// --- 3. Tarefas atrasadas (email) ---

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

async function processarTarefasAtrasadas() {
  const admins = await getAdminEmails();
  const rows = await dbQuery(sql`
    SELECT t.id, t.titulo, t.descricao, t.data_vencimento, t.status, t.cotador_id,
           u.name as cotador_name, u.email as cotador_email,
           criador.name as criador_name
    FROM tarefas t
    JOIN users u ON t.cotador_id = u.id
    JOIN users criador ON t.criador_id = criador.id
    WHERE t.data_vencimento < NOW()
      AND t.status NOT IN ('Conclu\u00edda', 'Cancelada')
      AND u.is_active = true
  `);

  let emailsEnviados = 0;
  for (const t of rows as TarefaRow[]) {
    const res = await sendAlertEmail({
      to: [t.cotador_email, ...admins],
      subject: `\u26a0\ufe0f Tarefa Atrasada: ${t.titulo}`,
      html: buildTarefaAtrasadaHtml(t),
    });
    if (res.success) emailsEnviados++;
  }

  return { tarefas: rows.length, emailsEnviados };
}

// --- 4. Alertas de prazo cotacoes (email) ---

async function processarAlertasPrazo() {
  const resultRows = await dbQuery(sql`
    SELECT c.id, c.name, c.status, c.seguradora, CAST(c.due_date AS CHAR) as due_date,
           u.name as assignee_name, u.email as assignee_email
    FROM cotacoes c
    LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL
      AND c.status NOT IN ('fechado', 'perda', 'cancelado', 'atrasado')
      AND DATE(c.due_date) = CURDATE()
    ORDER BY c.due_date ASC
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
    const res = await sendAlertEmail({ to, subject: `\u23f0 ${cotacoes.length} cota\u00e7\u00e3o(\u00f5es) com prazo hoje`, html: buildPrazoHtml(cotacoes) });
    if (res.success) sent++;
  }

  return { sent, cotacoes: rows.length };
}

// --- 5. Resumo diario (email admins) ---

async function processarResumoDiario() {
  const resultRows = await dbQuery(sql`
    SELECT
      CAST(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS SIGNED) as novas_hoje,
      CAST(SUM(CASE WHEN status = 'atrasado' THEN 1 ELSE 0 END) AS SIGNED) as atrasadas,
      CAST(SUM(CASE WHEN status = 'fechado' AND DATE(updated_at) = CURDATE() THEN 1 ELSE 0 END) AS SIGNED) as fechadas_hoje,
      CAST(SUM(CASE WHEN fim_vigencia IS NOT NULL AND fim_vigencia BETWEEN CURDATE() AND CURDATE() + INTERVAL 30 DAY THEN 1 ELSE 0 END) AS SIGNED) as vencendo_30d
    FROM cotacoes WHERE deleted_at IS NULL
  `);

  const row = resultRows[0] as Record<string, unknown>;
  const kpis = {
    novas_hoje: Number(row.novas_hoje) || 0,
    atrasadas: Number(row.atrasadas) || 0,
    fechadas_hoje: Number(row.fechadas_hoje) || 0,
    vencendo_30d: Number(row.vencendo_30d) || 0,
  };

  const admins = await getAdminEmails();
  if (admins.length === 0) return { sent: 0 };

  const res = await sendAlertEmail({
    to: admins,
    subject: `\ud83d\udcca Resumo di\u00e1rio \u2014 ${kpis.novas_hoje} novas, ${kpis.atrasadas} atrasadas`,
    html: buildResumoHtml(kpis),
  });

  return { sent: res.success ? 1 : 0 };
}

// --- Handler ---

async function handler(req: NextRequest) {
  if (!verifyCron(req)) return apiError("Nao autorizado", 401);

  try {
    const [tarefasHoje, tarefasPendentes, tarefasAtrasadas, alertasPrazo, resumo] = await Promise.all([
      processarTarefasHoje(),
      processarTarefasPendentes(),
      processarTarefasAtrasadas(),
      processarAlertasPrazo(),
      processarResumoDiario(),
    ]);

    return apiSuccess({
      message: "Cron da tarde executado com sucesso",
      tarefasHoje,
      tarefasPendentes,
      tarefasAtrasadas,
      alertasPrazo,
      resumo,
    });
  } catch (error) {
    console.error("API /api/cron/tarde:", error);
    return apiError("Erro ao executar cron da tarde", 500);
  }
}

export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }
