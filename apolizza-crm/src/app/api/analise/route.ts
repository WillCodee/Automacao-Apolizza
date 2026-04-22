import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { dbQuery } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { mesFullName } from "@/lib/normalize";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { searchParams } = req.nextUrl;
    const ano = searchParams.get("ano");
    const mes = searchParams.get("mes");

    const anoC = ano ? sql`AND c.ano_referencia = ${Number(ano)}` : sql``;
    const mesC = mes ? sql`AND (UPPER(c.mes_referencia) = ${mesFullName(mes)} OR UPPER(c.mes_referencia) = ${mes.toUpperCase()})` : sql``;
    const anoS = ano ? sql`AND ano_referencia = ${Number(ano)}` : sql``;
    const mesS = mes ? sql`AND (UPPER(mes_referencia) = ${mesFullName(mes)} OR UPPER(mes_referencia) = ${mes.toUpperCase()})` : sql``;

    const [cotadoresRows, gruposRows, statusRows, situacaoRows] = await Promise.all([

      // ── Por cotador ──────────────────────────────────────────────────────────
      dbQuery(sql`
        SELECT
          u.id,
          u.name,
          u.photo_url                                                                AS photoUrl,
          CAST(COUNT(c.id) AS SIGNED)                                                AS total,
          CAST(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN 1 ELSE 0 END) AS SIGNED) AS fechadas,
          CAST(SUM(CASE WHEN LOWER(c.situacao) IN ('perda','perda/resgate') OR c.status = 'perda' THEN 1 ELSE 0 END) AS SIGNED) AS perdas,
          CAST(SUM(CASE WHEN (LOWER(c.situacao) NOT IN ('fechado','perda','perda/resgate') OR c.situacao IS NULL) AND c.status != 'perda' THEN 1 ELSE 0 END) AS SIGNED) AS emAnalise,
          CAST(COALESCE(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS DECIMAL(12,2)) AS ganhos,
          CAST(COALESCE(SUM(CASE WHEN LOWER(c.situacao) IN ('perda','perda/resgate') OR c.status = 'perda' THEN CAST(c.valor_perda AS DECIMAL(12,2)) ELSE 0 END), 0) AS DECIMAL(12,2)) AS perdasValor,
          CAST(COALESCE(SUM(CASE WHEN (LOWER(c.situacao) NOT IN ('fechado','perda','perda/resgate') OR c.situacao IS NULL) AND c.status != 'perda' THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS DECIMAL(12,2)) AS analiseValor,
          ROUND(
            SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN 1 ELSE 0 END)
            / NULLIF(COUNT(c.id), 0) * 100, 1
          ) AS taxaConversao,

          -- Renovações (tipo_cliente = 'RENOVAÇÃO' ou is_renovacao = true)
          CAST(SUM(CASE WHEN (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true) THEN 1 ELSE 0 END) AS SIGNED) AS totalRenovacoes,
          CAST(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' AND (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true) THEN 1 ELSE 0 END) AS SIGNED) AS fechadasRenovacao,
          CAST(COALESCE(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' AND (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true) THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS DECIMAL(12,2)) AS ganhosRenovacao,
          CAST(SUM(CASE WHEN LOWER(c.situacao) IN ('perda','perda/resgate') OR c.status = 'perda' AND (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true) THEN 1 ELSE 0 END) AS SIGNED) AS perdasRenovacao,

          -- Novas (não renovação)
          CAST(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' AND NOT (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true) THEN 1 ELSE 0 END) AS SIGNED) AS fechadasNovas,
          CAST(COALESCE(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' AND NOT (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true) THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS DECIMAL(12,2)) AS ganhosNovas

        FROM users u
        LEFT JOIN cotacoes c
          ON c.assignee_id = u.id
          AND c.deleted_at IS NULL
          ${anoC} ${mesC}
        WHERE u.is_active = true
          AND u.name NOT IN ('Suporte', 'Gustavo')
        GROUP BY u.id, u.name, u.photo_url

        UNION ALL

        SELECT
          NULL AS id,
          'Pedidos'  AS name,
          NULL       AS photoUrl,
          CAST(COUNT(*) AS SIGNED) AS total,
          CAST(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN 1 ELSE 0 END) AS SIGNED) AS fechadas,
          CAST(SUM(CASE WHEN LOWER(situacao) IN ('perda','perda/resgate') OR status = 'perda' THEN 1 ELSE 0 END) AS SIGNED) AS perdas,
          CAST(SUM(CASE WHEN (LOWER(situacao) NOT IN ('fechado','perda','perda/resgate') OR situacao IS NULL) AND status != 'perda' THEN 1 ELSE 0 END) AS SIGNED) AS emAnalise,
          CAST(COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS DECIMAL(12,2)) AS ganhos,
          CAST(COALESCE(SUM(CASE WHEN LOWER(situacao) IN ('perda','perda/resgate') OR status = 'perda' THEN CAST(valor_perda AS DECIMAL(12,2)) ELSE 0 END), 0) AS DECIMAL(12,2)) AS perdasValor,
          CAST(COALESCE(SUM(CASE WHEN (LOWER(situacao) NOT IN ('fechado','perda','perda/resgate') OR situacao IS NULL) AND status != 'perda' THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS DECIMAL(12,2)) AS analiseValor,
          ROUND(
            SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN 1 ELSE 0 END)
            / NULLIF(COUNT(*), 0) * 100, 1
          ) AS taxaConversao,
          CAST(SUM(CASE WHEN (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = true) THEN 1 ELSE 0 END) AS SIGNED) AS totalRenovacoes,
          CAST(SUM(CASE WHEN LOWER(situacao) = 'fechado' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = true) THEN 1 ELSE 0 END) AS SIGNED) AS fechadasRenovacao,
          CAST(COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = true) THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS DECIMAL(12,2)) AS ganhosRenovacao,
          CAST(SUM(CASE WHEN LOWER(situacao) IN ('perda','perda/resgate') OR status = 'perda' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = true) THEN 1 ELSE 0 END) AS SIGNED) AS perdasRenovacao,
          CAST(SUM(CASE WHEN LOWER(situacao) = 'fechado' AND NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = true) THEN 1 ELSE 0 END) AS SIGNED) AS fechadasNovas,
          CAST(COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' AND NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = true) THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS DECIMAL(12,2)) AS ganhosNovas

        FROM cotacoes
        WHERE assignee_id IS NULL AND deleted_at IS NULL ${anoS} ${mesS}
        ORDER BY ganhos DESC
      `),

      // ── Por grupo ────────────────────────────────────────────────────────────
      dbQuery(sql`
        SELECT
          g.id,
          g.nome,
          g.cor,
          CAST(COUNT(c.id) AS SIGNED) AS total,
          CAST(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN 1 ELSE 0 END) AS SIGNED) AS fechadas,
          CAST(SUM(CASE WHEN LOWER(c.situacao) IN ('perda','perda/resgate') OR c.status = 'perda' THEN 1 ELSE 0 END) AS SIGNED) AS perdas,
          CAST(SUM(CASE WHEN (LOWER(c.situacao) NOT IN ('fechado','perda','perda/resgate') OR c.situacao IS NULL) AND c.status != 'perda' THEN 1 ELSE 0 END) AS SIGNED) AS emAnalise,
          CAST(COALESCE(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS DECIMAL(12,2)) AS ganhos,
          CAST(COALESCE(SUM(CASE WHEN LOWER(c.situacao) IN ('perda','perda/resgate') OR c.status = 'perda' THEN CAST(c.valor_perda AS DECIMAL(12,2)) ELSE 0 END), 0) AS DECIMAL(12,2)) AS perdasValor,
          CAST(COALESCE(SUM(CASE WHEN (LOWER(c.situacao) NOT IN ('fechado','perda','perda/resgate') OR c.situacao IS NULL) AND c.status != 'perda' THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS DECIMAL(12,2)) AS analiseValor,
          ROUND(
            SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN 1 ELSE 0 END)
            / NULLIF(COUNT(c.id), 0) * 100, 1
          ) AS taxaConversao,

          -- Renovações
          CAST(SUM(CASE WHEN (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true) THEN 1 ELSE 0 END) AS SIGNED) AS totalRenovacoes,
          CAST(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' AND (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true) THEN 1 ELSE 0 END) AS SIGNED) AS fechadasRenovacao,
          CAST(COALESCE(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' AND (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true) THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS DECIMAL(12,2)) AS ganhosRenovacao,
          CAST(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' AND NOT (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true) THEN 1 ELSE 0 END) AS SIGNED) AS fechadasNovas,
          CAST(COALESCE(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' AND NOT (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true) THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS DECIMAL(12,2)) AS ganhosNovas

        FROM grupos_usuarios g
        LEFT JOIN grupo_membros gm ON gm.grupo_id = g.id
        LEFT JOIN cotacoes c
          ON c.assignee_id = gm.user_id
          AND c.deleted_at IS NULL
          ${anoC} ${mesC}
        GROUP BY g.id, g.nome, g.cor
        ORDER BY ganhos DESC
      `),

      // ── Por status ───────────────────────────────────────────────────────────
      dbQuery(sql`
        SELECT
          status,
          CAST(COUNT(*) AS SIGNED) AS total,
          CAST(COALESCE(SUM(CAST(a_receber AS DECIMAL(12,2))), 0) AS DECIMAL(12,2)) AS faturamento
        FROM cotacoes
        WHERE deleted_at IS NULL ${anoS} ${mesS}
        GROUP BY status
        ORDER BY total DESC
      `),

      // ── Por situação ──────────────────────────────────────────────────────────
      dbQuery(sql`
        SELECT
          COALESCE(situacao, 'Sem situação') AS situacao,
          CAST(COUNT(*) AS SIGNED) AS total,
          CAST(COALESCE(SUM(CAST(a_receber AS DECIMAL(12,2))), 0) AS DECIMAL(12,2)) AS faturamento
        FROM cotacoes
        WHERE deleted_at IS NULL ${anoS} ${mesS}
        GROUP BY situacao
        ORDER BY total DESC
      `),
    ]);

    return apiSuccess({
      cotadores: cotadoresRows,
      grupos: gruposRows,
      porStatus: statusRows,
      porSituacao: situacaoRows,
    });
  } catch (error) {
    console.error("API GET /api/analise:", error);
    return apiError("Erro ao carregar analise", 500);
  }
}
