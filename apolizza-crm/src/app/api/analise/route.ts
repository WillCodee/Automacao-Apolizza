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
    const ano = searchParams.get("ano");
    const mes = searchParams.get("mes");

    const anoC = ano ? sql`AND c.ano_referencia = ${Number(ano)}` : sql``;
    const mesC = mes ? sql`AND c.mes_referencia = ${mes}` : sql``;
    const anoS = ano ? sql`AND ano_referencia = ${Number(ano)}` : sql``;
    const mesS = mes ? sql`AND mes_referencia = ${mes}` : sql``;

    const [cotadoresRows, gruposRows, statusRows, situacaoRows] = await Promise.all([

      // ── Por cotador ──────────────────────────────────────────────────────────
      db.execute(sql`
        SELECT
          u.id,
          u.name,
          u.photo_url                                                                AS "photoUrl",
          COUNT(c.id)::int                                                           AS total,
          COUNT(c.id) FILTER (WHERE LOWER(c.situacao) = 'fechado')::int             AS fechadas,
          COUNT(c.id) FILTER (WHERE LOWER(c.situacao) IN ('perda','perda/resgate') OR c.status = 'perda')::int AS perdas,
          COUNT(c.id) FILTER (WHERE (LOWER(c.situacao) NOT IN ('fechado','perda','perda/resgate') OR c.situacao IS NULL) AND c.status != 'perda')::int AS "emAnalise",
          COALESCE(SUM(c.a_receber::numeric)   FILTER (WHERE LOWER(c.situacao) = 'fechado'), 0)::float AS ganhos,
          COALESCE(SUM(c.valor_perda::numeric) FILTER (WHERE LOWER(c.situacao) IN ('perda','perda/resgate') OR c.status = 'perda'), 0)::float AS "perdasValor",
          COALESCE(SUM(c.a_receber::numeric)   FILTER (WHERE (LOWER(c.situacao) NOT IN ('fechado','perda','perda/resgate') OR c.situacao IS NULL) AND c.status != 'perda'), 0)::float AS "analiseValor",
          ROUND(
            COUNT(c.id) FILTER (WHERE LOWER(c.situacao) = 'fechado')::numeric
            / NULLIF(COUNT(c.id), 0) * 100, 1
          )::float AS "taxaConversao",

          -- Renovações (tipo_cliente = 'RENOVAÇÃO' ou is_renovacao = true)
          COUNT(c.id) FILTER (WHERE (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true))::int AS "totalRenovacoes",
          COUNT(c.id) FILTER (WHERE LOWER(c.situacao) = 'fechado' AND (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true))::int AS "fechadasRenovacao",
          COALESCE(SUM(c.a_receber::numeric) FILTER (WHERE LOWER(c.situacao) = 'fechado' AND (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true)), 0)::float AS "ganhosRenovacao",
          COUNT(c.id) FILTER (WHERE LOWER(c.situacao) IN ('perda','perda/resgate') OR c.status = 'perda' AND (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true))::int AS "perdasRenovacao",

          -- Novas (não renovação)
          COUNT(c.id) FILTER (WHERE LOWER(c.situacao) = 'fechado' AND NOT (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true))::int AS "fechadasNovas",
          COALESCE(SUM(c.a_receber::numeric) FILTER (WHERE LOWER(c.situacao) = 'fechado' AND NOT (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true)), 0)::float AS "ganhosNovas"

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
          NULL::uuid AS id,
          'Pedidos'  AS name,
          NULL       AS "photoUrl",
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE LOWER(situacao) = 'fechado')::int AS fechadas,
          COUNT(*) FILTER (WHERE LOWER(situacao) IN ('perda','perda/resgate') OR status = 'perda')::int AS perdas,
          COUNT(*) FILTER (WHERE (LOWER(situacao) NOT IN ('fechado','perda','perda/resgate') OR situacao IS NULL) AND status != 'perda')::int AS "emAnalise",
          COALESCE(SUM(a_receber::numeric)   FILTER (WHERE LOWER(situacao) = 'fechado'), 0)::float AS ganhos,
          COALESCE(SUM(valor_perda::numeric) FILTER (WHERE LOWER(situacao) IN ('perda','perda/resgate') OR status = 'perda'), 0)::float AS "perdasValor",
          COALESCE(SUM(a_receber::numeric)   FILTER (WHERE (LOWER(situacao) NOT IN ('fechado','perda','perda/resgate') OR situacao IS NULL) AND status != 'perda'), 0)::float AS "analiseValor",
          ROUND(
            COUNT(*) FILTER (WHERE LOWER(situacao) = 'fechado')::numeric
            / NULLIF(COUNT(*), 0) * 100, 1
          )::float AS "taxaConversao",
          COUNT(*) FILTER (WHERE (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = true))::int AS "totalRenovacoes",
          COUNT(*) FILTER (WHERE LOWER(situacao) = 'fechado' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = true))::int AS "fechadasRenovacao",
          COALESCE(SUM(a_receber::numeric) FILTER (WHERE LOWER(situacao) = 'fechado' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = true)), 0)::float AS "ganhosRenovacao",
          COUNT(*) FILTER (WHERE LOWER(situacao) IN ('perda','perda/resgate') OR status = 'perda' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = true))::int AS "perdasRenovacao",
          COUNT(*) FILTER (WHERE LOWER(situacao) = 'fechado' AND NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = true))::int AS "fechadasNovas",
          COALESCE(SUM(a_receber::numeric) FILTER (WHERE LOWER(situacao) = 'fechado' AND NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = true)), 0)::float AS "ganhosNovas"

        FROM cotacoes
        WHERE assignee_id IS NULL AND deleted_at IS NULL ${anoS} ${mesS}
        ORDER BY ganhos DESC
      `),

      // ── Por grupo ────────────────────────────────────────────────────────────
      db.execute(sql`
        SELECT
          g.id,
          g.nome,
          g.cor,
          COUNT(c.id)::int AS total,
          COUNT(c.id) FILTER (WHERE LOWER(c.situacao) = 'fechado')::int AS fechadas,
          COUNT(c.id) FILTER (WHERE LOWER(c.situacao) IN ('perda','perda/resgate') OR c.status = 'perda')::int AS perdas,
          COUNT(c.id) FILTER (WHERE (LOWER(c.situacao) NOT IN ('fechado','perda','perda/resgate') OR c.situacao IS NULL) AND c.status != 'perda')::int AS "emAnalise",
          COALESCE(SUM(c.a_receber::numeric)   FILTER (WHERE LOWER(c.situacao) = 'fechado'), 0)::float AS ganhos,
          COALESCE(SUM(c.valor_perda::numeric) FILTER (WHERE LOWER(c.situacao) IN ('perda','perda/resgate') OR c.status = 'perda'), 0)::float AS "perdasValor",
          COALESCE(SUM(c.a_receber::numeric)   FILTER (WHERE (LOWER(c.situacao) NOT IN ('fechado','perda','perda/resgate') OR c.situacao IS NULL) AND c.status != 'perda'), 0)::float AS "analiseValor",
          ROUND(
            COUNT(c.id) FILTER (WHERE LOWER(c.situacao) = 'fechado')::numeric
            / NULLIF(COUNT(c.id), 0) * 100, 1
          )::float AS "taxaConversao",

          -- Renovações
          COUNT(c.id) FILTER (WHERE (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true))::int AS "totalRenovacoes",
          COUNT(c.id) FILTER (WHERE LOWER(c.situacao) = 'fechado' AND (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true))::int AS "fechadasRenovacao",
          COALESCE(SUM(c.a_receber::numeric) FILTER (WHERE LOWER(c.situacao) = 'fechado' AND (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true)), 0)::float AS "ganhosRenovacao",
          COUNT(c.id) FILTER (WHERE LOWER(c.situacao) = 'fechado' AND NOT (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true))::int AS "fechadasNovas",
          COALESCE(SUM(c.a_receber::numeric) FILTER (WHERE LOWER(c.situacao) = 'fechado' AND NOT (UPPER(c.tipo_cliente) = 'RENOVAÇÃO' OR c.is_renovacao = true)), 0)::float AS "ganhosNovas"

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
      db.execute(sql`
        SELECT
          status,
          COUNT(*)::int AS total,
          COALESCE(SUM(a_receber::numeric), 0)::float AS faturamento
        FROM cotacoes
        WHERE deleted_at IS NULL ${anoS} ${mesS}
        GROUP BY status
        ORDER BY total DESC
      `),

      // ── Por situação ──────────────────────────────────────────────────────────
      db.execute(sql`
        SELECT
          COALESCE(situacao, 'Sem situação') AS situacao,
          COUNT(*)::int AS total,
          COALESCE(SUM(a_receber::numeric), 0)::float AS faturamento
        FROM cotacoes
        WHERE deleted_at IS NULL ${anoS} ${mesS}
        GROUP BY situacao
        ORDER BY total DESC
      `),
    ]);

    return apiSuccess({
      cotadores: cotadoresRows.rows,
      grupos: gruposRows.rows,
      porStatus: statusRows.rows,
      porSituacao: situacaoRows.rows,
    });
  } catch (error) {
    console.error("API GET /api/analise:", error);
    return apiError("Erro ao carregar analise", 500);
  }
}
