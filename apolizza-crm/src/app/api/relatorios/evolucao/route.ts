import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "admin" && user.role !== "proprietario") return apiError("Acesso negado", 403);

    const { searchParams } = req.nextUrl;
    const anosParam = searchParams.get("anos") || String(new Date().getFullYear());

    // Valida e sanitiza — apenas inteiros no range aceitável
    const anos = anosParam
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 2000 && n <= 2100);

    if (anos.length === 0) return apiError("Nenhum ano valido informado", 400);
    if (anos.length > 10) return apiError("Maximo 10 anos por consulta", 400);

    // Constrói lista segura de inteiros para o IN (já validados acima)
    const anosLiteral = anos.join(",");

    const result = await db.execute(sql`
      select
        c.ano_referencia::int  as "ano",
        c.mes_referencia       as "mes",
        count(*)::int          as "total",
        coalesce(sum(case when c.status = 'fechado' then 1 else 0 end), 0)::int   as "fechadas",
        coalesce(sum(case when c.status = 'fechado' then cast(c.a_receber as float) else 0 end), 0)::float as "faturamento"
      from cotacoes c
      where c.deleted_at is null
        and c.ano_referencia in (${sql.raw(anosLiteral)})
        and c.mes_referencia is not null
      group by c.ano_referencia, c.mes_referencia
      order by c.ano_referencia, c.mes_referencia
    `);

    return apiSuccess({ evolucao: result.rows });
  } catch (error) {
    console.error("API GET /api/relatorios/evolucao:", error);
    return apiError("Erro ao buscar evolucao", 500);
  }
}
