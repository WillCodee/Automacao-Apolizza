import { NextRequest } from "next/server";
import { desc, or, isNull, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacaoNotificacoes } from "@/lib/schema";
import { getCurrentUser, isAdminOrProprietario } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    // Admins/proprietários: veem notificações globais (destinatario_id IS NULL)
    // Cotadores: veem apenas as suas (destinatario_id = user.id)
    const filter = isAdminOrProprietario(user.role)
      ? or(isNull(cotacaoNotificacoes.destinatarioId), eq(cotacaoNotificacoes.destinatarioId, user.id))
      : eq(cotacaoNotificacoes.destinatarioId, user.id);

    const rows = await db
      .select()
      .from(cotacaoNotificacoes)
      .where(filter)
      .orderBy(desc(cotacaoNotificacoes.createdAt))
      .limit(200);

    return apiSuccess(rows);
  } catch (error) {
    console.error("GET /api/notificacoes:", error);
    return apiError("Erro ao buscar notificacoes", 500);
  }
}

// PUT /api/notificacoes — marca todas as notificações do usuário como lidas
export async function PUT(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const filter = isAdminOrProprietario(user.role)
      ? and(
          or(isNull(cotacaoNotificacoes.destinatarioId), eq(cotacaoNotificacoes.destinatarioId, user.id)),
          eq(cotacaoNotificacoes.lida, false)
        )
      : and(
          eq(cotacaoNotificacoes.destinatarioId, user.id),
          eq(cotacaoNotificacoes.lida, false)
        );

    await db
      .update(cotacaoNotificacoes)
      .set({ lida: true })
      .where(filter);

    return apiSuccess({ ok: true });
  } catch (error) {
    console.error("PUT /api/notificacoes:", error);
    return apiError("Erro ao marcar notificacoes como lidas", 500);
  }
}
