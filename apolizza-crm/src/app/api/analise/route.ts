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
    const ano = searchParams.get("ano");
    const mes = searchParams.get("mes");

    const anoC = ano ? sql`AND c.ano_referencia = ${Number(ano)}` : sql``;
    const mesC = mes ? sql`AND c.mes_referencia = ${mes}` : sql``;
    const anoS = ano ? sql`AND ano_referencia = ${Number(ano)}` : sql``;
    const mesS = mes ? sql`AND mes_referencia = ${mes}` : sql``;

    const [cotadoresData, gruposData, statusData, situacaoData] = await Promise.all([
      // Por cotador
      dbQuery(sql`
        SELECT
          u.id,
          u.name,
          u.photo_url AS photoUrl,
          CAST(COUNT(c.id) AS SIGNED) AS total,
          CAST(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN 1 ELSE 0 END) AS SIGNED) AS fechadas,
          CAST(SUM(CASE WHEN LOWER(c.situacao) IN ('perda','perda/resgate') THEN 1 ELSE 0 END) AS SIGNED) AS perdas,
          CAST(SUM(CASE WHEN LOWER(c.situacao) NOT IN ('fechado','perda','perda/resgate') OR c.situacao IS NULL THEN 1 ELSE 0 END) AS SIGNED) AS emAnalise,
          COALESCE(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS ganhos,
          COALESCE(SUM(CASE WHEN LOWER(c.situacao) IN ('perda','perda/resgate') THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS perdasValor,
          COALESCE(SUM(CASE WHEN LOWER(c.situacao) NOT IN ('fechado','perda','perda/resgate') OR c.situacao IS NULL THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS analiseValor,
          ROUND(
            CAST(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN 1 ELSE 0 END) AS DECIMAL(12,2))
            / NULLIF(COUNT(c.id), 0) * 100, 1
          ) AS taxaConversao
        FROM users u
        LEFT JOIN cotacoes c
          ON c.assignee_id = u.id
          AND c.deleted_at IS NULL
          ${anoC} ${mesC}
        WHERE u.is_active = true AND u.role = 'cotador'
        GROUP BY u.id, u.name, u.photo_url
        ORDER BY ganhos DESC
      `),

      // Por grupo
      dbQuery(sql`
        SELECT
          g.id,
          g.nome,
          g.cor,
          CAST(COUNT(c.id) AS SIGNED) AS total,
          CAST(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN 1 ELSE 0 END) AS SIGNED) AS fechadas,
          CAST(SUM(CASE WHEN LOWER(c.situacao) IN ('perda','perda/resgate') THEN 1 ELSE 0 END) AS SIGNED) AS perdas,
          CAST(SUM(CASE WHEN LOWER(c.situacao) NOT IN ('fechado','perda','perda/resgate') OR c.situacao IS NULL THEN 1 ELSE 0 END) AS SIGNED) AS emAnalise,
          COALESCE(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS ganhos,
          COALESCE(SUM(CASE WHEN LOWER(c.situacao) IN ('perda','perda/resgate') THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS perdasValor,
          COALESCE(SUM(CASE WHEN LOWER(c.situacao) NOT IN ('fechado','perda','perda/resgate') OR c.situacao IS NULL THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS analiseValor,
          ROUND(
            CAST(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN 1 ELSE 0 END) AS DECIMAL(12,2))
            / NULLIF(COUNT(c.id), 0) * 100, 1
          ) AS taxaConversao
        FROM grupos_usuarios g
        LEFT JOIN grupo_membros gm ON gm.grupo_id = g.id
        LEFT JOIN cotacoes c
          ON c.assignee_id = gm.user_id
          AND c.deleted_at IS NULL
          ${anoC} ${mesC}
        GROUP BY g.id, g.nome, g.cor
        ORDER BY ganhos DESC
      `),

      // Por status
      dbQuery(sql`
        SELECT
          status,
          CAST(COUNT(*) AS SIGNED) AS total,
          COALESCE(SUM(CAST(a_receber AS DECIMAL(12,2))), 0) AS faturamento
        FROM cotacoes
        WHERE deleted_at IS NULL ${anoS} ${mesS}
        GROUP BY status
        ORDER BY total DESC
      `),

      // Por situacao
      dbQuery(sql`
        SELECT
          COALESCE(situacao, 'Sem situação') AS situacao,
          CAST(COUNT(*) AS SIGNED) AS total,
          COALESCE(SUM(CAST(a_receber AS DECIMAL(12,2))), 0) AS faturamento
        FROM cotacoes
        WHERE deleted_at IS NULL ${anoS} ${mesS}
        GROUP BY situacao
        ORDER BY total DESC
      `),
    ]);

    return apiSuccess({
      cotadores: cotadoresData,
      grupos: gruposData,
      porStatus: statusData,
      porSituacao: situacaoData,
    });
  } catch (error) {
    console.error("API GET /api/analise:", error);
    return apiError("Erro ao carregar analise", 500);
  }
}
