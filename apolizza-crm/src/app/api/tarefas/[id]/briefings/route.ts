import { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { tarefas, tarefasBriefings } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { createBriefingSchema } from "@/lib/validations";
import { apiError, apiSuccess } from "@/lib/api-helpers";

// GET /api/tarefas/[id]/briefings - Listar briefings da tarefa
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autenticado", 401);

    const { id } = await params;

    // Verificar se tarefa existe
    const tarefa = await db.query.tarefas.findFirst({
      where: eq(tarefas.id, id),
    });

    if (!tarefa) {
      return apiError("Tarefa não encontrada", 404);
    }

    // Cotador só pode ver briefings das suas tarefas
    if (user.role !== "admin" && tarefa.cotadorId !== user.id) {
      return apiError("Sem permissão para acessar esta tarefa", 403);
    }

    // Buscar briefings ordenados por created_at DESC
    const briefings = await db.query.tarefasBriefings.findMany({
      where: eq(tarefasBriefings.tarefaId, id),
      with: {
        usuario: {
          columns: {
            id: true,
            name: true,
            email: true,
            photoUrl: true,
          },
        },
      },
      orderBy: [desc(tarefasBriefings.createdAt)],
    });

    return apiSuccess(briefings);
  } catch (error) {
    console.error(`GET /api/tarefas/[id]/briefings error:`, error);
    return apiError(
      error instanceof Error ? error.message : "Erro ao listar briefings",
      500
    );
  }
}

// POST /api/tarefas/[id]/briefings - Adicionar briefing
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autenticado", 401);

    const { id } = await params;

    // Verificar se tarefa existe
    const tarefa = await db.query.tarefas.findFirst({
      where: eq(tarefas.id, id),
    });

    if (!tarefa) {
      return apiError("Tarefa não encontrada", 404);
    }

    // Cotador só pode adicionar briefings às suas tarefas
    if (user.role !== "admin" && tarefa.cotadorId !== user.id) {
      return apiError(
        "Você só pode adicionar briefings às suas próprias tarefas",
        403
      );
    }

    const body = await req.json();
    const validated = createBriefingSchema.parse(body);

    // Criar briefing
    const [novoBriefing] = await db
      .insert(tarefasBriefings)
      .values({
        tarefaId: id,
        usuarioId: user.id,
        briefing: validated.briefing,
      })
      .returning();

    // Buscar briefing com relations
    const briefingCompleto = await db.query.tarefasBriefings.findFirst({
      where: eq(tarefasBriefings.id, novoBriefing.id),
      with: {
        usuario: {
          columns: {
            id: true,
            name: true,
            email: true,
            photoUrl: true,
          },
        },
      },
    });

    return apiSuccess(briefingCompleto, 201);
  } catch (error) {
    console.error(`POST /api/tarefas/[id]/briefings error:`, error);

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
      error instanceof Error ? error.message : "Erro ao adicionar briefing",
      500
    );
  }
}
