import { NextRequest } from "next/server";
import { eq, and, isNull, or, sql, desc, asc } from "drizzle-orm";
import { db, dbQuery } from "@/lib/db";
import { tarefas, cotacoes, metas, users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { alias } from "drizzle-orm/mysql-core";

export const dynamic = "force-dynamic";

const criadorUser = alias(users, "criadorUser");
const cotadorUser = alias(users, "cotadorUser");

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { searchParams } = req.nextUrl;
    const statusFilter = searchParams.get("status");
    const seguradoraFilter = searchParams.get("seguradora");
    const produtoFilter = searchParams.get("produto");

    const now = new Date();
    const ano = now.getFullYear();
    const mes = now.getMonth() + 1;
    // Mapeia mês numérico -> abreviação usada em mes_referencia
    // Atenção: "MAI" e "MAIO" coexistem (inconsistência da migração ClickUp).
    const MES_ABREV: Record<number, string[]> = {
      1: ["JAN"], 2: ["FEV"], 3: ["MAR"], 4: ["ABR"], 5: ["MAI", "MAIO"],
      6: ["JUN"], 7: ["JUL"], 8: ["AGO"], 9: ["SET"], 10: ["OUT"], 11: ["NOV"], 12: ["DEZ"],
    };
    const mesAbrevs = MES_ABREV[mes];

    // Cotacoes recentes: build conditions array
    const cotacoesConditions = [
      eq(cotacoes.assigneeId, user.id),
      isNull(cotacoes.deletedAt),
    ];
    if (statusFilter) cotacoesConditions.push(eq(cotacoes.status, statusFilter));
    if (seguradoraFilter) cotacoesConditions.push(eq(cotacoes.seguradora, seguradoraFilter));
    if (produtoFilter) cotacoesConditions.push(eq(cotacoes.produto, produtoFilter));

    const [tarefasRows, metaRows, prodRows, cotacoesRecentesRows] = await Promise.all([
      // Tarefas Pendente/Em Andamento — LEFT JOIN manual (MySQL 5.7 safe)
      db.select({
        id: tarefas.id,
        titulo: tarefas.titulo,
        descricao: tarefas.descricao,
        dataVencimento: tarefas.dataVencimento,
        status: tarefas.status,
        cotadorId: tarefas.cotadorId,
        criadorId: tarefas.criadorId,
        visualizadaEm: tarefas.visualizadaEm,
        iniciadaEm: tarefas.iniciadaEm,
        concluidaEm: tarefas.concluidaEm,
        createdAt: tarefas.createdAt,
        updatedAt: tarefas.updatedAt,
        criadorName: criadorUser.name,
        cotadorName: cotadorUser.name,
        cotadorPhotoUrl: cotadorUser.photoUrl,
      })
        .from(tarefas)
        .leftJoin(criadorUser, eq(tarefas.criadorId, criadorUser.id))
        .leftJoin(cotadorUser, eq(tarefas.cotadorId, cotadorUser.id))
        .where(
          and(
            or(eq(tarefas.cotadorId, user.id), eq(tarefas.criadorId, user.id)),
            or(eq(tarefas.status, "Pendente"), eq(tarefas.status, "Em Andamento"))
          )
        )
        .orderBy(asc(tarefas.dataVencimento), desc(tarefas.createdAt))
        .limit(20),

      // Meta do mes atual para este usuario
      db.select()
        .from(metas)
        .where(and(eq(metas.ano, ano), eq(metas.mes, mes), eq(metas.userId, user.id)))
        .limit(1),

      // Produtividade: cotacoes deste mes_referencia/ano_referencia atribuidas ao usuario
      // (NÃO usar created_at — toda migração ClickUp criou registros em abril/2026)
      dbQuery(sql`
        SELECT
          CAST(COUNT(*) AS SIGNED)                                                 AS qtd_cotacoes,
          CAST(SUM(CASE WHEN status = 'fechado' THEN 1 ELSE 0 END) AS SIGNED)     AS qtd_fechadas,
          CAST(SUM(CASE WHEN status = 'perda' THEN 1 ELSE 0 END) AS SIGNED)       AS qtd_perdas,
          COALESCE(SUM(CAST(a_receber AS DECIMAL(12,2))), 0)                       AS valor_a_receber,
          COALESCE(SUM(CAST(premio_sem_iof AS DECIMAL(12,2))), 0)                  AS valor_premio
        FROM cotacoes
        WHERE assignee_id = ${user.id}
          AND deleted_at IS NULL
          AND ano_referencia = ${ano}
          AND UPPER(mes_referencia) IN (${sql.join(mesAbrevs.map((m) => sql`${m}`), sql`, `)})
      `),

      // Cotacoes recentes com filtros — db.select() (MySQL 5.7 safe)
      db.select({
        id: cotacoes.id,
        name: cotacoes.name,
        status: cotacoes.status,
        produto: cotacoes.produto,
        seguradora: cotacoes.seguradora,
        aReceber: cotacoes.aReceber,
        premioSemIof: cotacoes.premioSemIof,
        dueDate: cotacoes.dueDate,
        updatedAt: cotacoes.updatedAt,
        createdAt: cotacoes.createdAt,
        priority: cotacoes.priority,
        tipoCliente: cotacoes.tipoCliente,
      })
        .from(cotacoes)
        .where(and(...cotacoesConditions))
        .orderBy(desc(cotacoes.updatedAt))
        .limit(10),
    ]);

    console.log(`[/api/inicio] user=${user.id} (${user.name}), tarefas=${tarefasRows.length}, cotacoes=${cotacoesRecentesRows.length}`);

    // Formatar tarefas com objetos criador/cotador aninhados
    const tarefasFormatted = tarefasRows.map((r) => ({
      id: r.id,
      titulo: r.titulo,
      descricao: r.descricao,
      dataVencimento: r.dataVencimento,
      status: r.status,
      cotadorId: r.cotadorId,
      criadorId: r.criadorId,
      visualizadaEm: r.visualizadaEm,
      iniciadaEm: r.iniciadaEm,
      concluidaEm: r.concluidaEm,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      criador: { id: r.criadorId, name: r.criadorName },
      cotador: { id: r.cotadorId, name: r.cotadorName, photoUrl: r.cotadorPhotoUrl },
    }));

    const prod = prodRows[0] as Record<string, unknown>;

    return apiSuccess({
      tarefas: tarefasFormatted,
      meta: metaRows[0] ?? null,
      produtividade: {
        qtdCotacoes: Number(prod?.qtd_cotacoes ?? 0),
        qtdFechadas: Number(prod?.qtd_fechadas ?? 0),
        qtdPerdas: Number(prod?.qtd_perdas ?? 0),
        valorAReceber: Number(prod?.valor_a_receber ?? 0),
        valorPremio: Number(prod?.valor_premio ?? 0),
      },
      cotacoesRecentes: cotacoesRecentesRows,
      mes,
      ano,
    });
  } catch (error: unknown) {
    const e = error as Error;
    console.error("GET /api/inicio error:", e.message);
    return apiError(e.message || "Erro ao carregar inicio", 500);
  }
}
