import { NextRequest } from "next/server";
import { eq, and, isNull, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacoes, users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess, validateUuid } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { searchParams } = req.nextUrl;
    const assignee = searchParams.get("assignee");
    const urgencia = searchParams.get("urgencia"); // "15", "30", "60"
    const dateFrom = searchParams.get("dateFrom"); // YYYY-MM-DD
    const dateTo = searchParams.get("dateTo");     // YYYY-MM-DD

    if (!validateUuid(assignee)) return apiError("Assignee ID invalido", 400);

    const conditions = [
      isNull(cotacoes.deletedAt),
      isNotNull(cotacoes.fimVigencia),
      // Apenas renovações ou cotações com fim de vigência
      sql`(${cotacoes.isRenovacao} = true OR ${cotacoes.fimVigencia} IS NOT NULL)`,
    ];

    if (user.role === "cotador") {
      conditions.push(eq(cotacoes.assigneeId, user.id));
    } else if (assignee) {
      conditions.push(eq(cotacoes.assigneeId, assignee));
    }

    if (urgencia) {
      const dias = Number(urgencia);
      if ([15, 30, 60].includes(dias)) {
        conditions.push(sql`${cotacoes.fimVigencia}::date <= (CURRENT_DATE + ${dias}::int)`);
        conditions.push(sql`${cotacoes.fimVigencia}::date >= CURRENT_DATE`);
      }
    }

    if (dateFrom) {
      conditions.push(sql`${cotacoes.fimVigencia}::date >= ${dateFrom}::date`);
    }
    if (dateTo) {
      conditions.push(sql`${cotacoes.fimVigencia}::date <= ${dateTo}::date`);
    }

    const where = and(...conditions);

    const rows = await db
      .select({
        id: cotacoes.id,
        name: cotacoes.name,
        status: cotacoes.status,
        seguradora: cotacoes.seguradora,
        produto: cotacoes.produto,
        aReceber: cotacoes.aReceber,
        fimVigencia: cotacoes.fimVigencia,
        isRenovacao: cotacoes.isRenovacao,
        assigneeId: cotacoes.assigneeId,
        cotador: users.name,
      })
      .from(cotacoes)
      .leftJoin(users, eq(cotacoes.assigneeId, users.id))
      .where(where)
      .orderBy(sql`${cotacoes.fimVigencia} ASC`)
      .limit(500);

    // Calculate dias_para_vencer and KPIs
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let vencendo30 = 0;
    let renovadas = 0;
    let perdidas = 0;

    const data = rows.map((r) => {
      const fimDate = r.fimVigencia ? new Date(r.fimVigencia) : null;
      const diasParaVencer = fimDate
        ? Math.ceil((fimDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      if (diasParaVencer !== null && diasParaVencer <= 30 && diasParaVencer >= 0) vencendo30++;
      if (r.status === "fechado") renovadas++;
      if (r.status === "perda") perdidas++;

      return {
        ...r,
        aReceber: r.aReceber ? Number(r.aReceber) : null,
        diasParaVencer,
      };
    });

    return apiSuccess({
      renovacoes: data,
      kpis: {
        total: data.length,
        vencendo30,
        renovadas,
        perdidas,
      },
    });
  } catch (error) {
    console.error("API GET /api/renovacoes:", error);
    return apiError("Erro ao buscar renovacoes", 500);
  }
}
