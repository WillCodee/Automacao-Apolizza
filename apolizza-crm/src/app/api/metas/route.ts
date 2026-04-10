import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { metas } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess, validateAno } from "@/lib/api-helpers";

// GET /api/metas?ano=2026&mes=3
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { searchParams } = req.nextUrl;
    const ano = searchParams.get("ano");

    // Param validation (Story 10.2)
    if (!validateAno(ano)) return apiError("Ano invalido", 400);

    const conditions = [];
    if (ano) conditions.push(eq(metas.ano, Number(ano)));
    // Admin vê metas globais (userId null) e de todos; cotador vê só suas
    if (user.role === "cotador") {
      conditions.push(eq(metas.userId, user.id));
    }

    const result = await db
      .select()
      .from(metas)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return apiSuccess(result);
  } catch (error) {
    console.error("API GET /api/metas:", error);
    return apiError("Erro ao buscar metas", 500);
  }
}

// POST /api/metas
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "proprietario") return apiError("Apenas o proprietário pode definir metas", 403);

    const body = await req.json();
    const { ano, mes, metaValor, metaQtdCotacoes, metaRenovacoes, userId } = body;

    if (!ano || !mes) return apiError("Ano e mes sao obrigatorios", 400);

    const anoNum = Number(ano);
    const mesNum = Number(mes);
    if (!Number.isInteger(anoNum) || anoNum < 2020 || anoNum > 2030) {
      return apiError("Ano invalido", 400);
    }
    if (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12) {
      return apiError("Mes invalido", 400);
    }

    // Upsert: check if exists
    const existing = await db
      .select()
      .from(metas)
      .where(
        and(
          eq(metas.ano, anoNum),
          eq(metas.mes, mesNum),
          userId ? eq(metas.userId, userId) : undefined
        )
      );

    if (existing.length > 0) {
      const [updated] = await db
        .update(metas)
        .set({
          metaValor: metaValor?.toString() ?? null,
          metaQtdCotacoes: metaQtdCotacoes ?? null,
          metaRenovacoes: metaRenovacoes ?? null,
        })
        .where(eq(metas.id, existing[0].id))
        .returning();
      return apiSuccess(updated);
    }

    const [created] = await db
      .insert(metas)
      .values({
        userId: userId || null,
        ano: anoNum,
        mes: mesNum,
        metaValor: metaValor?.toString() ?? null,
        metaQtdCotacoes: metaQtdCotacoes ?? null,
        metaRenovacoes: metaRenovacoes ?? null,
      })
      .returning();

    return apiSuccess(created);
  } catch (error) {
    console.error("API POST /api/metas:", error);
    return apiError("Erro ao salvar meta", 500);
  }
}
