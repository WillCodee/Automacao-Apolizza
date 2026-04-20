import { NextRequest } from "next/server";
import { eq, and, count, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tarefas, tarefasChecklist } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { tarefaCreateSchema } from "@/lib/validations";
import { apiError, apiPaginated, apiSuccess } from "@/lib/api-helpers";
import { logAtividade } from "@/lib/audit-log";

// GET /api/tarefas - Listar tarefas
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autenticado", 401);

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
    const offset = (page - 1) * limit;

    const statusFilter = searchParams.get("status");
    const cotadorIdFilter = searchParams.get("cotadorId");
    const dateFrom = searchParams.get("dateFrom"); // YYYY-MM-DD
    const dateTo = searchParams.get("dateTo");     // YYYY-MM-DD
    const mesFilter = searchParams.get("mes");     // 1-12
    const anoFilter = searchParams.get("ano");     // YYYY

    const conditions = [];

    // Cotador vê apenas suas tarefas
    if (user.role === "cotador") {
      conditions.push(eq(tarefas.cotadorId, user.id));
    } else if (cotadorIdFilter) {
      conditions.push(eq(tarefas.cotadorId, cotadorIdFilter));
    }

    if (statusFilter) {
      conditions.push(eq(tarefas.status, statusFilter as "Pendente" | "Em Andamento" | "Concluída" | "Cancelada"));
    }

    if (dateFrom) {
      conditions.push(sql`DATE(${tarefas.dataVencimento}) >= ${dateFrom}`);
    }
    if (dateTo) {
      conditions.push(sql`DATE(${tarefas.dataVencimento}) <= ${dateTo}`);
    }
    if (mesFilter) {
      conditions.push(sql`EXTRACT(MONTH FROM ${tarefas.dataVencimento}) = ${Number(mesFilter)}`);
    }
    if (anoFilter) {
      conditions.push(sql`EXTRACT(YEAR FROM ${tarefas.dataVencimento}) = ${Number(anoFilter)}`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ value: count() })
      .from(tarefas)
      .where(where);

    const total = Number(totalResult?.value || 0);

    const rows = await db.query.tarefas.findMany({
      where,
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
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit,
      offset,
    });

    return apiPaginated(rows, { page, limit, total });
  } catch (error) {
    console.error("GET /api/tarefas error:", error);
    return apiError(error instanceof Error ? error.message : "Erro ao listar tarefas", 500);
  }
}

// POST /api/tarefas - Criar tarefa
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autenticado", 401);

    // Apenas admin/proprietario pode criar tarefas
    if (user.role !== "admin" && user.role !== "proprietario") {
      return apiError("Apenas administradores podem criar tarefas", 403);
    }

    const body = await req.json();
    const { checklistItems, ...rest } = body;
    const validated = tarefaCreateSchema.parse(rest);

    const insertValues = {
      titulo: validated.titulo,
      descricao: validated.descricao,
      dataVencimento: validated.dataVencimento
        ? new Date(validated.dataVencimento)
        : null,
      status: validated.status,
      cotadorId: validated.cotadorId,
      criadorId: user.id,
    };
    await db.insert(tarefas).values(insertValues);
    const [novaTarefa] = await db
      .select()
      .from(tarefas)
      .where(and(eq(tarefas.criadorId, user.id), eq(tarefas.titulo, validated.titulo)))
      .orderBy(sql`${tarefas.createdAt} DESC`)
      .limit(1);

    // Salvar itens do checklist
    if (Array.isArray(checklistItems) && checklistItems.length > 0) {
      const items = checklistItems
        .filter((t: string) => t?.trim())
        .map((t: string, i: number) => ({
          tarefaId: novaTarefa.id,
          texto: t.trim(),
          ordem: i,
        }));
      if (items.length > 0) {
        await db.insert(tarefasChecklist).values(items);
      }
    }

    // Registrar atividade
    await logAtividade({
      tarefaId: novaTarefa.id,
      usuarioId: user.id,
      tipoAcao: "CRIADA",
      detalhes: {
        titulo: novaTarefa.titulo,
        cotadorId: novaTarefa.cotadorId,
        status: novaTarefa.status,
      },
    });

    return apiSuccess(novaTarefa, 201);
  } catch (error) {
    console.error("POST /api/tarefas error:", error);

    if (error && typeof error === "object" && "name" in error && error.name === "ZodError") {
      const zodError = error as unknown as { errors: Array<{ message: string }> };
      return apiError(
        "Dados inválidos: " + zodError.errors.map((e) => e.message).join(", "),
        400
      );
    }

    return apiError(error instanceof Error ? error.message : "Erro ao criar tarefa", 500);
  }
}
