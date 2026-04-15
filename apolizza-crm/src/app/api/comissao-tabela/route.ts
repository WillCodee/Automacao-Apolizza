import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { comissaoTabela } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

// GET — list all commission rates, or filter by seguradora/produto
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { searchParams } = req.nextUrl;
    const seguradora = searchParams.get("seguradora");
    const produto = searchParams.get("produto");

    const conditions = [];
    if (seguradora) conditions.push(eq(comissaoTabela.seguradora, seguradora));
    if (produto) conditions.push(eq(comissaoTabela.produto, produto));

    const rows = await db
      .select()
      .from(comissaoTabela)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(comissaoTabela.seguradora);

    return apiSuccess(rows);
  } catch (error) {
    console.error("API GET /api/comissao-tabela:", error);
    return apiError("Erro ao buscar tabela de comissao", 500);
  }
}

// POST — admin creates a new commission rate
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "admin" && user.role !== "proprietario") return apiError("Acesso negado", 403);

    const body = await req.json();
    const { seguradora, produto, percentual } = body as {
      seguradora: string;
      produto?: string;
      percentual: number;
    };

    if (!seguradora?.trim()) return apiError("Seguradora obrigatoria", 400);
    if (typeof percentual !== "number" || percentual < 0 || percentual > 100) {
      return apiError("Percentual deve ser entre 0 e 100", 400);
    }

    const [row] = await db.insert(comissaoTabela).values({
      seguradora: seguradora.trim(),
      produto: produto?.trim() || null,
      percentual: String(percentual),
    }).returning();

    return apiSuccess(row, 201);
  } catch (error) {
    console.error("API POST /api/comissao-tabela:", error);
    return apiError("Erro ao criar taxa de comissao", 500);
  }
}
