import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tarefas } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { updateStatusSchema } from "@/lib/validations";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { logAtividade } from "@/lib/audit-log";

// PATCH /api/tarefas/[id]/status - Atualizar status da tarefa
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autenticado", 401);

    const { id } = await params;

    // Buscar tarefa
    const tarefa = await db.query.tarefas.findFirst({
      where: eq(tarefas.id, id),
    });

    if (!tarefa) {
      return apiError("Tarefa não encontrada", 404);
    }

    // Validação: cotador só pode atualizar suas próprias tarefas
    // Admin pode atualizar qualquer tarefa
    if (user.role !== "admin" && user.role !== "proprietario" && tarefa.cotadorId !== user.id) {
      return apiError(
        "Você só pode atualizar o status das suas próprias tarefas",
        403
      );
    }

    const body = await req.json();
    const validated = updateStatusSchema.parse(body);

    // Atualizar status + timestamps
    const statusAnterior = tarefa.status;
    const now = new Date();
    const extraFields: Record<string, Date | null> = {};
    if (validated.status === "Em Andamento" && !tarefa.iniciadaEm) {
      extraFields.iniciadaEm = now;
    }
    if (validated.status === "Concluída") {
      extraFields.concluidaEm = now;
    }

    const [tarefaAtualizada] = await db
      .update(tarefas)
      .set({ status: validated.status, ...extraFields })
      .where(eq(tarefas.id, id))
      .returning();

    // Registrar atividade
    await logAtividade({
      tarefaId: id,
      usuarioId: user.id,
      tipoAcao: "STATUS_ALTERADO",
      detalhes: {
        valorAnterior: statusAnterior,
        valorNovo: validated.status,
      },
    });

    return apiSuccess(tarefaAtualizada);
  } catch (error) {
    console.error(`PATCH /api/tarefas/[id]/status error:`, error);

    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "ZodError"
    ) {
      const zodError = error as unknown as {
        errors: Array<{ message: string }>;
      };
      return apiError(
        "Dados inválidos: " + zodError.errors.map((e) => e.message).join(", "),
        400
      );
    }

    return apiError(
      error instanceof Error ? error.message : "Erro ao atualizar status",
      500
    );
  }
}
