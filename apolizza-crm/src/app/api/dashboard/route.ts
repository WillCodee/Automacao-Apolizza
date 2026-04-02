import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess, validateMes, validateAno } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { searchParams } = req.nextUrl;
    const ano = searchParams.get("ano");
    const mes = searchParams.get("mes");
    const isCotador = user.role === "cotador";

    // Validate params (Story 10.2)
    if (!validateAno(ano)) return apiError("Ano invalido", 400);
    if (!validateMes(mes)) return apiError("Mes invalido", 400);

    const anoFilter = ano ? sql`and ano = ${Number(ano)}` : sql``;
    const mesFilter = mes ? sql`and mes = ${mes}` : sql``;
    const userFilter = isCotador ? sql`and assignee_id = ${user.id}` : sql``;

    // Story 10.5: Parallel queries with Promise.all
    const [kpiResult, statusResult, monthlyResult, cotadoresResult] = await Promise.all([
      // KPIs from view
      db.execute(sql`
        select
          coalesce(sum(total_cotacoes), 0)::int as "totalCotacoes",
          coalesce(sum(fechadas), 0)::int as "fechadas",
          coalesce(sum(perdas), 0)::int as "perdas",
          coalesce(sum(em_andamento), 0)::int as "emAndamento",
          coalesce(sum(total_a_receber), 0)::float as "totalAReceber",
          coalesce(sum(total_valor_perda), 0)::float as "totalValorPerda",
          coalesce(sum(total_premio), 0)::float as "totalPremio",
          round(
            coalesce(sum(fechadas), 0)::numeric
            / nullif(coalesce(sum(total_cotacoes), 0), 0) * 100, 1
          )::float as "taxaConversao"
        from vw_kpis
        where true ${anoFilter} ${mesFilter} ${userFilter}
      `),
      // Status breakdown from view
      db.execute(sql`
        select
          status,
          sum(count)::int as "count",
          sum(total)::float as "total"
        from vw_status_breakdown
        where true ${anoFilter} ${mesFilter} ${userFilter}
        group by status
        order by sum(count) desc
      `),
      // Monthly trend from view
      db.execute(sql`
        select
          mes,
          ano,
          sum(fechadas)::int as "fechadas",
          sum(perdas)::int as "perdas",
          sum(total)::int as "total",
          sum(a_receber)::float as "aReceber"
        from vw_monthly_trend
        where true ${userFilter}
        group by mes, ano
        order by ano asc, mes asc
      `),
      // Cotadores from view (admin only)
      isCotador
        ? Promise.resolve({ rows: [] })
        : db.execute(sql`
            select
              user_id as "userId",
              name,
              photo_url as "photoUrl",
              coalesce(sum(total_cotacoes), 0)::int as "totalCotacoes",
              coalesce(sum(fechadas), 0)::int as "fechadas",
              coalesce(sum(faturamento), 0)::float as "faturamento",
              round(
                coalesce(sum(fechadas), 0)::numeric
                / nullif(coalesce(sum(total_cotacoes), 0), 0) * 100, 1
              )::float as "taxaConversao"
            from vw_cotadores
            where true ${anoFilter} ${mesFilter}
            group by user_id, name, photo_url
            order by sum(faturamento) desc
          `),
    ]);

    const kpis = kpiResult.rows[0] as Record<string, unknown>;

    return apiSuccess({
      kpis: {
        ...kpis,
        taxaConversao: kpis.taxaConversao ?? 0,
      },
      statusBreakdown: statusResult.rows,
      monthlyTrend: monthlyResult.rows,
      cotadores: cotadoresResult.rows,
    });
  } catch (error) {
    console.error("API GET /api/dashboard:", error);
    return apiError("Erro ao carregar dashboard", 500);
  }
}
