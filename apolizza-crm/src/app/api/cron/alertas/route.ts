import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import {
  getAdminEmails,
  sendAlertEmail,
  buildVigenciaHtml,
  buildTratativaHtml,
  buildPrazoHtml,
  buildResumoHtml,
  type CotacaoAlerta,
} from "@/lib/email";

// ─── Auth helper ────────────────────────────────────────────

function verifyCron(req: NextRequest): Response | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return apiError("CRON_SECRET não configurado", 500);

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) return apiError("Não autorizado", 401);

  return null;
}

// ─── 1. Alertas de Vigência (60/30/15 dias) ────────────────

async function alertasVigencia(): Promise<{ sent: number; cotacoes: number }> {
  const result = await db.execute(sql`
    SELECT c.id, c.name, c.status, c.seguradora, c.fim_vigencia::text,
           u.name as assignee_name, u.email as assignee_email
    FROM cotacoes c
    LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL
      AND c.status NOT IN ('fechado', 'perda', 'cancelado')
      AND c.fim_vigencia IS NOT NULL
      AND c.fim_vigencia BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
    ORDER BY c.fim_vigencia ASC
  `);

  const rows = result.rows as unknown as CotacaoAlerta[];
  if (rows.length === 0) return { sent: 0, cotacoes: 0 };

  // Agrupar por faixa
  const now = new Date();
  const d15 = new Date(now); d15.setDate(d15.getDate() + 15);
  const d30 = new Date(now); d30.setDate(d30.getDate() + 30);

  const groups = [
    { label: "Até 15 dias", badge: "badge-red", cotacoes: [] as CotacaoAlerta[] },
    { label: "16–30 dias", badge: "badge-orange", cotacoes: [] as CotacaoAlerta[] },
    { label: "31–60 dias", badge: "badge-blue", cotacoes: [] as CotacaoAlerta[] },
  ];

  for (const row of rows) {
    const fv = new Date(row.fim_vigencia!);
    if (fv <= d15) groups[0].cotacoes.push(row);
    else if (fv <= d30) groups[1].cotacoes.push(row);
    else groups[2].cotacoes.push(row);
  }

  const html = buildVigenciaHtml(groups);
  const admins = await getAdminEmails();

  // Enviar para admins
  let sent = 0;
  if (admins.length > 0) {
    const res = await sendAlertEmail({
      to: admins,
      subject: `⚠️ ${rows.length} cotação(ões) com vigência próxima`,
      html,
    });
    if (res.success) sent++;
  }

  // Enviar para cada responsável suas próprias cotações
  const byAssignee = new Map<string, CotacaoAlerta[]>();
  for (const row of rows) {
    if (row.assignee_email) {
      const list = byAssignee.get(row.assignee_email) || [];
      list.push(row);
      byAssignee.set(row.assignee_email, list);
    }
  }

  for (const [email, cotacoes] of byAssignee) {
    if (admins.includes(email)) continue; // já recebeu o consolidado
    const personalGroups = [
      { label: "Até 15 dias", badge: "badge-red", cotacoes: [] as CotacaoAlerta[] },
      { label: "16–30 dias", badge: "badge-orange", cotacoes: [] as CotacaoAlerta[] },
      { label: "31–60 dias", badge: "badge-blue", cotacoes: [] as CotacaoAlerta[] },
    ];
    for (const c of cotacoes) {
      const fv = new Date(c.fim_vigencia!);
      if (fv <= d15) personalGroups[0].cotacoes.push(c);
      else if (fv <= d30) personalGroups[1].cotacoes.push(c);
      else personalGroups[2].cotacoes.push(c);
    }
    const res = await sendAlertEmail({
      to: email,
      subject: `⚠️ ${cotacoes.length} cotação(ões) com vigência próxima`,
      html: buildVigenciaHtml(personalGroups),
    });
    if (res.success) sent++;
  }

  return { sent, cotacoes: rows.length };
}

// ─── 2. Alertas de Tratativa (hoje/amanhã) ─────────────────

async function alertasTratativa(): Promise<{ sent: number; cotacoes: number }> {
  const result = await db.execute(sql`
    SELECT c.id, c.name, c.status, c.seguradora, c.proxima_tratativa::text,
           u.name as assignee_name, u.email as assignee_email
    FROM cotacoes c
    LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.deleted_at IS NULL
      AND c.status NOT IN ('fechado', 'perda', 'cancelado')
      AND c.proxima_tratativa IS NOT NULL
      AND c.proxima_tratativa BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '1 day'
    ORDER BY c.proxima_tratativa ASC
  `);

  const rows = result.rows as unknown as CotacaoAlerta[];
  if (rows.length === 0) return { sent: 0, cotacoes: 0 };

  // Agrupar por responsável e enviar
  const byAssignee = new Map<string, CotacaoAlerta[]>();
  for (const row of rows) {
    const email = row.assignee_email || "admins";
    const list = byAssignee.get(email) || [];
    list.push(row);
    byAssignee.set(email, list);
  }

  let sent = 0;
  const admins = await getAdminEmails();

  for (const [email, cotacoes] of byAssignee) {
    const to = email === "admins" ? admins : [email];
    if (to.length === 0) continue;

    const res = await sendAlertEmail({
      to,
      subject: `📋 ${cotacoes.length} tratativa(s) agendada(s) para hoje/amanhã`,
      html: buildTratativaHtml(cotacoes),
    });
    if (res.success) sent++;
  }

  return { sent, cotacoes: rows.length };
}

// ─── 3. Alertas de Prazo (due_date = hoje) ─────────────────

async function alertasPrazo(): Promise<{ sent: number; cotacoes: number }> {
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

  let sent = 0;
  const admins = await getAdminEmails();

  for (const [email, cotacoes] of byAssignee) {
    const to = email === "admins" ? admins : [email];
    if (to.length === 0) continue;

    const res = await sendAlertEmail({
      to,
      subject: `⏰ ${cotacoes.length} cotação(ões) com prazo hoje`,
      html: buildPrazoHtml(cotacoes),
    });
    if (res.success) sent++;
  }

  return { sent, cotacoes: rows.length };
}

// ─── 4. Resumo Diário (admins) ─────────────────────────────

async function resumoDiario(): Promise<{ sent: number }> {
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

// ─── Handler ────────────────────────────────────────────────

async function handler(req: NextRequest) {
  const authError = verifyCron(req);
  if (authError) return authError;

  try {
    const [vigencia, tratativa, prazo, resumo] = await Promise.all([
      alertasVigencia(),
      alertasTratativa(),
      alertasPrazo(),
      resumoDiario(),
    ]);

    return apiSuccess({
      message: "Alertas processados com sucesso",
      vigencia,
      tratativa,
      prazo,
      resumo,
    });
  } catch (error) {
    console.error("API /api/cron/alertas:", error);
    return apiError("Erro ao executar alertas", 500);
  }
}

export async function POST(req: NextRequest) {
  return handler(req);
}

export async function GET(req: NextRequest) {
  return handler(req);
}
