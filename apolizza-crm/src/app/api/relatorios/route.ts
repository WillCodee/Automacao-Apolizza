import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { dbQuery } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess, validateAno } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "admin" && user.role !== "proprietario") return apiError("Acesso negado", 403);

    const { searchParams } = req.nextUrl;
    const ano = searchParams.get("ano") || String(new Date().getFullYear());

    if (!validateAno(ano)) return apiError("Ano invalido", 400);

    const anoNum = Number(ano);
    const anoAnterior = anoNum - 1;

    const anoFilter = sql`and c.ano_referencia = ${anoNum}`;

    const [kpisRows, prevKpisRows, rankingRows, seguradoraRows, produtoRows, evolucaoRows] = await Promise.all([
      // KPIs do ano selecionado
      dbQuery(sql`
        select
          CAST(count(*) AS SIGNED) as totalCotacoes,
          CAST(coalesce(sum(case when c.status = 'fechado' then 1 else 0 end), 0) AS SIGNED) as fechadas,
          CAST(coalesce(sum(case when c.status = 'perda' then 1 else 0 end), 0) AS SIGNED) as perdas,
          CAST(coalesce(sum(case when c.status not in ('fechado','perda','concluido ocultar') then 1 else 0 end), 0) AS SIGNED) as emAndamento,
          coalesce(sum(case when c.status = 'fechado' then cast(c.a_receber as decimal(12,2)) else 0 end), 0) as totalAReceber,
          coalesce(sum(case when c.status = 'perda' then cast(c.valor_perda as decimal(12,2)) else 0 end), 0) as totalValorPerda
        from cotacoes c
        where c.deleted_at is null ${anoFilter}
      `),
      // KPIs do ano anterior (comparacao)
      dbQuery(sql`
        select
          CAST(count(*) AS SIGNED) as totalCotacoes,
          CAST(coalesce(sum(case when c.status = 'fechado' then 1 else 0 end), 0) AS SIGNED) as fechadas,
          coalesce(sum(case when c.status = 'fechado' then cast(c.a_receber as decimal(12,2)) else 0 end), 0) as totalAReceber,
          coalesce(sum(case when c.status = 'perda' then cast(c.valor_perda as decimal(12,2)) else 0 end), 0) as totalValorPerda
        from cotacoes c
        where c.deleted_at is null
          and c.ano_referencia = ${anoAnterior}
      `),
      // Ranking cotadores
      dbQuery(sql`
        select
          u.id as userId,
          u.name,
          u.photo_url as photoUrl,
          CAST(count(c.id) AS SIGNED) as totalCotacoes,
          CAST(coalesce(sum(case when c.status = 'fechado' then 1 else 0 end), 0) AS SIGNED) as fechadas,
          coalesce(sum(case when c.status = 'fechado' then cast(c.a_receber as decimal(12,2)) else 0 end), 0) as faturamento,
          ROUND(
            CAST(coalesce(sum(case when c.status = 'fechado' then 1 else 0 end), 0) AS DECIMAL(12,2))
            / nullif(count(c.id), 0) * 100, 1
          ) as taxaConversao
        from cotacoes c
        join users u on u.id = c.assignee_id
        where c.deleted_at is null ${anoFilter}
        group by u.id, u.name, u.photo_url
        order by sum(case when c.status = 'fechado' then cast(c.a_receber as decimal(12,2)) else 0 end) desc
      `),
      // Pipeline por seguradora
      dbQuery(sql`
        select
          coalesce(c.seguradora, 'Nao informada') as seguradora,
          CAST(count(*) AS SIGNED) as total,
          CAST(coalesce(sum(case when c.status = 'fechado' then 1 else 0 end), 0) AS SIGNED) as fechadas,
          coalesce(sum(case when c.status = 'fechado' then cast(c.a_receber as decimal(12,2)) else 0 end), 0) as valor
        from cotacoes c
        where c.deleted_at is null ${anoFilter}
        group by coalesce(c.seguradora, 'Nao informada')
        order by sum(case when c.status = 'fechado' then cast(c.a_receber as decimal(12,2)) else 0 end) desc
        limit 20
      `),
      // Pipeline por produto
      dbQuery(sql`
        select
          coalesce(c.produto, 'Nao informado') as produto,
          CAST(count(*) AS SIGNED) as total,
          CAST(coalesce(sum(case when c.status = 'fechado' then 1 else 0 end), 0) AS SIGNED) as fechadas,
          coalesce(sum(case when c.status = 'fechado' then cast(c.a_receber as decimal(12,2)) else 0 end), 0) as valor
        from cotacoes c
        where c.deleted_at is null ${anoFilter}
        group by coalesce(c.produto, 'Nao informado')
        order by count(*) desc
        limit 20
      `),
      // Evolucao mensal — apenas o ano selecionado, todos os meses com dados
      dbQuery(sql`
        select
          c.mes_referencia as mes,
          CAST(count(*) AS SIGNED) as total,
          CAST(coalesce(sum(case when c.status = 'fechado' then 1 else 0 end), 0) AS SIGNED) as fechadas,
          coalesce(sum(case when c.status = 'fechado' then cast(c.a_receber as decimal(12,2)) else 0 end), 0) as faturamento
        from cotacoes c
        where c.deleted_at is null
          and c.ano_referencia = ${anoNum}
          and c.mes_referencia is not null
        group by c.mes_referencia
      `),
    ]);

    const kpis = kpisRows[0] as Record<string, number>;
    const prevKpis = prevKpisRows[0] as Record<string, number>;

    return apiSuccess({
      kpis: {
        ...kpis,
        prev: prevKpis,
      },
      ranking: rankingRows,
      pipelineSeguradora: seguradoraRows,
      pipelineProduto: produtoRows,
      evolucao: evolucaoRows,
    });
  } catch (error) {
    console.error("API GET /api/relatorios:", error);
    return apiError("Erro ao gerar relatorio", 500);
  }
}
