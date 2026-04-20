import { NextRequest } from "next/server";
import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacoes } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess, validateMes, validateAno, validateUuid } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { searchParams } = req.nextUrl;
    const ano = searchParams.get("ano");
    const mes = searchParams.get("mes");
    const assignee = searchParams.get("assignee");

    // Param validation (Story 10.2)
    if (!validateAno(ano)) return apiError("Ano invalido", 400);
    if (!validateMes(mes)) return apiError("Mes invalido", 400);
    if (!validateUuid(assignee)) return apiError("Assignee ID invalido", 400);

    const conditions = [isNull(cotacoes.deletedAt)];

    if (user.role === "cotador") {
      conditions.push(eq(cotacoes.assigneeId, user.id));
    } else if (assignee) {
      conditions.push(eq(cotacoes.assigneeId, assignee));
    }

    if (ano) conditions.push(eq(cotacoes.anoReferencia, Number(ano)));
    if (mes) conditions.push(eq(cotacoes.mesReferencia, mes));

    const where = and(...conditions);

    const [result] = await db
      .select({
        totalCotacoes: sql<number>`CAST(count(*) AS SIGNED)`,
        fechadas: sql<number>`CAST(SUM(CASE WHEN ${cotacoes.status} = 'fechado' THEN 1 ELSE 0 END) AS SIGNED)`,
        perdas: sql<number>`CAST(SUM(CASE WHEN ${cotacoes.status} = 'perda' THEN 1 ELSE 0 END) AS SIGNED)`,
        totalAReceber: sql<number>`COALESCE(SUM(CASE WHEN ${cotacoes.status} = 'fechado' THEN CAST(${cotacoes.aReceber} AS DECIMAL(12,2)) ELSE 0 END), 0)`,
        totalValorPerda: sql<number>`COALESCE(SUM(CASE WHEN ${cotacoes.status} = 'perda' THEN CAST(${cotacoes.valorPerda} AS DECIMAL(12,2)) ELSE 0 END), 0)`,
        taxaConversao: sql<number>`ROUND(CAST(SUM(CASE WHEN ${cotacoes.status} = 'fechado' THEN 1 ELSE 0 END) AS DECIMAL(12,2)) / NULLIF(COUNT(*), 0) * 100, 1)`,
      })
      .from(cotacoes)
      .where(where);

    return apiSuccess({
      totalCotacoes: result.totalCotacoes,
      fechadas: result.fechadas,
      perdas: result.perdas,
      totalAReceber: result.totalAReceber,
      totalValorPerda: result.totalValorPerda,
      taxaConversao: result.taxaConversao ?? 0,
    });
  } catch (error) {
    console.error("API GET /api/kpis:", error);
    return apiError("Erro ao buscar KPIs", 500);
  }
}
