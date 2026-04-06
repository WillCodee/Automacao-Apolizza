import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tarefas } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

// POST /api/tarefas/[id]/visualizar — marca tarefa como visualizada pelo destinatário
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autenticado", 401);

    const { id } = await params;

    const tarefa = await db.query.tarefas.findFirst({ where: eq(tarefas.id, id) });
    if (!tarefa) return apiError("Tarefa não encontrada", 404);

    // Apenas o destinatário (cotador) marca como visualizada
    if (tarefa.cotadorId !== user.id) return apiSuccess({ skipped: true });

    // Só marca uma vez
    if (tarefa.visualizadaEm) return apiSuccess({ alreadyViewed: true });

    await db
      .update(tarefas)
      .set({ visualizadaEm: new Date() })
      .where(eq(tarefas.id, id));

    return apiSuccess({ visualizadaEm: new Date() });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Erro", 500);
  }
}
