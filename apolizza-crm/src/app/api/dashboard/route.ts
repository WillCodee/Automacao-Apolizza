import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { searchParams } = req.nextUrl;
    const dateFrom = searchParams.get("dateFrom"); // YYYY-MM-DD
    const dateTo = searchParams.get("dateTo");     // YYYY-MM-DD
    const ano = searchParams.get("ano");           // e.g. "2026"
    const mes = searchParams.get("mes");           // e.g. "JAN"
    const isCotador = user.role === "cotador";

    let anoFilter = sql``;
    let mesFilter = sql``;

    if (dateFrom) {
      const dFrom = new Date(dateFrom);
      anoFilter = sql`and ano = ${dFrom.getFullYear()}`;
      const mesNome = dFrom.toLocaleDateString("pt-BR", { month: "short" }).toUpperCase().replace(".", "");
      mesFilter = sql`and mes = ${mesNome}`;

      if (dateTo) {
        const dTo = new Date(dateTo);
        if (dFrom.getMonth() !== dTo.getMonth() || dFrom.getFullYear() !== dTo.getFullYear()) {
          mesFilter = sql``;
          if (dFrom.getFullYear() !== dTo.getFullYear()) {
            anoFilter = sql``;
          }
        }
      }
    } else if (ano) {
      anoFilter = sql`and ano = ${Number(ano)}`;
      if (mes) mesFilter = sql`and mes = ${mes}`;
    }

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
        where true ${anoFilter} ${userFilter}
        group by mes, ano
        order by ano asc,
          CASE mes
            WHEN 'JAN' THEN 1  WHEN 'FEV' THEN 2  WHEN 'MAR' THEN 3
            WHEN 'ABR' THEN 4  WHEN 'MAI' THEN 5  WHEN 'JUN' THEN 6
            WHEN 'JUL' THEN 7  WHEN 'AGO' THEN 8  WHEN 'SET' THEN 9
            WHEN 'OUT' THEN 10 WHEN 'NOV' THEN 11 WHEN 'DEZ' THEN 12
            ELSE 99
          END asc
      `),
      // Cotadores — todos ativos, com LEFT JOIN nos dados do período
      isCotador
        ? Promise.resolve({ rows: [] })
        : db.execute(sql`
            select
              u.id as "userId",
              u.name,
              u.photo_url as "photoUrl",
              coalesce(v.total_cotacoes, 0)::int as "totalCotacoes",
              coalesce(v.fechadas, 0)::int as "fechadas",
              coalesce(v.faturamento, 0)::float as "faturamento",
              coalesce(v.taxa_conversao, 0)::float as "taxaConversao"
            from users u
            left join (
              select
                user_id,
                coalesce(sum(total_cotacoes), 0)::int as total_cotacoes,
                coalesce(sum(fechadas), 0)::int as fechadas,
                coalesce(sum(faturamento), 0)::float as faturamento,
                round(
                  coalesce(sum(fechadas), 0)::numeric
                  / nullif(coalesce(sum(total_cotacoes), 0), 0) * 100, 1
                )::float as taxa_conversao
              from vw_cotadores
              where true ${anoFilter} ${mesFilter}
              group by user_id
            ) v on v.user_id = u.id
            where u.is_active = true and u.role = 'cotador'
            order by coalesce(v.faturamento, 0) desc
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
