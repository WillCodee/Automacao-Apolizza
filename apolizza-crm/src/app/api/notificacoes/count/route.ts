import { NextRequest } from "next/server";
import { or, isNull, eq, and, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacaoNotificacoes } from "@/lib/schema";
import { getCurrentUser, isAdminOrProprietario } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

// GET /api/notificacoes/count — retorna total de notificações não lidas do usuário atual
export async function GET(_req: NextRequest) {
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

    const [{ total }] = await db
      .select({ total: count() })
      .from(cotacaoNotificacoes)
      .where(filter);

    return apiSuccess({ count: Number(total) });
  } catch (error) {
    console.error("GET /api/notificacoes/count:", error);
    return apiError("Erro ao contar notificacoes", 500);
  }
}
