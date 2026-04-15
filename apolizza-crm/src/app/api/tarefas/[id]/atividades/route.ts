import { getCurrentUser } from "@/lib/auth-helpers";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { tarefas, tarefasAtividades } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/tarefas/[id]/atividades - Listar histórico de atividades
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError("Não autenticado", 401);
    }

    const { id: tarefaId } = await params;

    // Verificar se tarefa existe
    const tarefa = await db.query.tarefas.findFirst({
      where: eq(tarefas.id, tarefaId),
    });

    if (!tarefa) {
      return apiError("Tarefa não encontrada", 404);
    }

    // Verificar permissão (cotador só vê atividades das suas tarefas)
    if (user.role !== "admin" && user.role !== "proprietario" && tarefa.cotadorId !== user.id) {
      return apiError("Sem permissão para acessar esta tarefa", 403);
    }

    // Buscar atividades com informações do usuário
    const atividades = await db.query.tarefasAtividades.findMany({
      where: eq(tarefasAtividades.tarefaId, tarefaId),
      orderBy: desc(tarefasAtividades.createdAt),
      with: {
        usuario: {
          columns: {
            id: true,
            name: true,
            photoUrl: true,
          },
        },
      },
    });

    return apiSuccess(atividades);
  } catch (error) {
    console.error("Erro ao listar atividades:", error);
    return apiError(
      error instanceof Error ? error.message : "Erro ao listar atividades",
      500
    );
  }
}
