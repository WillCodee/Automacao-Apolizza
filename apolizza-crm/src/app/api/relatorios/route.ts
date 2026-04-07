import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess, validateMes, validateAno } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "admin") return apiError("Acesso negado", 403);

    const { searchParams } = req.nextUrl;
    const ano = searchParams.get("ano") || String(new Date().getFullYear());
    const mes = searchParams.get("mes") || null;
    const dateFrom = searchParams.get("dateFrom") || null; // YYYY-MM-DD
    const dateTo = searchParams.get("dateTo") || null;     // YYYY-MM-DD

    if (!validateAno(ano)) return apiError("Ano invalido", 400);
    if (!validateMes(mes)) return apiError("Mes invalido", 400);

    const anoNum = Number(ano);

    // Se dateFrom/dateTo fornecidos, filtra por created_at; senão mantém filtro por ano/mês referência
    let anoFilter = sql`and c.ano_referencia = ${anoNum}`;
    let mesFilter = mes ? sql`and c.mes_referencia = ${mes}` : sql``;
    let dateFilter = sql``;

    if (dateFrom || dateTo) {
      anoFilter = sql``;
      mesFilter = sql``;
      if (dateFrom) dateFilter = sql`${dateFilter} and c.created_at >= ${dateFrom}::timestamp`;
      if (dateTo) dateFilter = sql`${dateFilter} and c.created_at <= ${dateTo + " 23:59:59"}::timestamp`;
    }

    // Previous period for comparison
    const prevMesFilter = mes && !dateFrom && !dateTo
      ? (() => {
          const meses = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
          const idx = meses.indexOf(mes);
          if (idx <= 0) return { ano: anoNum - 1, mes: "DEZ" };
          return { ano: anoNum, mes: meses[idx - 1] };
        })()
      : null;

    const [kpisResult, prevKpisResult, rankingResult, seguradoraResult, produtoResult, evolucaoResult] = await Promise.all([
      // Current period KPIs
      db.execute(sql`
        select
          count(*)::int as "totalCotacoes",
          coalesce(sum(case when c.status = 'fechado' then 1 else 0 end), 0)::int as "fechadas",
          coalesce(sum(case when c.status = 'perda' then 1 else 0 end), 0)::int as "perdas",
          coalesce(sum(case when c.status not in ('fechado','perda','concluido ocultar') then 1 else 0 end), 0)::int as "emAndamento",
          coalesce(sum(case when c.status = 'fechado' then cast(c.a_receber as float) else 0 end), 0)::float as "totalAReceber",
          coalesce(sum(case when c.status = 'perda' then cast(c.valor_perda as float) else 0 end), 0)::float as "totalValorPerda"
        from cotacoes c
        where c.deleted_at is null ${anoFilter} ${mesFilter} ${dateFilter}
      `),
      // Previous period KPIs (for comparison)
      prevMesFilter
        ? db.execute(sql`
            select
              count(*)::int as "totalCotacoes",
              coalesce(sum(case when c.status = 'fechado' then 1 else 0 end), 0)::int as "fechadas",
              coalesce(sum(case when c.status = 'fechado' then cast(c.a_receber as float) else 0 end), 0)::float as "totalAReceber",
              coalesce(sum(case when c.status = 'perda' then cast(c.valor_perda as float) else 0 end), 0)::float as "totalValorPerda"
            from cotacoes c
            where c.deleted_at is null
              and c.ano_referencia = ${prevMesFilter.ano}
              and c.mes_referencia = ${prevMesFilter.mes}
          `)
        : Promise.resolve({ rows: [{ totalCotacoes: 0, fechadas: 0, totalAReceber: 0, totalValorPerda: 0 }] }),
      // Ranking cotadores
      db.execute(sql`
        select
          u.id as "userId",
          u.name,
          u.photo_url as "photoUrl",
          count(c.id)::int as "totalCotacoes",
          coalesce(sum(case when c.status = 'fechado' then 1 else 0 end), 0)::int as "fechadas",
          coalesce(sum(case when c.status = 'fechado' then cast(c.a_receber as float) else 0 end), 0)::float as "faturamento",
          round(
            coalesce(sum(case when c.status = 'fechado' then 1 else 0 end), 0)::numeric
            / nullif(count(c.id), 0) * 100, 1
          )::float as "taxaConversao"
        from cotacoes c
        join users u on u.id = c.assignee_id
        where c.deleted_at is null ${anoFilter} ${mesFilter} ${dateFilter}
        group by u.id, u.name, u.photo_url
        order by sum(case when c.status = 'fechado' then cast(c.a_receber as float) else 0 end) desc
      `),
      // Pipeline por seguradora
      db.execute(sql`
        select
          coalesce(c.seguradora, 'Nao informada') as "seguradora",
          count(*)::int as "total",
          coalesce(sum(case when c.status = 'fechado' then 1 else 0 end), 0)::int as "fechadas",
          coalesce(sum(case when c.status = 'fechado' then cast(c.a_receber as float) else 0 end), 0)::float as "valor"
        from cotacoes c
        where c.deleted_at is null ${anoFilter} ${mesFilter} ${dateFilter}
        group by coalesce(c.seguradora, 'Nao informada')
        order by sum(case when c.status = 'fechado' then cast(c.a_receber as float) else 0 end) desc nulls last
        limit 20
      `),
      // Pipeline por produto
      db.execute(sql`
        select
          coalesce(c.produto, 'Nao informado') as "produto",
          count(*)::int as "total",
          coalesce(sum(case when c.status = 'fechado' then 1 else 0 end), 0)::int as "fechadas",
          coalesce(sum(case when c.status = 'fechado' then cast(c.a_receber as float) else 0 end), 0)::float as "valor"
        from cotacoes c
        where c.deleted_at is null ${anoFilter} ${mesFilter} ${dateFilter}
        group by coalesce(c.produto, 'Nao informado')
        order by count(*) desc
        limit 20
      `),
      // Evolucao 12 meses
      db.execute(sql`
        select
          c.mes_referencia as "mes",
          c.ano_referencia as "ano",
          count(*)::int as "total",
          coalesce(sum(case when c.status = 'fechado' then 1 else 0 end), 0)::int as "fechadas",
          coalesce(sum(case when c.status = 'fechado' then cast(c.a_receber as float) else 0 end), 0)::float as "faturamento"
        from cotacoes c
        where c.deleted_at is null
          and c.ano_referencia is not null
          and c.mes_referencia is not null
        group by c.mes_referencia, c.ano_referencia
        order by c.ano_referencia asc, c.mes_referencia asc
      `),
    ]);

    const kpis = kpisResult.rows[0] as Record<string, number>;
    const prevKpis = prevKpisResult.rows[0] as Record<string, number>;

    return apiSuccess({
      kpis: {
        ...kpis,
        prev: prevKpis,
      },
      ranking: rankingResult.rows,
      pipelineSeguradora: seguradoraResult.rows,
      pipelineProduto: produtoResult.rows,
      evolucao: evolucaoResult.rows,
    });
  } catch (error) {
    console.error("API GET /api/relatorios:", error);
    return apiError("Erro ao gerar relatorio", 500);
  }
}
