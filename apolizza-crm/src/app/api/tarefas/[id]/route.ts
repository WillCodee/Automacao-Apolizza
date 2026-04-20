import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tarefas } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { tarefaUpdateSchema } from "@/lib/validations";
import { apiError, apiSuccess } from "@/lib/api-helpers";

// GET /api/tarefas/[id] - Obter tarefa específica
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autenticado", 401);

    const { id } = await params;

    const tarefa = await db.query.tarefas.findFirst({
      where: eq(tarefas.id, id),
      with: {
        cotador: {
          columns: {
            id: true,
            name: true,
            email: true,
            photoUrl: true,
          },
        },
        criador: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!tarefa) {
      return apiError("Tarefa não encontrada", 404);
    }

    // Cotador só pode ver suas próprias tarefas
    if (user.role === "cotador" && tarefa.cotadorId !== user.id) {
      return apiError("Sem permissão para acessar esta tarefa", 403);
    }

    return apiSuccess(tarefa);
  } catch (error) {
    console.error(`GET /api/tarefas/[id] error:`, error);
    return apiError(error instanceof Error ? error.message : "Erro ao buscar tarefa", 500);
  }
}

// PATCH /api/tarefas/[id] - Editar tarefa
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autenticado", 401);

    const { id } = await params;

    // Apenas admin pode editar tarefas
    if (user.role !== "admin" && user.role !== "proprietario") {
      return apiError("Apenas administradores podem editar tarefas", 403);
    }

    const tarefa = await db.query.tarefas.findFirst({
      where: eq(tarefas.id, id),
    });

    if (!tarefa) {
      return apiError("Tarefa não encontrada", 404);
    }

    const body = await req.json();
    const validated = tarefaUpdateSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (validated.titulo !== undefined) updateData.titulo = validated.titulo;
    if (validated.descricao !== undefined) updateData.descricao = validated.descricao;
    if (validated.dataVencimento !== undefined) {
      updateData.dataVencimento = validated.dataVencimento
        ? new Date(validated.dataVencimento)
        : null;
    }
    if (validated.status !== undefined) updateData.status = validated.status;
    if (validated.cotadorId !== undefined) updateData.cotadorId = validated.cotadorId;

    await db
      .update(tarefas)
      .set(updateData)
      .where(eq(tarefas.id, id));
    const [tarefaAtualizada] = await db.select().from(tarefas).where(eq(tarefas.id, id));

    return apiSuccess(tarefaAtualizada);
  } catch (error) {
    console.error(`PATCH /api/tarefas/[id] error:`, error);

    if (error && typeof error === "object" && "name" in error && error.name === "ZodError") {
      const zodError = error as unknown as { errors: Array<{ message: string }> };
      return apiError(
        "Dados inválidos: " + zodError.errors.map((e) => e.message).join(", "),
        400
      );
    }

    return apiError(error instanceof Error ? error.message : "Erro ao atualizar tarefa", 500);
  }
}

// DELETE /api/tarefas/[id] - Deletar tarefa
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autenticado", 401);

    const { id } = await params;

    // Apenas admin pode deletar tarefas
    if (user.role !== "admin" && user.role !== "proprietario") {
      return apiError("Apenas administradores podem deletar tarefas", 403);
    }

    const tarefa = await db.query.tarefas.findFirst({
      where: eq(tarefas.id, id),
    });

    if (!tarefa) {
      return apiError("Tarefa não encontrada", 404);
    }

    await db.delete(tarefas).where(eq(tarefas.id, id));

    return apiSuccess({ message: "Tarefa deletada com sucesso" });
  } catch (error) {
    console.error(`DELETE /api/tarefas/[id] error:`, error);
    return apiError(error instanceof Error ? error.message : "Erro ao deletar tarefa", 500);
  }
}
