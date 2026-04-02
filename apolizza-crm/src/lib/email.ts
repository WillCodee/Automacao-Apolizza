import { Resend } from "resend";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM || "alertas@apolizza.com";

// ─── Template HTML ──────────────────────────────────────────

function htmlWrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin:0; padding:0; background:#f4f6f9; font-family:'Poppins',Helvetica,Arial,sans-serif; }
    .container { max-width:600px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; }
    .header { background:linear-gradient(135deg,#1e293b,#0f172a); padding:24px; text-align:center; }
    .header h1 { color:#fff; margin:0; font-size:20px; }
    .header .subtitle { color:#03a4ed; font-size:13px; margin-top:4px; }
    .body { padding:24px; color:#334155; font-size:14px; line-height:1.6; }
    .badge { display:inline-block; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:600; color:#fff; }
    .badge-red { background:#ff695f; }
    .badge-blue { background:#03a4ed; }
    .badge-orange { background:#f59e0b; }
    table { width:100%; border-collapse:collapse; margin:12px 0; }
    th { background:#f1f5f9; text-align:left; padding:8px 12px; font-size:12px; color:#64748b; }
    td { padding:8px 12px; border-bottom:1px solid #e2e8f0; font-size:13px; }
    .footer { background:#f8fafc; padding:16px; text-align:center; font-size:11px; color:#94a3b8; }
    .kpi-grid { display:flex; gap:12px; flex-wrap:wrap; margin:12px 0; }
    .kpi-card { flex:1; min-width:120px; background:#f8fafc; border-radius:8px; padding:12px; text-align:center; }
    .kpi-card .value { font-size:28px; font-weight:700; color:#03a4ed; }
    .kpi-card .label { font-size:11px; color:#64748b; margin-top:4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Apolizza CRM</h1>
      <div class="subtitle">${title}</div>
    </div>
    <div class="body">${body}</div>
    <div class="footer">Enviado automaticamente pelo Apolizza CRM &mdash; não responda este email.</div>
  </div>
</body>
</html>`;
}

// ─── Cotação row type ───────────────────────────────────────

export interface CotacaoAlerta {
  id: string;
  name: string;
  status: string;
  seguradora?: string | null;
  due_date?: string | null;
  fim_vigencia?: string | null;
  proxima_tratativa?: string | null;
  assignee_name?: string | null;
  assignee_email?: string | null;
}

// ─── Helpers públicos ───────────────────────────────────────

export async function getAdminEmails(): Promise<string[]> {
  const result = await db.execute(sql`
    SELECT email FROM users
    WHERE role = 'admin' AND is_active = true
  `);
  return result.rows.map((r: Record<string, unknown>) => r.email as string);
}

export async function sendAlertEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY não configurada — email ignorado");
    return { success: false, error: "RESEND_API_KEY não configurada" };
  }

  try {
    const recipients = Array.isArray(to) ? to : [to];
    await resend.emails.send({
      from: FROM,
      to: recipients,
      subject,
      html,
    });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email] Erro ao enviar:", msg);
    return { success: false, error: msg };
  }
}

// ─── Templates de email ─────────────────────────────────────

function cotacaoTable(cotacoes: CotacaoAlerta[], extraCol?: { header: string; key: keyof CotacaoAlerta }): string {
  const rows = cotacoes
    .map(
      (c) =>
        `<tr>
          <td><strong>${c.name}</strong></td>
          <td>${c.seguradora || "—"}</td>
          <td>${c.assignee_name || "—"}</td>
          ${extraCol ? `<td>${(c[extraCol.key] as string) || "—"}</td>` : ""}
        </tr>`
    )
    .join("");

  return `<table>
    <tr>
      <th>Cotação</th>
      <th>Seguradora</th>
      <th>Responsável</th>
      ${extraCol ? `<th>${extraCol.header}</th>` : ""}
    </tr>
    ${rows}
  </table>`;
}

export function buildVigenciaHtml(groups: { label: string; badge: string; cotacoes: CotacaoAlerta[] }[]): string {
  const sections = groups
    .filter((g) => g.cotacoes.length > 0)
    .map(
      (g) =>
        `<h3><span class="badge ${g.badge}">${g.label}</span> — ${g.cotacoes.length} cotação(ões)</h3>
        ${cotacaoTable(g.cotacoes, { header: "Fim Vigência", key: "fim_vigencia" })}`
    )
    .join("");

  return htmlWrapper("Alerta de Vigência", sections || "<p>Nenhuma cotação com vigência próxima.</p>");
}

export function buildTratativaHtml(cotacoes: CotacaoAlerta[]): string {
  const body = cotacoes.length
    ? `<p>Você tem <strong>${cotacoes.length}</strong> tratativa(s) agendada(s) para hoje/amanhã:</p>
       ${cotacaoTable(cotacoes, { header: "Próx. Tratativa", key: "proxima_tratativa" })}`
    : "<p>Nenhuma tratativa pendente.</p>";

  return htmlWrapper("Alerta de Tratativa", body);
}

export function buildPrazoHtml(cotacoes: CotacaoAlerta[]): string {
  const body = cotacoes.length
    ? `<p>Você tem <strong>${cotacoes.length}</strong> cotação(ões) com prazo hoje:</p>
       ${cotacaoTable(cotacoes, { header: "Prazo", key: "due_date" })}`
    : "<p>Nenhuma cotação com prazo hoje.</p>";

  return htmlWrapper("Alerta de Prazo", body);
}

export function buildResumoHtml(kpis: {
  novas_hoje: number;
  atrasadas: number;
  fechadas_hoje: number;
  vencendo_30d: number;
}): string {
  const body = `
    <p>Resumo do dia:</p>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="value">${kpis.novas_hoje}</div>
        <div class="label">Novas hoje</div>
      </div>
      <div class="kpi-card">
        <div class="value" style="color:#ff695f">${kpis.atrasadas}</div>
        <div class="label">Atrasadas</div>
      </div>
      <div class="kpi-card">
        <div class="value" style="color:#22c55e">${kpis.fechadas_hoje}</div>
        <div class="label">Fechadas hoje</div>
      </div>
      <div class="kpi-card">
        <div class="value" style="color:#f59e0b">${kpis.vencendo_30d}</div>
        <div class="label">Vencendo em 30d</div>
      </div>
    </div>`;

  return htmlWrapper("Resumo Diário", body);
}
