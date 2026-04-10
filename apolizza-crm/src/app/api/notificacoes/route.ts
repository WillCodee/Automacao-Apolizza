import { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacaoNotificacoes } from "@/lib/schema";
import { getCurrentUser, isAdminOrProprietario } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (!isAdminOrProprietario(user.role)) return apiError("Acesso negado", 403);

    const rows = await db
      .select()
      .from(cotacaoNotificacoes)
      .orderBy(desc(cotacaoNotificacoes.createdAt))
      .limit(200);

    return apiSuccess(rows);
  } catch (error) {
    console.error("GET /api/notificacoes:", error);
    return apiError("Erro ao buscar notificacoes", 500);
  }
}
