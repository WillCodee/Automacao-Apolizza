import { NextRequest } from "next/server";
import { eq, and, isNull, or, sql } from "drizzle-orm";
import { db, dbQuery } from "@/lib/db";
import { tarefas, cotacoes, metas } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

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
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Cotacoes recentes: build conditions array
    const cotacoesConditions = [
      eq(cotacoes.assigneeId, user.id),
      isNull(cotacoes.deletedAt),
    ];
    if (statusFilter) cotacoesConditions.push(eq(cotacoes.status, statusFilter));
    if (seguradoraFilter) cotacoesConditions.push(eq(cotacoes.seguradora, seguradoraFilter));
    if (produtoFilter) cotacoesConditions.push(eq(cotacoes.produto, produtoFilter));

    const [tarefasRows, metaRows, prodRows, cotacoesRecentesRows] = await Promise.all([
      // Tarefas Pendente/Em Andamento onde e cotador OU criador
      db.query.tarefas.findMany({
        where: and(
          or(
            eq(tarefas.cotadorId, user.id),
            eq(tarefas.criadorId, user.id)
          ),
          or(
            eq(tarefas.status, "Pendente"),
            eq(tarefas.status, "Em Andamento")
          )
        ),
        with: {
          criador: { columns: { id: true, name: true } },
          cotador: { columns: { id: true, name: true, photoUrl: true } },
        },
        orderBy: (t, { asc, desc }) => [asc(t.dataVencimento), desc(t.createdAt)],
        limit: 20,
      }),

      // Meta do mes atual para este usuario
      db.select()
        .from(metas)
        .where(
          and(
            eq(metas.ano, ano),
            eq(metas.mes, mes),
            eq(metas.userId, user.id)
          )
        )
        .limit(1),

      // Produtividade: cotacoes deste mes atribuidas ao usuario
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
          AND created_at >= ${monthStart.toISOString()}
          AND created_at <  ${monthEnd.toISOString()}
      `),

      // Cotacoes recentes com filtros
      db.query.cotacoes.findMany({
        where: and(...cotacoesConditions),
        columns: {
          id: true,
          name: true,
          status: true,
          produto: true,
          seguradora: true,
          aReceber: true,
          premioSemIof: true,
          dueDate: true,
          updatedAt: true,
          createdAt: true,
          priority: true,
          tipoCliente: true,
        },
        orderBy: (c, { desc }) => [desc(c.updatedAt)],
        limit: 10,
      }),
    ]);

    const prod = prodRows[0] as Record<string, unknown>;

    return apiSuccess({
      tarefas: tarefasRows,
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
  } catch (error: any) {
    console.error("GET /api/inicio error:", error);
    return apiError(error.message || "Erro ao carregar inicio", 500);
  }
}
