import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { dbQuery } from "@/lib/db";
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
    const [kpiRows, statusRows, monthlyRows, cotadoresRows] = await Promise.all([
      // KPIs from view
      dbQuery(sql`
        select
          CAST(coalesce(sum(total_cotacoes), 0) AS SIGNED) as totalCotacoes,
          CAST(coalesce(sum(fechadas), 0) AS SIGNED) as fechadas,
          CAST(coalesce(sum(perdas), 0) AS SIGNED) as perdas,
          CAST(coalesce(sum(em_andamento), 0) AS SIGNED) as emAndamento,
          coalesce(sum(total_a_receber), 0) as totalAReceber,
          coalesce(sum(total_valor_perda), 0) as totalValorPerda,
          coalesce(sum(total_premio), 0) as totalPremio,
          ROUND(
            CAST(coalesce(sum(fechadas), 0) AS DECIMAL(12,2))
            / nullif(coalesce(sum(total_cotacoes), 0), 0) * 100, 1
          ) as taxaConversao
        from vw_kpis
        where true ${anoFilter} ${mesFilter} ${userFilter}
      `),
      // Status breakdown from view
      dbQuery(sql`
        select
          status,
          CAST(sum(count) AS SIGNED) as count,
          sum(total) as total
        from vw_status_breakdown
        where true ${anoFilter} ${mesFilter} ${userFilter}
        group by status
        order by sum(count) desc
      `),
      // Monthly trend from view
      dbQuery(sql`
        select
          mes,
          ano,
          CAST(sum(fechadas) AS SIGNED) as fechadas,
          CAST(sum(perdas) AS SIGNED) as perdas,
          CAST(sum(total) AS SIGNED) as total,
          sum(a_receber) as aReceber
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
      // Cotadores — todos ativos, com LEFT JOIN nos dados do periodo
      isCotador
        ? Promise.resolve([] as Record<string, unknown>[])
        : dbQuery(sql`
            select
              u.id as userId,
              u.name,
              u.photo_url as photoUrl,
              CAST(coalesce(v.total_cotacoes, 0) AS SIGNED) as totalCotacoes,
              CAST(coalesce(v.fechadas, 0) AS SIGNED) as fechadas,
              CAST(coalesce(v.perdas, 0) AS SIGNED) as perdas,
              coalesce(v.faturamento, 0) as faturamento,
              coalesce(v.taxa_conversao, 0) as taxaConversao
            from users u
            left join (
              select
                user_id,
                CAST(coalesce(sum(total_cotacoes), 0) AS SIGNED) as total_cotacoes,
                CAST(coalesce(sum(fechadas), 0) AS SIGNED) as fechadas,
                CAST(coalesce(sum(perdas), 0) AS SIGNED) as perdas,
                coalesce(sum(faturamento), 0) as faturamento,
                ROUND(
                  CAST(coalesce(sum(fechadas), 0) AS DECIMAL(12,2))
                  / nullif(coalesce(sum(total_cotacoes), 0), 0) * 100, 1
                ) as taxa_conversao
              from vw_cotadores
              where true ${anoFilter} ${mesFilter}
              group by user_id
            ) v on v.user_id = u.id
            where u.is_active = true and u.role = 'cotador'
            order by coalesce(v.faturamento, 0) desc
          `),
    ]);

    const kpis = kpiRows[0] as Record<string, unknown>;

    return apiSuccess({
      kpis: {
        ...kpis,
        taxaConversao: kpis.taxaConversao ?? 0,
      },
      statusBreakdown: statusRows,
      monthlyTrend: monthlyRows,
      cotadores: cotadoresRows,
    });
  } catch (error) {
    console.error("API GET /api/dashboard:", error);
    return apiError("Erro ao carregar dashboard", 500);
  }
}
