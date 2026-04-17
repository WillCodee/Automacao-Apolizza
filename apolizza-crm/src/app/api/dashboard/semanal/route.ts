import { NextRequest } from "next/server";
import { sql, and, isNull, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { metas } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

// GET /api/dashboard/semanal?ano=2026&mes=ABR
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { searchParams } = req.nextUrl;
    const ano = Number(searchParams.get("ano") ?? new Date().getFullYear());
    const mes = searchParams.get("mes") ?? "";

    if (isNaN(ano) || !mes) {
      return apiError("Parametros invalidos", 400);
    }

    const userFilter =
      user.role === "cotador"
        ? sql`AND assignee_id = ${user.id}`
        : sql``;

    // Mesnum derivado de mes (para query da meta)
    const MES_MAP: Record<string, number> = {
      JAN:1, FEV:2, MAR:3, ABR:4, MAI:5, JUN:6,
      JUL:7, AGO:8, SET:9, OUT:10, NOV:11, DEZ:12,
    };
    const mesNum = MES_MAP[mes.toUpperCase()] ?? 0;

    // Cotações agrupadas por semana do mês
    // Filtra por mes_referencia + ano_referencia (igual ao dashboard)
    // Agrupa por updated_at (quando a cotação foi trabalhada na semana)
    const semanasResult = await db.execute(sql`
      SELECT
        CASE
          WHEN EXTRACT(day FROM updated_at AT TIME ZONE 'America/Sao_Paulo') <= 7  THEN 1
          WHEN EXTRACT(day FROM updated_at AT TIME ZONE 'America/Sao_Paulo') <= 14 THEN 2
          WHEN EXTRACT(day FROM updated_at AT TIME ZONE 'America/Sao_Paulo') <= 21 THEN 3
          ELSE 4
        END::int AS semana,
        COUNT(*)::int AS novas,
        COUNT(*) FILTER (WHERE LOWER(situacao) = 'fechado')::int AS fechadas,
        COUNT(*) FILTER (WHERE LOWER(situacao) IN ('perda','perda/resgate'))::int AS perdas,
        COALESCE(SUM(a_receber::numeric) FILTER (WHERE LOWER(situacao) = 'fechado'), 0)::float AS ganho
      FROM cotacoes
      WHERE deleted_at IS NULL
        AND mes_referencia = ${mes}
        AND ano_referencia = ${ano}
        ${userFilter}
      GROUP BY 1
      ORDER BY 1
    `);

    // Meta da empresa para o mês
    const metaEmpresa = await db
      .select()
      .from(metas)
      .where(
        and(
          eq(metas.ano, ano),
          eq(metas.mes, mesNum),
          isNull(metas.userId),
          isNull(metas.grupoId)
        )
      )
      .limit(1);

    const metaMensal = metaEmpresa[0]?.metaValor
      ? parseFloat(metaEmpresa[0].metaValor)
      : null;

    // Neon HTTP driver may return numeric columns as strings — coerce explicitly
    const rows = (semanasResult.rows as Record<string, unknown>[]).map((r) => ({
      semana: Number(r.semana),
      novas: Number(r.novas),
      fechadas: Number(r.fechadas),
      perdas: Number(r.perdas),
      ganho: Number(r.ganho),
    }));

    // Preenche as 4 semanas mesmo sem dados
    const semanas = [1, 2, 3, 4].map((s) => {
      const found = rows.find((r) => r.semana === s);
      return {
        semana: s,
        novas: found?.novas ?? 0,
        fechadas: found?.fechadas ?? 0,
        perdas: found?.perdas ?? 0,
        ganho: found?.ganho ?? 0,
      };
    });

    // Ganho acumulado por semana
    let acumulado = 0;
    const semanasComAcumulado = semanas.map((s) => {
      acumulado += s.ganho;
      return { ...s, ganhoAcumulado: parseFloat(acumulado.toFixed(2)) };
    });

    return apiSuccess({ semanas: semanasComAcumulado, metaMensal });
  } catch (error) {
    console.error("API GET /api/dashboard/semanal:", error);
    return apiError("Erro ao carregar dados semanais", 500);
  }
}
