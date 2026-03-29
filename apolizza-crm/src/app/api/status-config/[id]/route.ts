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
];

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "admin") return apiError("Apenas admin", 403);

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

    const [updated] = await db
      .update(statusConfig)
      .set(updateData)
      .where(eq(statusConfig.id, id))
      .returning();

    if (!updated) return apiError("Status config nao encontrado", 404);

    return apiSuccess(updated);
  } catch (error) {
    console.error("API PUT /api/status-config/[id]:", error);
    return apiError("Erro ao atualizar configuracao de status", 500);
  }
}
