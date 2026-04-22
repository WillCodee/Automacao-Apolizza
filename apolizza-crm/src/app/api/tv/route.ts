import { NextRequest } from "next/server";
import { sql, and, eq, isNull } from "drizzle-orm";
import { db, dbQuery } from "@/lib/db";
import { metas } from "@/lib/schema";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { normalizeRow, normalizeRows } from "@/lib/normalize";
import { mesFullName } from "@/lib/normalize";

const MES_ARR = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
const MES_NUM: Record<string, number> = {
  JAN:1, FEV:2, MAR:3, ABR:4, MAI:5, JUN:6,
  JUL:7, AGO:8, SET:9, OUT:10, NOV:11, DEZ:12,
};

// GET /api/tv?token=SECRET
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const expected = process.env.TV_TOKEN;

    if (!expected || !token || token !== expected) {
      return apiError("Token invalido", 401);
    }

    const now = new Date();
    const ano = now.getFullYear();
    const mes = MES_ARR[now.getMonth()];
    const mesFull = mesFullName(mes);
    const mesNum = MES_NUM[mes];

    const anoFilter = sql`and ano = ${ano}`;
    const mesFilter = sql`and mes = ${mes}`;

    const [kpiRows, statusRows, monthlyRows, cotadoresRows, semanasRows, metaEmpresaRows] = await Promise.all([
      // KPIs
      dbQuery<Record<string, unknown>>(sql`
        select
          coalesce(sum(total_cotacoes), 0)+0       as totalCotacoes,
          coalesce(sum(fechadas), 0)+0              as fechadas,
          coalesce(sum(perdas), 0)+0                as perdas,
          coalesce(sum(em_andamento), 0)+0          as emAndamento,
          coalesce(sum(total_a_receber), 0)         as totalAReceber,
          coalesce(sum(total_valor_perda), 0)       as totalValorPerda,
          coalesce(sum(total_premio), 0)            as totalPremio,
          ROUND(
            CAST(coalesce(sum(fechadas), 0) AS DECIMAL(12,2))
            / nullif(coalesce(sum(total_cotacoes), 0), 0) * 100, 1
          )                                         as taxaConversao,
          coalesce(sum(total_renovacoes), 0)+0      as totalRenovacoes,
          coalesce(sum(fechadas_renovacao), 0)+0    as fechadasRenovacao,
          coalesce(sum(a_receber_renovacao), 0)     as aReceberRenovacao,
          coalesce(sum(perdas_renovacao), 0)+0      as perdasRenovacao,
          coalesce(sum(total_novas), 0)+0           as totalNovas,
          coalesce(sum(fechadas_novas), 0)+0        as fechadasNovas,
          coalesce(sum(a_receber_novas), 0)         as aReceberNovas
        from vw_kpis
        where true ${anoFilter} ${mesFilter}
      `),

      // Status breakdown
      dbQuery<Record<string, unknown>>(sql`
        select
          status,
          sum(count)+0    as count,
          sum(total)      as total
        from vw_status_breakdown
        where true ${anoFilter} ${mesFilter}
        group by status
        order by sum(count) desc
      `),

      // Monthly trend (ano inteiro)
      dbQuery<Record<string, unknown>>(sql`
        select
          mes, ano,
          sum(fechadas)+0           as fechadas,
          sum(perdas)+0             as perdas,
          sum(total)+0              as total,
          sum(a_receber)            as aReceber,
          sum(fechadas_renovacao)+0 as fechadasRenovacao,
          sum(a_receber_renovacao)  as aReceberRenovacao,
          sum(fechadas_novas)+0     as fechadasNovas,
          sum(a_receber_novas)      as aReceberNovas
        from vw_monthly_trend
        where true ${anoFilter}
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

      // Cotadores
      dbQuery<Record<string, unknown>>(sql`
        select
          u.id as userId, u.name, u.photo_url as photoUrl,
          coalesce(v.total_cotacoes, 0)+0     as totalCotacoes,
          coalesce(v.fechadas, 0)+0           as fechadas,
          coalesce(v.perdas, 0)+0             as perdas,
          coalesce(v.faturamento, 0)          as faturamento,
          coalesce(v.taxa_conversao, 0)       as taxaConversao,
          coalesce(v.total_renovacoes, 0)+0   as totalRenovacoes,
          coalesce(v.fechadas_renovacao, 0)+0 as fechadasRenovacao,
          coalesce(v.faturamento_renovacao, 0) as faturamentoRenovacao,
          coalesce(v.fechadas_novas, 0)+0     as fechadasNovas,
          coalesce(v.faturamento_novas, 0)    as faturamentoNovas
        from users u
        left join (
          select user_id,
            coalesce(sum(total_cotacoes), 0)+0      as total_cotacoes,
            coalesce(sum(fechadas), 0)+0             as fechadas,
            coalesce(sum(perdas), 0)+0               as perdas,
            coalesce(sum(faturamento), 0)            as faturamento,
            ROUND(CAST(coalesce(sum(fechadas), 0) AS DECIMAL(12,2))
              / nullif(coalesce(sum(total_cotacoes), 0), 0) * 100, 1) as taxa_conversao,
            coalesce(sum(total_renovacoes), 0)+0     as total_renovacoes,
            coalesce(sum(fechadas_renovacao), 0)+0   as fechadas_renovacao,
            coalesce(sum(faturamento_renovacao), 0)  as faturamento_renovacao,
            coalesce(sum(fechadas_novas), 0)+0       as fechadas_novas,
            coalesce(sum(faturamento_novas), 0)      as faturamento_novas
          from vw_cotadores
          where true ${anoFilter} ${mesFilter}
          group by user_id
        ) v on v.user_id = u.id
        where u.is_active = 1 and u.role in ('cotador', 'proprietario')
        order by coalesce(v.faturamento, 0) desc
      `),

      // Semanas (progresso semanal)
      dbQuery<Record<string, unknown>>(sql`
        SELECT
          CASE
            WHEN DAY(created_at) <= 7  THEN 1
            WHEN DAY(created_at) <= 14 THEN 2
            WHEN DAY(created_at) <= 21 THEN 3
            ELSE 4
          END AS semana,
          COUNT(*) AS novas,
          SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN 1 ELSE 0 END) AS fechadas,
          SUM(CASE WHEN LOWER(situacao) IN ('perda','perda/resgate') THEN 1 ELSE 0 END) AS perdas,
          COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS ganho
        FROM cotacoes
        WHERE deleted_at IS NULL
          AND (UPPER(mes_referencia) = ${mesFull} OR UPPER(mes_referencia) = ${mes})
          AND ano_referencia = ${ano}
        GROUP BY 1
        ORDER BY 1
      `),

      // Meta empresa
      db.select().from(metas)
        .where(and(eq(metas.ano, ano), eq(metas.mes, mesNum), isNull(metas.userId)))
        .limit(1),
    ]);

    // Normalize
    const KPI_FIELDS = [
      "totalCotacoes","fechadas","perdas","emAndamento","totalAReceber",
      "totalValorPerda","totalPremio","taxaConversao","totalRenovacoes",
      "fechadasRenovacao","aReceberRenovacao","perdasRenovacao",
      "totalNovas","fechadasNovas","aReceberNovas",
    ];
    const MONTHLY_FIELDS = ["fechadas","perdas","total","aReceber","fechadasRenovacao","aReceberRenovacao","fechadasNovas","aReceberNovas"];
    const COTADOR_FIELDS = ["totalCotacoes","fechadas","perdas","faturamento","taxaConversao","totalRenovacoes","fechadasRenovacao","faturamentoRenovacao","fechadasNovas","faturamentoNovas"];

    const metaMensal = metaEmpresaRows[0]?.metaValor ? parseFloat(metaEmpresaRows[0].metaValor) : null;

    // Preenche 4 semanas com acumulado
    const semanasNorm = [1,2,3,4].map((s) => {
      const found = semanasRows.find((r) => Number(r.semana) === s);
      return {
        semana: s,
        novas: Number(found?.novas ?? 0),
        fechadas: Number(found?.fechadas ?? 0),
        perdas: Number(found?.perdas ?? 0),
        ganho: Number(found?.ganho ?? 0),
      };
    });

    let acum = 0;
    const semanas = semanasNorm.map((s) => {
      acum += s.ganho;
      return { ...s, ganhoAcumulado: parseFloat(acum.toFixed(2)) };
    });

    return apiSuccess({
      ano,
      mes,
      kpis: normalizeRow(kpiRows[0] as Record<string, unknown>, KPI_FIELDS),
      statusBreakdown: normalizeRows(statusRows, ["count", "total"]),
      monthlyTrend: normalizeRows(monthlyRows, MONTHLY_FIELDS),
      cotadores: normalizeRows(cotadoresRows, COTADOR_FIELDS),
      metaMensal,
      semanas,
    });
  } catch (error) {
    console.error("API GET /api/tv:", error);
    return apiError("Erro ao carregar dados TV", 500);
  }
}
