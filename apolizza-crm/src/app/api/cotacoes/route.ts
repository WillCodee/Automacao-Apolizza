import { NextRequest } from "next/server";
import { eq, and, isNull, sql, count, gte, lte, inArray, desc } from "drizzle-orm";
import { db, dbQuery } from "@/lib/db";
import { cotacoes, statusConfig, cotacaoHistory, users, grupoMembros, gruposUsuarios, situacaoConfig, cotacaoResponsaveis } from "@/lib/schema";

const IANNE_ID = "eaaf6668-abe6-4b17-ab2f-16d741ff3d76";
const CAIO_ID  = "a4aec230-844c-457d-9d65-fe5a33b8606d";
const LUIS_ID  = "2147534d-1177-497f-adf1-db9b9156e0c6";
const IVO_ID   = "dec868b3-e8e3-4dbe-a11f-04485f55bc06";
const GRUPO_SAUDE_ID = "74ebff63-1454-41ae-b92d-0698e4e82c2a";
const GRUPO_RE_ID    = "e62230ef-ccfe-4757-8b25-1c8f3e6ac92f";

const SAUDE_ODONTO_UPPER = new Set([
  "VIDA PF", "VIDA PJ", "VIDA PME",
  "SAUDE PF", "SAUDE PJ", "SAÚDE PME", "SAÚDE EMPRESARIAL",
  "ODONTO PF", "ODONTO PJ", "ODONTO PME", "DENTAL EMPRESARIAL",
  "PREVIDENCIA", "GARANTIA", "GARATIA", "MIP", "PME/SUZANA",
]);
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
    const grupos = searchParams.getAll("grupo");
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
    if (grupos.some((g) => !validateUuid(g))) return apiError("Grupo ID invalido", 400);

    const conditions = [isNull(cotacoes.deletedAt)];

    if (assignee) {
      // PRD-016: filtro por responsável casa principal OU co-responsável
      conditions.push(sql`(${cotacoes.assigneeId} = ${assignee} OR ${cotacoes.id} IN (SELECT cotacao_id FROM cotacao_responsaveis WHERE user_id = ${assignee}))`);
    }
    if (grupos.length === 1) {
      conditions.push(sql`${cotacoes.assigneeId} IN (SELECT user_id FROM grupo_membros WHERE grupo_id = ${grupos[0]})`);
    } else if (grupos.length > 1) {
      conditions.push(sql`${cotacoes.assigneeId} IN (SELECT user_id FROM grupo_membros WHERE grupo_id IN (${sql.join(grupos.map((g) => sql`${g}`), sql`, `)}))`);
    }
    if (status) conditions.push(eq(cotacoes.status, status));
    if (ano) conditions.push(eq(cotacoes.anoReferencia, Number(ano)));
    if (mes) conditions.push(eq(cotacoes.mesReferencia, mes));
    if (search) {
      conditions.push(sql`(
        ${cotacoes.name} LIKE ${'%' + search + '%'}
        OR ${cotacoes.observacao} LIKE ${'%' + search + '%'}
        OR ${cotacoes.seguradora} LIKE ${'%' + search + '%'}
        OR ${cotacoes.indicacao} LIKE ${'%' + search + '%'}
        OR ${cotacoes.contatoCliente} LIKE ${'%' + search + '%'}
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

    // Enrich with assignee name + group (isolated — never breaks the main list)
    const assigneeMap = new Map<string, { name: string; grupoNomes: string[] }>();
    try {
      const assigneeIds = [...new Set(rows.map((r) => r.assigneeId).filter((id): id is string => !!id))];
      if (assigneeIds.length > 0) {
        const infoRows = await dbQuery<{ id: string; name: string; grupo_nomes: string }>(sql`
          SELECT
            u.id,
            u.name,
            COALESCE(GROUP_CONCAT(g.nome ORDER BY g.nome SEPARATOR ','), '') AS grupo_nomes
          FROM users u
          LEFT JOIN grupo_membros gm ON gm.user_id = u.id
          LEFT JOIN grupos_usuarios g ON g.id = gm.grupo_id
          WHERE u.id IN (${sql.join(assigneeIds.map((id) => sql`${id}`), sql`, `)})
          GROUP BY u.id, u.name
        `);
        for (const r of infoRows) {
          assigneeMap.set(r.id, { name: r.name, grupoNomes: r.grupo_nomes ? r.grupo_nomes.split(",") : [] });
        }
      }
    } catch (enrichErr) {
      console.error("Assignee enrichment failed (non-fatal):", enrichErr);
    }

    const data = rows.map((row) => ({
      ...formatCotacao(row),
      assigneeNome: row.assigneeId ? (assigneeMap.get(row.assigneeId)?.name ?? null) : null,
      assigneeGrupoNome: row.assigneeId ? (assigneeMap.get(row.assigneeId)?.grupoNomes?.join(", ") ?? null) : null,
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

    // Auto-assign por produto quando não há responsável explícito
    let autoAssigneeId: string = user.id;
    let autoGrupoId: string | null = null;
    if (!input.assigneeId && input.produto) {
      const prodUpper = input.produto.toUpperCase();
      if (SAUDE_ODONTO_UPPER.has(prodUpper)) {
        // Saúde e Odonto: ratio 95% Ianne / 5% Caio baseado no mês atual
        const mesRef = input.mesReferencia ?? null;
        const anoRef = input.anoReferencia ?? null;
        if (mesRef && anoRef) {
          const [ratio] = await dbQuery<{ ianne: number; total: number }>(sql`
            SELECT
              SUM(CASE WHEN assignee_id = ${IANNE_ID} THEN 1 ELSE 0 END) as ianne,
              COUNT(*) as total
            FROM cotacoes
            WHERE deleted_at IS NULL AND grupo_id = ${GRUPO_SAUDE_ID}
              AND mes_referencia = ${mesRef} AND ano_referencia = ${anoRef}
          `);
          const ianneShare = ratio?.total > 0 ? ratio.ianne / ratio.total : 0;
          autoAssigneeId = ianneShare < 0.95 ? IANNE_ID : CAIO_ID;
        } else {
          autoAssigneeId = IANNE_ID;
        }
        autoGrupoId = GRUPO_SAUDE_ID;
      } else {
        autoAssigneeId = LUIS_ID;
        autoGrupoId = GRUPO_RE_ID;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertValues: any = {
      name: input.name,
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      assigneeId: input.assigneeId ?? autoAssigneeId,
      grupoId: autoGrupoId,
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
      premioComIof: input.premioComIof,
      comissao: input.comissao,
      aReceber: input.aReceber,
      valorPerda: input.valorPerda,
      proximaTratativa: input.proximaTratativa,
      observacao: input.observacao,
      mesReferencia: input.mesReferencia,
      anoReferencia: input.anoReferencia,
      valorParcelado: input.valorParcelado,
      comissaoParcelada: input.comissaoParcelada ?? null,
      tags: input.tags,
      isRenovacao: input.isRenovacao,
    };

    // Auto-assign por situação (ex: CCLIENTE → Ivo)
    if (input.situacao) {
      const [sitCfg] = await db
        .select({ defaultCotadorId: situacaoConfig.defaultCotadorId })
        .from(situacaoConfig)
        .where(eq(situacaoConfig.nome, input.situacao));
      if (sitCfg?.defaultCotadorId) {
        insertValues.assigneeId = sitCfg.defaultCotadorId;
      }
    }

    // Gerar UUID antes do insert para evitar race condition no fetch
    const { randomUUID } = await import("crypto");
    const newId = randomUUID();
    insertValues.id = newId;

    await db.insert(cotacoes).values(insertValues);

    // Co-responsáveis (PRD-016)
    if (input.coResponsaveisIds && input.coResponsaveisIds.length > 0) {
      const principalId = insertValues.assigneeId;
      const uniq = [...new Set(input.coResponsaveisIds.filter((uid) => uid !== principalId))];
      if (uniq.length > 0) {
        await db.insert(cotacaoResponsaveis).values(
          uniq.map((uid) => ({ cotacaoId: newId, userId: uid }))
        );
      }
    }

    // Auto-adicionar Ivo como co-responsável quando situação é CCliente
    if (input.situacao && /cliente/i.test(input.situacao) && insertValues.assigneeId !== IVO_ID) {
      await db.execute(sql`
        INSERT IGNORE INTO cotacao_responsaveis (cotacao_id, user_id) VALUES (${newId}, ${IVO_ID})
      `);
    }

    const [created] = await db
      .select()
      .from(cotacoes)
      .where(eq(cotacoes.id, newId))
      .limit(1);

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
    premioComIof: row.premioComIof ? Number(row.premioComIof) : null,
    comissao: row.comissao ? Number(row.comissao) : null,
    aReceber: row.aReceber ? Number(row.aReceber) : null,
    valorPerda: row.valorPerda ? Number(row.valorPerda) : null,
    valorParcelado: row.valorParcelado ? Number(row.valorParcelado) : null,
  };
}
