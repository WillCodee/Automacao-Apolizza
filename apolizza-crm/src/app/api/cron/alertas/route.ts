import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { dbQuery } from "@/lib/db";
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

// --- Auth helper ---

function verifyCron(req: NextRequest): Response | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return apiError("CRON_SECRET nao configurado", 500);

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) return apiError("Nao autorizado", 401);

  return null;
}

// --- 1. Alertas de Vigencia (60/30/15 dias) ---

async function alertasVigencia(): Promise<{ sent: number; cotacoes: number }> {
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

  // Agrupar por faixa
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

  const html = buildVigenciaHtml(groups);
  const admins = await getAdminEmails();

  // Enviar para admins
  let sent = 0;
  if (admins.length > 0) {
    const res = await sendAlertEmail({
      to: admins,
      subject: `\u26a0\ufe0f ${rows.length} cota\u00e7\u00e3o(\u00f5es) com vig\u00eancia pr\u00f3xima`,
      html,
    });
    if (res.success) sent++;
  }

  // Enviar para cada responsavel suas proprias cotacoes
  const byAssignee = new Map<string, CotacaoAlerta[]>();
  for (const row of rows) {
    if (row.assignee_email) {
      const list = byAssignee.get(row.assignee_email) || [];
      list.push(row);
      byAssignee.set(row.assignee_email, list);
    }
  }

  for (const [email, cotacoes] of byAssignee) {
    if (admins.includes(email)) continue; // ja recebeu o consolidado
    const personalGroups = [
      { label: "At\u00e9 15 dias", badge: "badge-red", cotacoes: [] as CotacaoAlerta[] },
      { label: "16\u201330 dias", badge: "badge-orange", cotacoes: [] as CotacaoAlerta[] },
      { label: "31\u201360 dias", badge: "badge-blue", cotacoes: [] as CotacaoAlerta[] },
    ];
    for (const c of cotacoes) {
      const fv = new Date(c.fim_vigencia!);
      if (fv <= d15) personalGroups[0].cotacoes.push(c);
      else if (fv <= d30) personalGroups[1].cotacoes.push(c);
      else personalGroups[2].cotacoes.push(c);
    }
    const res = await sendAlertEmail({
      to: email,
      subject: `\u26a0\ufe0f ${cotacoes.length} cota\u00e7\u00e3o(\u00f5es) com vig\u00eancia pr\u00f3xima`,
      html: buildVigenciaHtml(personalGroups),
    });
    if (res.success) sent++;
  }

  return { sent, cotacoes: rows.length };
}

// --- 2. Alertas de Tratativa (hoje/amanha) ---

async function alertasTratativa(): Promise<{ sent: number; cotacoes: number }> {
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

  // Agrupar por responsavel e enviar
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
      subject: `\ud83d\udccb ${cotacoes.length} tratativa(s) agendada(s) para hoje/amanh\u00e3`,
      html: buildTratativaHtml(cotacoes),
    });
    if (res.success) sent++;
  }

  return { sent, cotacoes: rows.length };
}

// --- 3. Alertas de Prazo (due_date = hoje) ---

async function alertasPrazo(): Promise<{ sent: number; cotacoes: number }> {
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

  let sent = 0;
  const admins = await getAdminEmails();

  for (const [email, cotacoes] of byAssignee) {
    const to = email === "admins" ? admins : [email];
    if (to.length === 0) continue;

    const res = await sendAlertEmail({
      to,
      subject: `\u23f0 ${cotacoes.length} cota\u00e7\u00e3o(\u00f5es) com prazo hoje`,
      html: buildPrazoHtml(cotacoes),
    });
    if (res.success) sent++;
  }

  return { sent, cotacoes: rows.length };
}

// --- 4. Resumo Diario (admins) ---

async function resumoDiario(): Promise<{ sent: number }> {
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
