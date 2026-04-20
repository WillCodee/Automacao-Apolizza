import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { situacaoConfig } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "proprietario") return apiError("Apenas o proprietário pode configurar situações", 403);

    const { id } = await params;
    const body = await req.json();
    const { nome, orderIndex, isActive, defaultCotadorId } = body;

    const updateData: Record<string, unknown> = {};
    if (nome !== undefined) updateData.nome = nome.trim().toUpperCase();
    if (orderIndex !== undefined) updateData.orderIndex = orderIndex;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (defaultCotadorId !== undefined) updateData.defaultCotadorId = defaultCotadorId || null;

    await db
      .update(situacaoConfig)
      .set(updateData)
      .where(eq(situacaoConfig.id, id));
    const [updated] = await db.select().from(situacaoConfig).where(eq(situacaoConfig.id, id));

    if (!updated) return apiError("Situacao nao encontrada", 404);

    return apiSuccess(updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return apiError("Ja existe uma situacao com esse nome", 409);
    }
    console.error("API PUT /api/situacao-config/[id]:", error);
    return apiError("Erro ao atualizar situacao", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "proprietario") return apiError("Apenas o proprietário pode configurar situações", 403);

    const { id } = await params;

    const [toDelete] = await db.select({ id: situacaoConfig.id, nome: situacaoConfig.nome }).from(situacaoConfig).where(eq(situacaoConfig.id, id));

    if (!toDelete) return apiError("Situacao nao encontrada", 404);

    await db.delete(situacaoConfig).where(eq(situacaoConfig.id, id));

    return apiSuccess(toDelete);
  } catch (error) {
    console.error("API DELETE /api/situacao-config/[id]:", error);
    return apiError("Erro ao excluir situacao", 500);
  }
}
