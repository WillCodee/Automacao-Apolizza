import { db } from "@/lib/db";
import { statusConfig } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { asc } from "drizzle-orm";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const rows = await db
      .select()
      .from(statusConfig)
      .orderBy(asc(statusConfig.orderIndex));

    return apiSuccess(rows);
  } catch (error) {
    console.error("API GET /api/status-config:", error);
    return apiError("Erro ao listar configuracoes de status", 500);
  }
}
