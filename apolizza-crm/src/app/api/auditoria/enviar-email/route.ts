import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { sendAlertEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "proprietario")) {
      return apiError("Sem permissão", 403);
    }

    const { email, assunto, resultado } = await req.json();
    if (!email || !resultado) return apiError("Email e resultado são obrigatórios", 400);

    const subject = assunto || `📋 Consulta Auditoria — Apolizza CRM`;

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: 'Poppins', Arial, sans-serif; background: #f0f4f8; margin: 0; padding: 20px; }
  .card { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 28px 32px; }
  .header h1 { color: #fff; margin: 0; font-size: 20px; font-weight: 700; }
  .header p { color: #94a3b8; margin: 4px 0 0; font-size: 13px; }
  .body { padding: 28px 32px; }
  .label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  .result-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; font-family: monospace; font-size: 13px; color: #1e293b; white-space: pre-wrap; word-break: break-word; line-height: 1.6; }
  .meta { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; gap: 24px; flex-wrap: wrap; }
  .meta-item { font-size: 12px; color: #64748b; }
  .meta-item strong { color: #1e293b; display: block; font-size: 13px; }
  .footer { background: #f8fafc; padding: 16px 32px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🔍 Auditoria Apolizza CRM</h1>
      <p>Resultado da consulta solicitada</p>
    </div>
    <div class="body">
      <div class="label">Resultado</div>
      <div class="result-box">${resultado.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      <div class="meta">
        <div class="meta-item">
          <strong>${user.name || "Usuário"}</strong>
          Solicitado por
        </div>
        <div class="meta-item">
          <strong>${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</strong>
          Data e hora
        </div>
      </div>
    </div>
    <div class="footer">Enviado automaticamente pelo sistema Apolizza CRM</div>
  </div>
</body>
</html>`;

    const result = await sendAlertEmail({ to: email, subject, html });
    if (!result.success) {
      console.error("Email error:", result.error);
      return apiError("Falha ao enviar email: " + result.error, 500);
    }

    return apiSuccess({ ok: true });
  } catch (err) {
    console.error("POST /api/auditoria/enviar-email:", err);
    return apiError("Erro interno", 500);
  }
}
