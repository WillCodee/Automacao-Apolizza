import { NextResponse } from "next/server";
import { getCurrentUser, isAdminOrProprietario } from "@/lib/auth-helpers";
import { apiError } from "@/lib/api-helpers";

const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("Nao autenticado", 401);
  if (!isAdminOrProprietario(user.role)) return apiError("Acesso negado", 403);

  const tokenSet = !!process.env.TELEGRAM_BOT_TOKEN;
  const chatIdSet = !!process.env.TELEGRAM_CHAT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://apolizza-crm.vercel.app";

  // Verifica se o token é válido chamando getMe
  let botInfo: Record<string, unknown> | null = null;
  let botError: string | null = null;
  try {
    const r = await fetch(`${BASE}/getMe`);
    const j = await r.json();
    if (j.ok) botInfo = j.result;
    else botError = j.description;
  } catch (e) {
    botError = String(e);
  }

  // Verifica qual webhook está registrado no Telegram
  let webhookInfo: Record<string, unknown> | null = null;
  let webhookError: string | null = null;
  try {
    const r = await fetch(`${BASE}/getWebhookInfo`);
    const j = await r.json();
    if (j.ok) webhookInfo = j.result;
    else webhookError = j.description;
  } catch (e) {
    webhookError = String(e);
  }

  const expectedWebhook = `${appUrl}/api/telegram/webhook`;
  const currentWebhook = (webhookInfo?.url as string) || "";
  const webhookOk = currentWebhook === expectedWebhook;

  return NextResponse.json({
    env: {
      TELEGRAM_BOT_TOKEN: tokenSet ? "✅ definido" : "❌ NÃO DEFINIDO",
      TELEGRAM_CHAT_ID: chatIdSet ? "✅ definido" : "❌ NÃO DEFINIDO",
      NEXT_PUBLIC_APP_URL: appUrl,
    },
    bot: botInfo
      ? { ok: true, username: botInfo.username, name: botInfo.first_name }
      : { ok: false, error: botError },
    webhook: {
      esperado: expectedWebhook,
      atual: currentWebhook || "(nenhum registrado)",
      ok: webhookOk ? "✅ correto" : "❌ DIFERENTE — precisa registrar",
      pendingUpdateCount: webhookInfo?.pending_update_count ?? 0,
      lastError: webhookInfo?.last_error_message || null,
    },
  });
}
