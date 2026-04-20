import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { metasProduto } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

// GET /api/metas/produto?ano=2026&mes=4
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { searchParams } = req.nextUrl;
    const ano = Number(searchParams.get("ano"));
    const mes = Number(searchParams.get("mes"));

    if (!ano || !mes) return apiError("Ano e mes obrigatorios", 400);

    const result = await db
      .select()
      .from(metasProduto)
      .where(and(eq(metasProduto.ano, ano), eq(metasProduto.mes, mes)));

    return apiSuccess(result);
  } catch (error) {
    console.error("API GET /api/metas/produto:", error);
    return apiError("Erro ao buscar metas por produto", 500);
  }
}

// POST /api/metas/produto  { ano, mes, produto, metaValor }
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "proprietario") return apiError("Apenas o proprietário pode definir metas", 403);

    const body = await req.json();
    const { ano, mes, produto, metaValor } = body;

    if (!ano || !mes || !produto) return apiError("Ano, mes e produto obrigatorios", 400);

    const anoNum = Number(ano);
    const mesNum = Number(mes);
    if (anoNum < 2020 || anoNum > 2035) return apiError("Ano invalido", 400);
    if (mesNum < 1 || mesNum > 12) return apiError("Mes invalido", 400);

    const existing = await db
      .select()
      .from(metasProduto)
      .where(and(eq(metasProduto.ano, anoNum), eq(metasProduto.mes, mesNum), eq(metasProduto.produto, produto)));

    const values = {
      metaValor: metaValor != null && metaValor !== "" ? String(metaValor) : null,
    };

    if (existing.length > 0) {
      const [updated] = await db
        .update(metasProduto)
        .set(values)
        .where(eq(metasProduto.id, existing[0].id))
        .returning();
      return apiSuccess(updated);
    }

    const [created] = await db
      .insert(metasProduto)
      .values({ ano: anoNum, mes: mesNum, produto, ...values })
      .returning();

    return apiSuccess(created);
  } catch (error) {
    console.error("API POST /api/metas/produto:", error);
    return apiError("Erro ao salvar meta por produto", 500);
  }
}

// DELETE /api/metas/produto?ano=2026&mes=4  — zera todas do mês
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "proprietario") return apiError("Apenas o proprietário pode limpar metas", 403);

    const { searchParams } = req.nextUrl;
    const ano = Number(searchParams.get("ano"));
    const mes = Number(searchParams.get("mes"));

    if (!ano || !mes) return apiError("Ano e mes obrigatorios", 400);

    await db
      .delete(metasProduto)
      .where(and(eq(metasProduto.ano, ano), eq(metasProduto.mes, mes)));

    return apiSuccess({ cleared: true });
  } catch (error) {
    console.error("API DELETE /api/metas/produto:", error);
    return apiError("Erro ao limpar metas por produto", 500);
  }
}
