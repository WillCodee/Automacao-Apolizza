import { NextRequest } from "next/server";
import { sql, and, isNull, eq } from "drizzle-orm";
import { db, dbQuery } from "@/lib/db";
import { metas } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { mesFullName } from "@/lib/normalize";

const MES_MAP: Record<string, number> = {
  JAN:1, FEV:2, MAR:3, ABR:4, MAI:5, JUN:6,
  JUL:7, AGO:8, SET:9, OUT:10, NOV:11, DEZ:12,
};

// GET /api/dashboard/semanal?ano=2026&mes=ABR
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { searchParams } = req.nextUrl;
    const ano = Number(searchParams.get("ano") ?? new Date().getFullYear());
    const mes = searchParams.get("mes") ?? "";

    if (isNaN(ano) || !mes) return apiError("Parametros invalidos", 400);

    const userFilter = user.role === "cotador"
      ? sql`AND assignee_id = ${user.id}`
      : sql``;

    const mesUpper = mes.toUpperCase();
    const mesNum = MES_MAP[mesUpper] ?? 0;
    const mesFull = mesFullName(mesUpper);

    const semanasRows = await dbQuery<Record<string, unknown>>(sql`
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
        COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS ganho,

        SUM(CASE WHEN UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1 THEN 1 ELSE 0 END) AS totalRenovacoes,
        SUM(CASE WHEN LOWER(situacao) = 'fechado' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN 1 ELSE 0 END) AS fechadasRenovacao,
        COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS ganhoRenovacao,

        SUM(CASE WHEN LOWER(situacao) = 'fechado' AND NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN 1 ELSE 0 END) AS fechadasNovas,
        COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' AND NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS ganhoNovas

      FROM cotacoes
      WHERE deleted_at IS NULL
        AND (UPPER(mes_referencia) = ${mesFull} OR UPPER(mes_referencia) = ${mesUpper})
        AND ano_referencia = ${ano}
        ${userFilter}
      GROUP BY 1
      ORDER BY 1
    `);

    // Meta da empresa
    const metaEmpresa = await db
      .select()
      .from(metas)
      .where(and(eq(metas.ano, ano), eq(metas.mes, mesNum), isNull(metas.userId), isNull(metas.grupoId)))
      .limit(1);

    const metaMensal = metaEmpresa[0]?.metaValor
      ? parseFloat(metaEmpresa[0].metaValor)
      : null;

    const rows = semanasRows.map((r) => ({
      semana:            Number(r.semana),
      novas:             Number(r.novas),
      fechadas:          Number(r.fechadas),
      perdas:            Number(r.perdas),
      ganho:             Number(r.ganho),
      totalRenovacoes:   Number(r.totalRenovacoes ?? 0),
      fechadasRenovacao: Number(r.fechadasRenovacao ?? 0),
      ganhoRenovacao:    Number(r.ganhoRenovacao ?? 0),
      fechadasNovas:     Number(r.fechadasNovas ?? 0),
      ganhoNovas:        Number(r.ganhoNovas ?? 0),
    }));

    // Preenche 4 semanas
    const semanas = [1, 2, 3, 4].map((s) => {
      const found = rows.find((r) => r.semana === s);
      return found ?? {
        semana: s, novas: 0, fechadas: 0, perdas: 0, ganho: 0,
        totalRenovacoes: 0, fechadasRenovacao: 0, ganhoRenovacao: 0,
        fechadasNovas: 0, ganhoNovas: 0,
      };
    });

    // Acumulado por semana
    let acum = 0, acumRenov = 0, acumNovas = 0;
    const semanasComAcumulado = semanas.map((s) => {
      acum       += s.ganho;
      acumRenov  += s.ganhoRenovacao;
      acumNovas  += s.ganhoNovas;
      return {
        ...s,
        ganhoAcumulado:          parseFloat(acum.toFixed(2)),
        ganhoRenovacaoAcumulado: parseFloat(acumRenov.toFixed(2)),
        ganhoNovasAcumulado:     parseFloat(acumNovas.toFixed(2)),
      };
    });

    return apiSuccess({ semanas: semanasComAcumulado, metaMensal });
  } catch (error) {
    console.error("API GET /api/dashboard/semanal:", error);
    return apiError("Erro ao carregar dados semanais", 500);
  }
}
