import { NextRequest } from "next/server";
import { eq, and, count, sql, desc as descOrder } from "drizzle-orm";
import { db } from "@/lib/db";
import { tarefas, tarefasChecklist, users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { tarefaCreateSchema } from "@/lib/validations";
import { apiError, apiPaginated, apiSuccess } from "@/lib/api-helpers";
import { logAtividade } from "@/lib/audit-log";
import { alias } from "drizzle-orm/mysql-core";

const cotadorUser = alias(users, "cotadorUser");
const criadorUser = alias(users, "criadorUser");

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
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const mesFilter = searchParams.get("mes");
    const anoFilter = searchParams.get("ano");

    const conditions = [];

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
      conditions.push(sql`MONTH(${tarefas.dataVencimento}) = ${Number(mesFilter)}`);
    }
    if (anoFilter) {
      conditions.push(sql`YEAR(${tarefas.dataVencimento}) = ${Number(anoFilter)}`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ value: count() })
      .from(tarefas)
      .where(where);

    const total = Number(totalResult?.value || 0);

    // LEFT JOIN manual — compatível com MySQL 5.7 (sem LATERAL)
    const rows = await db
      .select({
        id: tarefas.id,
        titulo: tarefas.titulo,
        descricao: tarefas.descricao,
        dataVencimento: tarefas.dataVencimento,
        status: tarefas.status,
        cotadorId: tarefas.cotadorId,
        criadorId: tarefas.criadorId,
        visualizadaEm: tarefas.visualizadaEm,
        iniciadaEm: tarefas.iniciadaEm,
        concluidaEm: tarefas.concluidaEm,
        createdAt: tarefas.createdAt,
        updatedAt: tarefas.updatedAt,
        cotadorName: cotadorUser.name,
        cotadorEmail: cotadorUser.email,
        cotadorPhotoUrl: cotadorUser.photoUrl,
        criadorName: criadorUser.name,
        criadorEmail: criadorUser.email,
      })
      .from(tarefas)
      .leftJoin(cotadorUser, eq(tarefas.cotadorId, cotadorUser.id))
      .leftJoin(criadorUser, eq(tarefas.criadorId, criadorUser.id))
      .where(where)
      .orderBy(descOrder(tarefas.createdAt))
      .limit(limit)
      .offset(offset);

    // Formatar para manter compatibilidade com o frontend
    const formatted = rows.map((r) => ({
      id: r.id,
      titulo: r.titulo,
      descricao: r.descricao,
      dataVencimento: r.dataVencimento,
      status: r.status,
      cotadorId: r.cotadorId,
      criadorId: r.criadorId,
      visualizadaEm: r.visualizadaEm,
      iniciadaEm: r.iniciadaEm,
      concluidaEm: r.concluidaEm,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      cotador: {
        id: r.cotadorId,
        name: r.cotadorName,
        email: r.cotadorEmail,
        photoUrl: r.cotadorPhotoUrl,
      },
      criador: {
        id: r.criadorId,
        name: r.criadorName,
        email: r.criadorEmail,
      },
    }));

    return apiPaginated(formatted, { page, limit, total });
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
