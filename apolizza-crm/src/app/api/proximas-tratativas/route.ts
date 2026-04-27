import { NextRequest } from "next/server";
import { and, isNull, isNotNull, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacoes, users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const conditions = [
      isNull(cotacoes.deletedAt),
      isNotNull(cotacoes.proximaTratativa),
    ];

    // Todos veem todas as próximas tratativas (colaboração)

    const rows = await db
      .select({
        id: cotacoes.id,
        name: cotacoes.name,
        status: cotacoes.status,
        produto: cotacoes.produto,
        seguradora: cotacoes.seguradora,
        proximaTratativa: cotacoes.proximaTratativa,
        priority: cotacoes.priority,
        assigneeId: cotacoes.assigneeId,
        assigneeName: users.name,
      })
      .from(cotacoes)
      .leftJoin(users, eq(cotacoes.assigneeId, users.id))
      .where(and(...conditions))
      .orderBy(asc(cotacoes.proximaTratativa))
      .limit(100);

    return apiSuccess(rows);
  } catch (err) {
    console.error("GET /api/proximas-tratativas:", err);
    return apiError("Erro interno", 500);
  }
}
