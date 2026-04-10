import { NextRequest } from "next/server";
import { sql, inArray, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacoes, cotacaoHistory } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess, validateUuid } from "@/lib/api-helpers";
import { STATUS_OPTIONS } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "admin" && user.role !== "proprietario") return apiError("Acesso negado", 403);

    const body = await req.json();
    const { ids, action, data } = body as {
      ids: string[];
      action: "updateStatus" | "delete";
      data?: { status?: string };
    };

    if (!Array.isArray(ids) || ids.length === 0) {
      return apiError("Nenhuma cotacao selecionada", 400);
    }
    if (ids.length > 100) {
      return apiError("Maximo de 100 cotacoes por operacao", 400);
    }
    for (const id of ids) {
      if (!validateUuid(id)) return apiError(`ID invalido: ${id}`, 400);
    }

    if (action === "updateStatus") {
      const newStatus = data?.status;
      if (!newStatus || !(STATUS_OPTIONS as readonly string[]).includes(newStatus)) {
        return apiError("Status invalido", 400);
      }

      const result = await db.transaction(async (tx) => {
        // Get current cotacoes
        const current = await tx
          .select({ id: cotacoes.id, status: cotacoes.status })
          .from(cotacoes)
          .where(inArray(cotacoes.id, ids));

        const toUpdate = current.filter((c) => c.status !== newStatus);
        if (toUpdate.length === 0) {
          return { updated: 0, skipped: ids.length };
        }

        const updateIds = toUpdate.map((c) => c.id);

        // Update status
        await tx
          .update(cotacoes)
          .set({ status: newStatus })
          .where(inArray(cotacoes.id, updateIds));

        // Audit trail
        const historyEntries = toUpdate.map((c) => ({
          cotacaoId: c.id,
          userId: user.id,
          fieldName: "status",
          oldValue: c.status,
          newValue: newStatus,
        }));
        if (historyEntries.length > 0) {
          await tx.insert(cotacaoHistory).values(historyEntries);
        }

        return { updated: toUpdate.length, skipped: ids.length - toUpdate.length };
      });

      return apiSuccess(result);
    }

    if (action === "delete") {
      const result = await db.transaction(async (tx) => {
        // Soft delete
        const updated = await tx
          .update(cotacoes)
          .set({ deletedAt: new Date() })
          .where(sql`${cotacoes.id} = ANY(${ids}::uuid[]) and ${cotacoes.deletedAt} is null`)
          .returning({ id: cotacoes.id });

        // Audit trail
        if (updated.length > 0) {
          const historyEntries = updated.map((c) => ({
            cotacaoId: c.id,
            userId: user.id,
            fieldName: "deletedAt",
            oldValue: null,
            newValue: new Date().toISOString(),
          }));
          await tx.insert(cotacaoHistory).values(historyEntries);
        }

        return { deleted: updated.length, skipped: ids.length - updated.length };
      });

      return apiSuccess(result);
    }

    return apiError("Acao invalida. Use 'updateStatus' ou 'delete'", 400);
  } catch (error) {
    console.error("API POST /api/cotacoes/bulk:", error);
    return apiError("Erro na operacao em lote", 500);
  }
}
