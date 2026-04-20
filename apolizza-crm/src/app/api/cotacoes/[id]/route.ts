import { NextRequest } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacoes, statusConfig, cotacaoHistory, situacaoConfig, cotacaoNotificacoes } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { cotacaoUpdateSchema } from "@/lib/validations";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { validateStatusFields } from "@/lib/status-validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { id } = await params;

    const [row] = await db
      .select()
      .from(cotacoes)
      .where(and(eq(cotacoes.id, id), isNull(cotacoes.deletedAt)));

    if (!row) return apiError("Cotacao nao encontrada", 404);

    return apiSuccess(formatCotacao(row));
  } catch (error) {
    console.error("API GET /api/cotacoes/[id]:", error);
    return apiError("Erro ao buscar cotacao", 500);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { id } = await params;

    const [existing] = await db
      .select()
      .from(cotacoes)
      .where(and(eq(cotacoes.id, id), isNull(cotacoes.deletedAt)));

    if (!existing) return apiError("Cotacao nao encontrada", 404);

    // Cotador só edita suas próprias cotações
    if (user.role === "cotador" && existing.assigneeId !== user.id) {
      return apiError("Acesso negado", 403);
    }

    const body = await req.json();
    const parsed = cotacaoUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(parsed.error.issues.map((i) => i.message).join(", "), 422);
    }

    const input = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.dueDate !== undefined && user.role !== "cotador")
      updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.assigneeId !== undefined) updateData.assigneeId = input.assigneeId;
    if (input.tipoCliente !== undefined) updateData.tipoCliente = input.tipoCliente;
    if (input.contatoCliente !== undefined) updateData.contatoCliente = input.contatoCliente;
    if (input.seguradora !== undefined) updateData.seguradora = input.seguradora;
    if (input.produto !== undefined) updateData.produto = input.produto;
    if (input.situacao !== undefined) {
      updateData.situacao = input.situacao;
      if (input.situacao && input.situacao !== existing.situacao) {
        const [sitCfg] = await db
          .select({ defaultCotadorId: situacaoConfig.defaultCotadorId })
          .from(situacaoConfig)
          .where(eq(situacaoConfig.nome, input.situacao));
        if (sitCfg?.defaultCotadorId) {
          updateData.assigneeId = sitCfg.defaultCotadorId;
        }
      }
    }
    if (input.indicacao !== undefined) updateData.indicacao = input.indicacao;
    if (input.inicioVigencia !== undefined) updateData.inicioVigencia = input.inicioVigencia;
    if (input.fimVigencia !== undefined) updateData.fimVigencia = input.fimVigencia;
    if (input.primeiroPagamento !== undefined) updateData.primeiroPagamento = input.primeiroPagamento;
    if (input.parceladoEm !== undefined) updateData.parceladoEm = input.parceladoEm;
    if (input.valorParcelado !== undefined) updateData.valorParcelado = input.valorParcelado;
    if (input.premioSemIof !== undefined) updateData.premioSemIof = input.premioSemIof;
    if (input.comissao !== undefined) updateData.comissao = input.comissao;
    if (input.aReceber !== undefined) updateData.aReceber = input.aReceber;
    if (input.valorPerda !== undefined) updateData.valorPerda = input.valorPerda;
    if (input.proximaTratativa !== undefined) updateData.proximaTratativa = input.proximaTratativa;
    if (input.observacao !== undefined) updateData.observacao = input.observacao;
    if (input.mesReferencia !== undefined) updateData.mesReferencia = input.mesReferencia;
    if (input.anoReferencia !== undefined) updateData.anoReferencia = input.anoReferencia;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.isRenovacao !== undefined) updateData.isRenovacao = input.isRenovacao;
    if (input.comissaoParcelada !== undefined) updateData.comissaoParcelada = input.comissaoParcelada ?? null;

    // Validate required fields when status changes
    const newStatus = input.status ?? existing.status;
    if (input.status && input.status !== existing.status) {
      const rules = await db.select().from(statusConfig);
      const merged: Record<string, unknown> = { ...existing, ...updateData };
      const validation = validateStatusFields(merged, newStatus, rules);

      if (!validation.valid) {
        const missing = validation.missingFields.map((f) => f.label).join(", ");
        return apiError(
          `Campos obrigatorios para status "${newStatus}": ${missing}`,
          422
        );
      }
    }

    // Record changes for audit trail
    const historyEntries: { fieldName: string; oldValue: string | null; newValue: string | null }[] = [];
    const observacaoChanged =
      input.observacao !== undefined &&
      String(input.observacao ?? "") !== String(existing.observacao ?? "");

    for (const [key, value] of Object.entries(updateData)) {
      const oldVal = (existing as Record<string, unknown>)[key];
      const newVal = value;
      if (String(oldVal ?? "") !== String(newVal ?? "")) {
        historyEntries.push({
          fieldName: key,
          oldValue: oldVal != null ? String(oldVal) : null,
          newValue: newVal != null ? String(newVal) : null,
        });
      }
    }

    const updated = await db.transaction(async (tx) => {
      await tx
        .update(cotacoes)
        .set(updateData)
        .where(eq(cotacoes.id, id));

      if (historyEntries.length > 0) {
        await tx.insert(cotacaoHistory).values(
          historyEntries.map((e) => ({
            cotacaoId: id,
            userId: user.id,
            fieldName: e.fieldName,
            oldValue: e.oldValue,
            newValue: e.newValue,
          }))
        );
      }

      // Notificação quando observação é alterada
      if (observacaoChanged && input.observacao) {
        await tx.insert(cotacaoNotificacoes).values({
          cotacaoId: id,
          cotacaoNome: existing.name,
          autorId: user.id,
          autorNome: user.name,
          tipo: "observacao",
          texto: input.observacao,
        });
      }

      const [row] = await tx.select().from(cotacoes).where(eq(cotacoes.id, id));
      return row;
    });

    return apiSuccess(formatCotacao(updated));
  } catch (error) {
    console.error("API PUT /api/cotacoes/[id]:", error);
    return apiError("Erro ao atualizar cotacao", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    if (user.role !== "admin" && user.role !== "proprietario") {
      return apiError("Apenas admin ou proprietario pode excluir cotacoes", 403);
    }

    const { id } = await params;

    // Check if cotacao exists before soft-deleting
    const [toDelete] = await db
      .select({ id: cotacoes.id })
      .from(cotacoes)
      .where(and(eq(cotacoes.id, id), isNull(cotacoes.deletedAt)));

    if (!toDelete) return apiError("Cotacao nao encontrada", 404);

    const deletedAt = new Date();
    await db
      .update(cotacoes)
      .set({ deletedAt })
      .where(eq(cotacoes.id, id));

    return apiSuccess({ id: toDelete.id, deletedAt });
  } catch (error) {
    console.error("API DELETE /api/cotacoes/[id]:", error);
    return apiError("Erro ao excluir cotacao", 500);
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
