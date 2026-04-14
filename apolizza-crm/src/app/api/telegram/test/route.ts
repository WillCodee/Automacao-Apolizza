import { NextRequest } from "next/server";
import { getCurrentUser, isAdminOrProprietario } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { sendTelegram, registerWebhook } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("Nao autenticado", 401);
  if (!isAdminOrProprietario(user.role)) return apiError("Acesso negado", 403);

  const { action } = await req.json();

  if (action === "test") {
    const ok = await sendTelegram(
      `✅ *Conexão estabelecida!*\n\nAuditor Apolizza CRM conectado ao Telegram.\n👤 Testado por: ${user.name}`
    );
    if (!ok) return apiError("Falha ao enviar mensagem de teste. Verifique token e chat ID.", 500);
    return apiSuccess({ message: "Mensagem de teste enviada com sucesso!" });
  }

  if (action === "register_webhook") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://apolizza-crm.vercel.app";
    const webhookUrl = `${appUrl}/api/telegram/webhook`;
    const result = await registerWebhook(webhookUrl);
    if (!result.ok) return apiError(`Erro ao registrar webhook: ${result.description}`, 500);
    return apiSuccess({ message: `Webhook registrado em ${webhookUrl}` });
  }

  return apiError("Acao invalida", 400);
}
