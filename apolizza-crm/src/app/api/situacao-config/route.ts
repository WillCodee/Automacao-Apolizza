import { NextRequest } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { situacaoConfig } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const rows = await db
      .select()
      .from(situacaoConfig)
      .orderBy(asc(situacaoConfig.orderIndex), asc(situacaoConfig.nome));

    return apiSuccess(rows);
  } catch (error) {
    console.error("API GET /api/situacao-config:", error);
    return apiError("Erro ao listar situacoes", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "admin") return apiError("Apenas admin", 403);

    const body = await req.json();
    const { nome, orderIndex, defaultCotadorId } = body;

    if (!nome?.trim()) return apiError("Nome e obrigatorio", 400);

    const [created] = await db
      .insert(situacaoConfig)
      .values({
        nome: nome.trim().toUpperCase(),
        orderIndex: orderIndex ?? 0,
        defaultCotadorId: defaultCotadorId || null,
      })
      .returning();

    return apiSuccess(created, 201);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return apiError("Ja existe uma situacao com esse nome", 409);
    }
    console.error("API POST /api/situacao-config:", error);
    return apiError("Erro ao criar situacao", 500);
  }
}
