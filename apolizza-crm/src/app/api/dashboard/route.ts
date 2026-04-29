import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db, dbQuery } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { searchParams } = req.nextUrl;
    const dateFrom = searchParams.get("dateFrom");
    const dateTo   = searchParams.get("dateTo");
    const ano      = searchParams.get("ano");
    const mes      = searchParams.get("mes");
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
          if (dFrom.getFullYear() !== dTo.getFullYear()) anoFilter = sql``;
        }
      }
    } else if (ano) {
      anoFilter = sql`and ano = ${Number(ano)}`;
      if (mes) mesFilter = sql`and mes = ${mes}`;
    }

    const userFilter = isCotador ? sql`and assignee_id = ${user.id}` : sql``;

    const [kpiRows, statusRows, monthlyRows, cotadoresRows] = await Promise.all([
      // KPIs — inclui colunas de renovação e novas
      dbQuery<Record<string, unknown>>(sql`
        select
          coalesce(sum(total_cotacoes), 0)+0                        as totalCotacoes,
          coalesce(sum(fechadas), 0)+0                              as fechadas,
          coalesce(sum(perdas), 0)+0                                as perdas,
          coalesce(sum(em_andamento), 0)+0                          as emAndamento,
          coalesce(sum(total_a_receber), 0)                         as totalAReceber,
          coalesce(sum(total_valor_perda), 0)                       as totalValorPerda,
          coalesce(sum(total_premio), 0)                            as totalPremio,
          ROUND(
            CAST(coalesce(sum(fechadas), 0) AS DECIMAL(12,2))
            / nullif(coalesce(sum(total_cotacoes), 0), 0) * 100, 1
          )                                                         as taxaConversao,

          -- Renovações
          coalesce(sum(total_renovacoes), 0)+0                      as totalRenovacoes,
          coalesce(sum(fechadas_renovacao), 0)+0                    as fechadasRenovacao,
          coalesce(sum(a_receber_renovacao), 0)                     as aReceberRenovacao,
          coalesce(sum(perdas_renovacao), 0)+0                      as perdasRenovacao,

          -- Novas
          coalesce(sum(total_novas), 0)+0                           as totalNovas,
          coalesce(sum(fechadas_novas), 0)+0                        as fechadasNovas,
          coalesce(sum(a_receber_novas), 0)                         as aReceberNovas

        from vw_kpis
        where true ${anoFilter} ${mesFilter} ${userFilter}
      `),

      // Status breakdown
      dbQuery<Record<string, unknown>>(sql`
        select
          status,
          sum(count)+0    as count,
          sum(total)      as total
        from vw_status_breakdown
        where true ${anoFilter} ${mesFilter} ${userFilter}
        group by status
        order by sum(count) desc
      `),

      // Monthly trend — inclui renovação e novas
      dbQuery<Record<string, unknown>>(sql`
        select
          mes,
          ano,
          sum(fechadas)+0              as fechadas,
          sum(perdas)+0                as perdas,
          sum(total)+0                 as total,
          sum(a_receber)               as aReceber,
          sum(fechadas_renovacao)+0    as fechadasRenovacao,
          sum(a_receber_renovacao)     as aReceberRenovacao,
          sum(fechadas_novas)+0        as fechadasNovas,
          sum(a_receber_novas)         as aReceberNovas
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

      // Cotadores — inclui renovação e novas
      isCotador
        ? Promise.resolve([] as Record<string, unknown>[])
        : dbQuery<Record<string, unknown>>(sql`
            select
              u.id                                                          as userId,
              u.name,
              u.photo_url                                                   as photoUrl,
              coalesce(v.total_cotacoes, 0)+0                              as totalCotacoes,
              coalesce(v.fechadas, 0)+0                                    as fechadas,
              coalesce(v.perdas, 0)+0                                      as perdas,
              coalesce(v.faturamento, 0)                                   as faturamento,
              coalesce(v.taxa_conversao, 0)                                as taxaConversao,
              coalesce(v.total_renovacoes, 0)+0                            as totalRenovacoes,
              coalesce(v.fechadas_renovacao, 0)+0                          as fechadasRenovacao,
              coalesce(v.faturamento_renovacao, 0)                         as faturamentoRenovacao,
              coalesce(v.fechadas_novas, 0)+0                              as fechadasNovas,
              coalesce(v.faturamento_novas, 0)                             as faturamentoNovas
            from users u
            left join (
              select
                user_id,
                coalesce(sum(total_cotacoes), 0)+0       as total_cotacoes,
                coalesce(sum(fechadas), 0)+0             as fechadas,
                coalesce(sum(perdas), 0)+0               as perdas,
                coalesce(sum(faturamento), 0)            as faturamento,
                ROUND(
                  CAST(coalesce(sum(fechadas), 0) AS DECIMAL(12,2))
                  / nullif(coalesce(sum(total_cotacoes), 0), 0) * 100, 1
                )                                        as taxa_conversao,
                coalesce(sum(total_renovacoes), 0)+0     as total_renovacoes,
                coalesce(sum(fechadas_renovacao), 0)+0   as fechadas_renovacao,
                coalesce(sum(faturamento_renovacao), 0)  as faturamento_renovacao,
                coalesce(sum(fechadas_novas), 0)+0       as fechadas_novas,
                coalesce(sum(faturamento_novas), 0)      as faturamento_novas
              from vw_cotadores
              where true ${anoFilter} ${mesFilter}
              group by user_id
            ) v on v.user_id = u.id
            where u.is_active = 1 and u.role in ('cotador', 'admin', 'proprietario')
            order by coalesce(v.faturamento, 0) desc
          `),
    ]);

    const kpis = kpiRows[0] as Record<string, unknown>;

    return apiSuccess({
      kpis: { ...kpis, taxaConversao: kpis.taxaConversao ?? 0 },
      statusBreakdown: statusRows,
      monthlyTrend: monthlyRows,
      cotadores: cotadoresRows,
    });
  } catch (error) {
    console.error("API GET /api/dashboard:", error);
    return apiError("Erro ao carregar dashboard", 500);
  }
}
