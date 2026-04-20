/**
 * Cron da Tarde — 18:00 UTC (15:00 BRT)
 * - Tarefas vencendo hoje → Telegram + notificações cotadores
 * - Seguros vencendo hoje (fim_vigencia) → Telegram
 * - Cotações com prazo hoje (due_date) → Telegram
 * - Tarefas atrasadas → email cotadores + admins
 * - Alertas de prazo (due_date = hoje) → email responsáveis
 * - Resumo diário → email admins
 */
import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacaoNotificacoes } from "@/lib/schema";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import {
  sendTelegram,
  fmtTarefasHoje,
  fmtVigenciaHoje,
  fmtCotacoesVencendoHoje,
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

// ─── 1. Tarefas vencendo hoje ────────────────────────────────────────────────

async function processarTarefasHoje() {
  const r = await db.execute(sql`
    SELECT t.id, t.titulo, t.cotador_id, u.name as cotador_name
    FROM tarefas t JOIN users u ON t.cotador_id = u.id
    WHERE t.status NOT IN ('Concluída','Cancelada')
      AND t.data_vencimento::date = CURRENT_DATE
    ORDER BY t.created_at ASC LIMIT 30
  `);

  if (r.rows.length > 0) {
    const msg = fmtTarefasHoje(r.rows as never);
    if (msg) await sendTelegram(msg);

    await db.insert(cotacaoNotificacoes).values(
      (r.rows as { id: string; titulo: string; cotador_id: string; cotador_name: string }[]).map((t) => ({
        cotacaoId: t.id,
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

  return r.rows.length;
}

// ─── 2. Seguros vencendo hoje (Telegram) ────────────────────────────────────

async function processarVigenciaHoje() {
  const r = await db.execute(sql`
    SELECT c.id, c.name, c.seguradora, u.name as assignee_name
    FROM cotacoes c LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL
      AND c.fim_vigencia = CURRENT_DATE
      AND c.status NOT IN ('perda', 'cancelado', 'concluido ocultar')
    ORDER BY c.name ASC LIMIT 30
  `);

  const msg = fmtVigenciaHoje(r.rows as { id: string; name: string; seguradora: string | null; assignee_name: string | null }[]);
  if (msg) await sendTelegram(msg);

  return r.rows.length;
}

// ─── 3. Cotações com prazo hoje (Telegram) ───────────────────────────────────

async function processarCotacoesVencendoHoje() {
  const r = await db.execute(sql`
    SELECT c.id, c.name, c.status, u.name as assignee_name
    FROM cotacoes c
    LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL
      AND c.due_date::date = CURRENT_DATE
      AND c.status NOT IN ('fechado', 'perda', 'concluido ocultar')
    ORDER BY c.name ASC LIMIT 30
  `);

  const msg = fmtCotacoesVencendoHoje(r.rows as { id: string; name: string; assignee_name: string | null; status: string }[]);
  if (msg) await sendTelegram(msg);

  return r.rows.length;
}

// ─── 5. Tarefas atrasadas (email) ────────────────────────────────────────────

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
  const r = await db.execute<TarefaRow>(sql`
    SELECT t.id, t.titulo, t.descricao, t.data_vencimento, t.status, t.cotador_id,
           u.name as cotador_name, u.email as cotador_email,
           criador.name as criador_name
    FROM tarefas t
    JOIN users u ON t.cotador_id = u.id
    JOIN users criador ON t.criador_id = criador.id
    WHERE t.data_vencimento < NOW()
      AND t.status NOT IN ('Concluída', 'Cancelada')
      AND u.is_active = true
  `);

  let emailsEnviados = 0;
  for (const t of r.rows) {
    const res = await sendAlertEmail({
      to: [t.cotador_email, ...admins],
      subject: `⚠️ Tarefa Atrasada: ${t.titulo}`,
      html: buildTarefaAtrasadaHtml(t),
    });
    if (res.success) emailsEnviados++;
  }

  return { tarefas: r.rows.length, emailsEnviados };
}

// ─── 6. Alertas de prazo cotações (email) ────────────────────────────────────

async function processarAlertasPrazo() {
  const result = await db.execute(sql`
    SELECT c.id, c.name, c.status, c.seguradora, c.due_date::text,
           u.name as assignee_name, u.email as assignee_email
    FROM cotacoes c
    LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL
      AND c.status NOT IN ('fechado', 'perda', 'cancelado', 'atrasado')
      AND c.due_date::date = CURRENT_DATE
    ORDER BY c.due_date ASC
  `);

  const rows = result.rows as unknown as CotacaoAlerta[];
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
    const res = await sendAlertEmail({ to, subject: `⏰ ${cotacoes.length} cotação(ões) com prazo hoje`, html: buildPrazoHtml(cotacoes) });
    if (res.success) sent++;
  }

  return { sent, cotacoes: rows.length };
}

// ─── 7. Resumo diário (email admins) ────────────────────────────────────────

async function processarResumoDiario() {
  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) as novas_hoje,
      COUNT(*) FILTER (WHERE status = 'atrasado') as atrasadas,
      COUNT(*) FILTER (WHERE status = 'fechado' AND updated_at::date = CURRENT_DATE) as fechadas_hoje,
      COUNT(*) FILTER (WHERE fim_vigencia IS NOT NULL AND fim_vigencia BETWEEN CURRENT_DATE AND CURRENT_DATE + 30) as vencendo_30d
    FROM cotacoes WHERE deleted_at IS NULL
  `);

  const row = result.rows[0] as Record<string, unknown>;
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
    subject: `📊 Resumo diário — ${kpis.novas_hoje} novas, ${kpis.atrasadas} atrasadas`,
    html: buildResumoHtml(kpis),
  });

  return { sent: res.success ? 1 : 0 };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

async function handler(req: NextRequest) {
  if (!verifyCron(req)) return apiError("Nao autorizado", 401);

  try {
    const [tarefasHoje, vigenciaHoje, cotacoesVencendoHoje, tarefasAtrasadas, alertasPrazo, resumo] = await Promise.all([
      processarTarefasHoje(),
      processarVigenciaHoje(),
      processarCotacoesVencendoHoje(),
      processarTarefasAtrasadas(),
      processarAlertasPrazo(),
      processarResumoDiario(),
    ]);

    return apiSuccess({
      message: "Cron da tarde executado com sucesso",
      tarefasHoje,
      vigenciaHoje,
      cotacoesVencendoHoje,
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
