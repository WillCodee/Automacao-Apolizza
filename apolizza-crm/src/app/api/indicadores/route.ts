import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { dbQuery } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { mesFullName } from "@/lib/normalize";

// GET /api/indicadores?ano=2026&mes=ABR
// Ranking por indicação (origem da venda) — campo `indicacao` agrupado por UPPER(TRIM(...))
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role === "cotador") return apiError("Sem permissao", 403);

    const { searchParams } = req.nextUrl;
    const ano = searchParams.get("ano");
    const mes = searchParams.get("mes");

    let anoFilter = sql``;
    let mesFilter = sql``;
    if (ano) anoFilter = sql`AND ano_referencia = ${Number(ano)}`;
    if (mes) {
      const mesFull = mesFullName(mes);
      mesFilter = sql`AND (UPPER(mes_referencia) = ${mes} OR UPPER(mes_referencia) = ${mesFull})`;
    }

    const rows = await dbQuery<Record<string, unknown>>(sql`
      SELECT
        UPPER(TRIM(indicacao)) AS indicacao,
        COUNT(*) + 0                                                                              AS total,
        SUM(CASE WHEN status = 'fechado' THEN 1 ELSE 0 END) + 0                                   AS fechadas,
        SUM(CASE WHEN status = 'perda' THEN 1 ELSE 0 END) + 0                                     AS perdas,
        SUM(CASE WHEN status NOT IN ('fechado','perda') THEN 1 ELSE 0 END) + 0                    AS em_andamento,
        ROUND(COALESCE(SUM(CASE WHEN status='fechado' THEN a_receber ELSE 0 END),0), 2)           AS a_receber,
        ROUND(COALESCE(SUM(CASE WHEN status='perda' THEN valor_perda ELSE 0 END),0), 2)           AS valor_perda,
        ROUND(COALESCE(SUM(CASE WHEN status NOT IN ('fechado','perda') THEN a_receber ELSE 0 END),0), 2) AS pipeline,
        ROUND(
          SUM(CASE WHEN status='fechado' THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0) * 100, 1
        ) AS taxa_conversao
      FROM cotacoes
      WHERE deleted_at IS NULL
        AND indicacao IS NOT NULL
        AND TRIM(indicacao) <> ''
        ${anoFilter}
        ${mesFilter}
      GROUP BY UPPER(TRIM(indicacao))
      ORDER BY a_receber DESC, total DESC
    `);

    return apiSuccess({ ranking: rows });
  } catch (error) {
    console.error("API GET /api/indicadores:", error);
    return apiError("Erro ao carregar indicadores", 500);
  }
}
