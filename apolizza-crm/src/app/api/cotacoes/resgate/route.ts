import { NextRequest } from "next/server";
import { and, isNull, or, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacoes } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { searchParams } = req.nextUrl;
    const search = searchParams.get("search") || "";
    const mes = searchParams.get("mes") || "";
    const ano = searchParams.get("ano") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";

    const conditions = [
      isNull(cotacoes.deletedAt),
      // Perda em status OU em situação
      or(
        eq(cotacoes.status, "perda"),
        sql`LOWER(${cotacoes.situacao}) = 'perda/resgate'`
      )!,
    ];

    if (search) {
      conditions.push(
        sql`(
          ${cotacoes.name} LIKE ${"%" + search + "%"}
          OR ${cotacoes.contatoCliente} LIKE ${"%" + search + "%"}
          OR ${cotacoes.produto} LIKE ${"%" + search + "%"}
          OR ${cotacoes.seguradora} LIKE ${"%" + search + "%"}
        )`
      );
    }

    if (mes) conditions.push(eq(cotacoes.mesReferencia, mes));
    if (ano) conditions.push(eq(cotacoes.anoReferencia, Number(ano)));
    if (dateFrom) conditions.push(sql`${cotacoes.createdAt} >= ${new Date(dateFrom)}`);
    if (dateTo) conditions.push(sql`${cotacoes.createdAt} <= ${new Date(dateTo + "T23:59:59")}`);

    const rows = await db
      .select({
        id: cotacoes.id,
        name: cotacoes.name,
        status: cotacoes.status,
        situacao: cotacoes.situacao,
        produto: cotacoes.produto,
        seguradora: cotacoes.seguradora,
        tipoCliente: cotacoes.tipoCliente,
        contatoCliente: cotacoes.contatoCliente,
        mesReferencia: cotacoes.mesReferencia,
        anoReferencia: cotacoes.anoReferencia,
        aReceber: cotacoes.aReceber,
        observacao: cotacoes.observacao,
        createdAt: cotacoes.createdAt,
        dueDate: cotacoes.dueDate,
        indicacao: cotacoes.indicacao,
      })
      .from(cotacoes)
      .where(and(...conditions))
      .orderBy(sql`${cotacoes.createdAt} DESC`);

    const data = rows.map((r) => ({
      ...r,
      aReceber: r.aReceber != null && r.aReceber !== "" ? Number(r.aReceber) : null,
    }));

    return apiSuccess(data);
  } catch (error) {
    console.error("API GET /api/cotacoes/resgate:", error);
    return apiError("Erro ao listar resgates", 500);
  }
}
