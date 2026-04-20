import { NextRequest } from "next/server";
import { sql, and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { metasProduto, metas } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

const MES_MAP: Record<string, number> = {
  JAN:1, FEV:2, MAR:3, ABR:4, MAI:5, JUN:6,
  JUL:7, AGO:8, SET:9, OUT:10, NOV:11, DEZ:12,
};

// GET /api/dashboard/produto?ano=2026&mes=ABR
// Returns: real a_receber per product + meta per product + empresa meta
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { searchParams } = req.nextUrl;
    const ano = Number(searchParams.get("ano") ?? new Date().getFullYear());
    const mes = (searchParams.get("mes") ?? "").toUpperCase();

    if (!mes || !MES_MAP[mes]) return apiError("Mes invalido", 400);

    const mesNum = MES_MAP[mes];
    const userFilter = user.role === "cotador" ? sql`AND assignee_id = ${user.id}` : sql``;

    // Real achieved per product (cotacoes fechadas)
    const reaisResult = await db.execute(sql`
      SELECT
        produto,
        COUNT(*)::int AS qtd,
        COALESCE(SUM(a_receber::numeric), 0)::float AS realizado
      FROM cotacoes
      WHERE deleted_at IS NULL
        AND mes_referencia = ${mes}
        AND ano_referencia = ${ano}
        AND LOWER(situacao) = 'fechado'
        AND produto IS NOT NULL
        ${userFilter}
      GROUP BY produto
      ORDER BY realizado DESC
    `);

    // Metas por produto
    const metasProdutoRows = await db
      .select()
      .from(metasProduto)
      .where(and(eq(metasProduto.ano, ano), eq(metasProduto.mes, mesNum)));

    // Meta empresa (para validação no frontend)
    const metaEmpresaRow = await db
      .select()
      .from(metas)
      .where(and(
        eq(metas.ano, ano),
        eq(metas.mes, mesNum),
        isNull(metas.userId),
        isNull(metas.grupoId)
      ))
      .limit(1);

    const metaEmpresa = metaEmpresaRow[0]?.metaValor
      ? parseFloat(metaEmpresaRow[0].metaValor)
      : null;

    const reaisMap = Object.fromEntries(
      (reaisResult.rows as { produto: string; qtd: number; realizado: number }[]).map((r) => [
        r.produto,
        { qtd: r.qtd, realizado: r.realizado },
      ])
    );

    const metasMap = Object.fromEntries(
      metasProdutoRows.map((m) => [
        m.produto,
        m.metaValor ? parseFloat(m.metaValor) : 0,
      ])
    );

    // Merge all products
    const allProdutos = Array.from(
      new Set([...Object.keys(reaisMap), ...Object.keys(metasMap)])
    );

    const rows = allProdutos.map((produto) => ({
      produto,
      meta: metasMap[produto] ?? 0,
      realizado: reaisMap[produto]?.realizado ?? 0,
      qtd: reaisMap[produto]?.qtd ?? 0,
      pct: metasMap[produto]
        ? Math.round((reaisMap[produto]?.realizado ?? 0) / metasMap[produto] * 100)
        : null,
    }));

    rows.sort((a, b) => b.realizado - a.realizado);

    return apiSuccess({ rows, metaEmpresa });
  } catch (error) {
    console.error("API GET /api/dashboard/produto:", error);
    return apiError("Erro ao carregar dashboard por produto", 500);
  }
}
