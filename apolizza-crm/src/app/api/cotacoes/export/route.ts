import { NextRequest } from "next/server";
import { eq, and, ilike, isNull, sql, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacoes, users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, validateMes, validateAno, validateStatus, validateUuid } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status");
    const ano = searchParams.get("ano");
    const mes = searchParams.get("mes");
    const assignee = searchParams.get("assignee");
    const search = searchParams.get("search");
    const produto = searchParams.get("produto");
    const seguradora = searchParams.get("seguradora");
    const prioridade = searchParams.get("prioridade");
    const isRenovacao = searchParams.get("isRenovacao");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    if (!validateStatus(status)) return apiError("Status invalido", 400);
    if (!validateAno(ano)) return apiError("Ano invalido", 400);
    if (!validateMes(mes)) return apiError("Mes invalido", 400);
    if (!validateUuid(assignee)) return apiError("Assignee ID invalido", 400);

    const conditions = [isNull(cotacoes.deletedAt)];

    if (user.role === "cotador") {
      conditions.push(eq(cotacoes.assigneeId, user.id));
    } else if (assignee) {
      conditions.push(eq(cotacoes.assigneeId, assignee));
    }

    if (status) conditions.push(eq(cotacoes.status, status));
    if (ano) conditions.push(eq(cotacoes.anoReferencia, Number(ano)));
    if (mes) conditions.push(eq(cotacoes.mesReferencia, mes));
    if (search) {
      conditions.push(sql`(
        ${cotacoes.name} ILIKE ${'%' + search + '%'}
        OR ${cotacoes.seguradora} ILIKE ${'%' + search + '%'}
      )`);
    }
    if (produto) conditions.push(eq(cotacoes.produto, produto));
    if (seguradora) conditions.push(eq(cotacoes.seguradora, seguradora));
    if (prioridade) conditions.push(eq(cotacoes.priority, prioridade));
    if (isRenovacao === "true") conditions.push(eq(cotacoes.isRenovacao, true));
    if (dateFrom) conditions.push(gte(cotacoes.createdAt, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(cotacoes.createdAt, new Date(dateTo + "T23:59:59")));

    const where = and(...conditions);

    // Fetch all matching rows (max 10.000) with user names
    const rows = await db
      .select({
        name: cotacoes.name,
        status: cotacoes.status,
        priority: cotacoes.priority,
        produto: cotacoes.produto,
        seguradora: cotacoes.seguradora,
        aReceber: cotacoes.aReceber,
        valorPerda: cotacoes.valorPerda,
        comissao: cotacoes.comissao,
        premioSemIof: cotacoes.premioSemIof,
        mesReferencia: cotacoes.mesReferencia,
        anoReferencia: cotacoes.anoReferencia,
        tipoCliente: cotacoes.tipoCliente,
        situacao: cotacoes.situacao,
        cotador: users.name,
        createdAt: cotacoes.createdAt,
      })
      .from(cotacoes)
      .leftJoin(users, eq(cotacoes.assigneeId, users.id))
      .where(where)
      .orderBy(sql`${cotacoes.createdAt} DESC`)
      .limit(10000);

    // Build CSV with BOM for Excel PT-BR
    const BOM = "\ufeff";
    const headers = [
      "Nome", "Status", "Prioridade", "Produto", "Seguradora",
      "A Receber", "Valor Perda", "Comissao", "Premio s/ IOF",
      "Tipo Cliente", "Situacao", "Mes", "Ano", "Cotador", "Criado Em",
    ];

    const csvLines = [headers.join(";")];

    for (const r of rows) {
      const line = [
        csvEscape(r.name),
        csvEscape(r.status),
        csvEscape(r.priority),
        csvEscape(r.produto),
        csvEscape(r.seguradora),
        r.aReceber ? Number(r.aReceber).toFixed(2).replace(".", ",") : "",
        r.valorPerda ? Number(r.valorPerda).toFixed(2).replace(".", ",") : "",
        r.comissao ? Number(r.comissao).toFixed(2).replace(".", ",") : "",
        r.premioSemIof ? Number(r.premioSemIof).toFixed(2).replace(".", ",") : "",
        csvEscape(r.tipoCliente),
        csvEscape(r.situacao),
        csvEscape(r.mesReferencia),
        r.anoReferencia?.toString() || "",
        csvEscape(r.cotador),
        r.createdAt ? new Date(r.createdAt).toLocaleDateString("pt-BR") : "",
      ];
      csvLines.push(line.join(";"));
    }

    const csv = BOM + csvLines.join("\r\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cotacoes-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error("API GET /api/cotacoes/export:", error);
    return apiError("Erro ao exportar cotacoes", 500);
  }
}

function csvEscape(val: string | null | undefined): string {
  if (!val) return "";
  if (val.includes(";") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
