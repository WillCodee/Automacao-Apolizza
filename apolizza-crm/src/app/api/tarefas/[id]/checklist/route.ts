import { NextRequest } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tarefas, tarefasChecklist } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

// GET /api/tarefas/[id]/checklist
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autenticado", 401);

    const { id } = await params;

    const tarefa = await db.query.tarefas.findFirst({
      where: eq(tarefas.id, id),
    });
    if (!tarefa) return apiError("Tarefa não encontrada", 404);

    if (user.role !== "admin" && user.role !== "proprietario" && tarefa.cotadorId !== user.id && tarefa.criadorId !== user.id) {
      return apiError("Sem permissão", 403);
    }

    const items = await db.query.tarefasChecklist.findMany({
      where: eq(tarefasChecklist.tarefaId, id),
      with: {
        concluidoPorUser: { columns: { id: true, name: true } },
      },
      orderBy: (c, { asc }) => [asc(c.ordem), asc(c.createdAt)],
    });

    return apiSuccess(items);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Erro", 500);
  }
}

// POST /api/tarefas/[id]/checklist — adicionar item
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autenticado", 401);

    const { id } = await params;
    const { texto, ordem } = await req.json();

    if (!texto?.trim()) return apiError("Texto é obrigatório", 400);

    const tarefa = await db.query.tarefas.findFirst({ where: eq(tarefas.id, id) });
    if (!tarefa) return apiError("Tarefa não encontrada", 404);

    if (user.role !== "admin" && user.role !== "proprietario" && tarefa.criadorId !== user.id) {
      return apiError("Sem permissão", 403);
    }

    const insertData = {
      tarefaId: id,
      texto: texto.trim(),
      ordem: ordem ?? 0,
    };
    await db.insert(tarefasChecklist).values(insertData);
    const [item] = await db
      .select()
      .from(tarefasChecklist)
      .where(and(eq(tarefasChecklist.tarefaId, id), eq(tarefasChecklist.texto, insertData.texto)))
      .orderBy(sql`${tarefasChecklist.createdAt} DESC`)
      .limit(1);

    return apiSuccess(item, 201);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Erro", 500);
  }
}

// PATCH /api/tarefas/[id]/checklist?itemId=xxx — toggle item
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autenticado", 401);

    const { id } = await params;
    const { itemId, concluido } = await req.json();

    if (!itemId) return apiError("itemId é obrigatório", 400);

    const tarefa = await db.query.tarefas.findFirst({ where: eq(tarefas.id, id) });
    if (!tarefa) return apiError("Tarefa não encontrada", 404);

    if (user.role !== "admin" && user.role !== "proprietario" && tarefa.cotadorId !== user.id && tarefa.criadorId !== user.id) {
      return apiError("Sem permissão", 403);
    }

    await db
      .update(tarefasChecklist)
      .set({
        concluido,
        concluidoPor: concluido ? user.id : null,
        concluidoEm: concluido ? new Date() : null,
      })
      .where(and(eq(tarefasChecklist.id, itemId), eq(tarefasChecklist.tarefaId, id)));
    const [updated] = await db.select().from(tarefasChecklist).where(eq(tarefasChecklist.id, itemId));

    return apiSuccess(updated);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Erro", 500);
  }
}
