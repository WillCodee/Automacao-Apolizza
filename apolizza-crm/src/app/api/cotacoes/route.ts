import { NextRequest } from "next/server";
import { eq, and, ilike, isNull, sql, count, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacoes, statusConfig, cotacaoHistory } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { cotacaoCreateSchema } from "@/lib/validations";
import { validateStatusFields } from "@/lib/status-validation";
import {
  apiError,
  apiPaginated,
  apiSuccess,
  validateMes,
  validateAno,
  validateStatus,
  validateUuid,
} from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
    const offset = (page - 1) * limit;

    const status = searchParams.get("status");
    const ano = searchParams.get("ano");
    const mes = searchParams.get("mes");
    const assignee = searchParams.get("assignee");
    const grupo = searchParams.get("grupo");
    const search = searchParams.get("search");
    const produto = searchParams.get("produto");
    const seguradora = searchParams.get("seguradora");
    const prioridade = searchParams.get("prioridade");
    const isRenovacao = searchParams.get("isRenovacao");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const situacao = searchParams.get("situacao");

    if (!validateStatus(status)) return apiError("Status invalido", 400);
    if (!validateAno(ano)) return apiError("Ano invalido", 400);
    if (!validateMes(mes)) return apiError("Mes invalido", 400);
    if (!validateUuid(assignee)) return apiError("Assignee ID invalido", 400);
    if (!validateUuid(grupo)) return apiError("Grupo ID invalido", 400);

    const conditions = [isNull(cotacoes.deletedAt)];

    if (assignee) conditions.push(eq(cotacoes.assigneeId, assignee));
    if (grupo) conditions.push(sql`${cotacoes.assigneeId} IN (SELECT user_id FROM grupo_membros WHERE grupo_id = ${grupo}::uuid)`);
    if (status) conditions.push(eq(cotacoes.status, status));
    if (ano) conditions.push(eq(cotacoes.anoReferencia, Number(ano)));
    if (mes) conditions.push(eq(cotacoes.mesReferencia, mes));
    if (search) {
      conditions.push(sql`(
        ${cotacoes.name} ILIKE ${'%' + search + '%'}
        OR ${cotacoes.observacao} ILIKE ${'%' + search + '%'}
        OR ${cotacoes.seguradora} ILIKE ${'%' + search + '%'}
        OR ${cotacoes.indicacao} ILIKE ${'%' + search + '%'}
        OR ${cotacoes.contatoCliente} ILIKE ${'%' + search + '%'}
      )`);
    }
    if (produto) conditions.push(eq(cotacoes.produto, produto));
    if (seguradora) conditions.push(eq(cotacoes.seguradora, seguradora));
    if (prioridade) conditions.push(eq(cotacoes.priority, prioridade));
    if (isRenovacao === "true") conditions.push(eq(cotacoes.isRenovacao, true));
    if (dateFrom) conditions.push(gte(cotacoes.createdAt, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(cotacoes.createdAt, new Date(dateTo + "T23:59:59")));
    if (situacao) conditions.push(sql`LOWER(${cotacoes.situacao}) = LOWER(${situacao})`);

    const where = and(...conditions);

    const [totalResult] = await db.select({ value: count() }).from(cotacoes).where(where);

    const rows = await db
      .select()
      .from(cotacoes)
      .where(where)
      .orderBy(sql`${cotacoes.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    // Batch-fetch assignee name + group for each unique assignee
    const assigneeIds = [...new Set(rows.map((r) => r.assigneeId).filter((id): id is string => !!id))];
    const assigneeMap = new Map<string, { name: string; grupoNome: string | null }>();
    if (assigneeIds.length > 0) {
      const infoRows = await db.execute(sql`
        SELECT DISTINCT ON (u.id) u.id, u.name, g.nome AS grupo_nome
        FROM users u
        LEFT JOIN grupo_membros gm ON gm.user_id = u.id
        LEFT JOIN grupos_usuarios g ON g.id = gm.grupo_id
        WHERE u.id = ANY(${assigneeIds}::uuid[])
        ORDER BY u.id, g.nome ASC NULLS LAST
      `);
      for (const r of infoRows.rows as { id: string; name: string; grupo_nome: string | null }[]) {
        assigneeMap.set(r.id, { name: r.name, grupoNome: r.grupo_nome });
      }
    }

    const data = rows.map((row) => ({
      ...formatCotacao(row),
      assigneeNome: row.assigneeId ? (assigneeMap.get(row.assigneeId)?.name ?? null) : null,
      assigneeGrupoNome: row.assigneeId ? (assigneeMap.get(row.assigneeId)?.grupoNome ?? null) : null,
    }));

    return apiPaginated(data, { page, limit, total: totalResult.value });
  } catch (error) {
    console.error("API GET /api/cotacoes:", error);
    return apiError("Erro ao listar cotacoes", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const body = await req.json();
    const parsed = cotacaoCreateSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(parsed.error.issues.map((i) => i.message).join(", "), 422);
    }

    const input = parsed.data;

    // Validate required fields for the initial status
    const rules = await db.select().from(statusConfig);
    const validation = validateStatusFields(input as unknown as Record<string, unknown>, input.status ?? "não iniciado", rules);
    if (!validation.valid) {
      const missing = validation.missingFields.map((f) => f.label).join(", ");
      return apiError(`Campos obrigatorios para status "${input.status ?? "não iniciado"}": ${missing}`, 422);
    }

    const [created] = await db
      .insert(cotacoes)
      .values({
        name: input.name,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        assigneeId: input.assigneeId ?? user.id,
        tipoCliente: input.tipoCliente,
        contatoCliente: input.contatoCliente,
        seguradora: input.seguradora,
        produto: input.produto,
        situacao: input.situacao,
        indicacao: input.indicacao,
        inicioVigencia: input.inicioVigencia,
        fimVigencia: input.fimVigencia,
        primeiroPagamento: input.primeiroPagamento,
        parceladoEm: input.parceladoEm,
        premioSemIof: input.premioSemIof,
        comissao: input.comissao,
        aReceber: input.aReceber,
        valorPerda: input.valorPerda,
        proximaTratativa: input.proximaTratativa,
        observacao: input.observacao,
        mesReferencia: input.mesReferencia,
        anoReferencia: input.anoReferencia,
        comissaoParcelada: input.comissaoParcelada ?? null,
        tags: input.tags,
        isRenovacao: input.isRenovacao,
      })
      .returning();

    // Registrar evento de criação no histórico
    await db.insert(cotacaoHistory).values({
      cotacaoId: created.id,
      userId: user.id,
      fieldName: "criacao",
      oldValue: null,
      newValue: "Cotação criada",
    });

    return apiSuccess(formatCotacao(created), 201);
  } catch (error) {
    console.error("API POST /api/cotacoes:", error);
    return apiError("Erro ao criar cotacao", 500);
  }
}

function formatCotacao(row: typeof cotacoes.$inferSelect) {
  return {
    ...row,
    premioSemIof: row.premioSemIof ? Number(row.premioSemIof) : null,
    comissao: row.comissao ? Number(row.comissao) : null,
    aReceber: row.aReceber ? Number(row.aReceber) : null,
    valorPerda: row.valorPerda ? Number(row.valorPerda) : null,
  };
}
