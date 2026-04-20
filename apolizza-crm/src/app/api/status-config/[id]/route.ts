import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { statusConfig } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

const VALID_FIELDS = [
  "fim_vigencia", "inicio_vigencia", "indicacao", "produto", "seguradora",
  "situacao", "tipo_cliente", "comissao", "primeiro_pagamento", "a_receber",
  "parcelado_em", "premio_sem_iof", "valor_perda", "proxima_tratativa", "observacao",
  "mes_referencia", "ano_referencia",
];

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "proprietario") return apiError("Apenas o proprietário pode configurar status", 403);

    const { id } = await params;
    const body = await req.json();
    const { displayLabel, color, icon, isTerminal, requiredFields } = body;

    const updateData: Record<string, unknown> = {};
    if (displayLabel !== undefined) updateData.displayLabel = displayLabel;
    if (color !== undefined) updateData.color = color;
    if (icon !== undefined) updateData.icon = icon;
    if (isTerminal !== undefined) updateData.isTerminal = isTerminal;

    if (requiredFields !== undefined) {
      if (!Array.isArray(requiredFields)) {
        return apiError("requiredFields deve ser um array", 400);
      }
      const invalid = requiredFields.filter((f: string) => !VALID_FIELDS.includes(f));
      if (invalid.length > 0) {
        return apiError(`Campos invalidos: ${invalid.join(", ")}`, 400);
      }
      updateData.requiredFields = requiredFields;
    }

    await db
      .update(statusConfig)
      .set(updateData)
      .where(eq(statusConfig.id, id));
    const [updated] = await db.select().from(statusConfig).where(eq(statusConfig.id, id));

    if (!updated) return apiError("Status config nao encontrado", 404);

    return apiSuccess(updated);
  } catch (error) {
    console.error("API PUT /api/status-config/[id]:", error);
    return apiError("Erro ao atualizar configuracao de status", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "proprietario") return apiError("Apenas o proprietário pode configurar status", 403);

    const { id } = await params;

    const [toDelete] = await db.select({ id: statusConfig.id, statusName: statusConfig.statusName }).from(statusConfig).where(eq(statusConfig.id, id));

    if (!toDelete) return apiError("Status config nao encontrado", 404);

    await db.delete(statusConfig).where(eq(statusConfig.id, id));

    return apiSuccess(toDelete);
  } catch (error) {
    console.error("API DELETE /api/status-config/[id]:", error);
    return apiError("Erro ao excluir configuracao de status", 500);
  }
}
