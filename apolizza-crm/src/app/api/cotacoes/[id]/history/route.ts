import { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacaoHistory, users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { id } = await params;

    const history = await db
      .select({
        id: cotacaoHistory.id,
        fieldName: cotacaoHistory.fieldName,
        oldValue: cotacaoHistory.oldValue,
        newValue: cotacaoHistory.newValue,
        changedAt: cotacaoHistory.changedAt,
        userName: users.name,
      })
      .from(cotacaoHistory)
      .leftJoin(users, eq(cotacaoHistory.userId, users.id))
      .where(eq(cotacaoHistory.cotacaoId, id))
      .orderBy(desc(cotacaoHistory.changedAt))
      .limit(50);

    return apiSuccess(history);
  } catch (error) {
    console.error("API GET /api/cotacoes/[id]/history:", error);
    return apiError("Erro ao buscar historico", 500);
  }
}
