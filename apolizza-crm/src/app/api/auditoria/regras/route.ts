import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { regrasAuditoria } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { z } from "zod/v4";

const schema = z.object({
  nome: z.string().min(1).max(100),
  comando: z.string().min(2).max(50).regex(/^\/[a-z0-9_]+$/, "Comando deve começar com / e conter apenas letras, números e _"),
  tipo: z.enum(["atrasados", "tarefas_hoje", "tratativas", "pendentes", "relatorio", "resumo"]),
  descricao: z.string().max(200).optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "proprietario")) {
      return apiError("Sem permissão", 403);
    }
    const rows = await db
      .select()
      .from(regrasAuditoria)
      .orderBy(regrasAuditoria.createdAt);
    return apiSuccess(rows);
  } catch (err) {
    console.error("GET /api/auditoria/regras:", err);
    return apiError("Erro interno", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "proprietario")) {
      return apiError("Sem permissão", 403);
    }
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message || "Dados inválidos", 400);

    const { nome, comando, tipo, descricao } = parsed.data;
    await db
      .insert(regrasAuditoria)
      .values({ nome, comando, tipo, descricao: descricao ?? null });
    const [row] = await db
      .select()
      .from(regrasAuditoria)
      .where(eq(regrasAuditoria.comando, comando));
    return apiSuccess(row, 201);
  } catch (err) {
    console.error("POST /api/auditoria/regras:", err);
    return apiError("Erro interno", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "proprietario")) {
      return apiError("Sem permissão", 403);
    }
    const { searchParams } = req.nextUrl;
    const id = searchParams.get("id");
    if (!id) return apiError("ID obrigatório", 400);

    await db.delete(regrasAuditoria).where(eq(regrasAuditoria.id, id));
    return apiSuccess({ ok: true });
  } catch (err) {
    console.error("DELETE /api/auditoria/regras:", err);
    return apiError("Erro interno", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "proprietario")) {
      return apiError("Sem permissão", 403);
    }
    const body = await req.json();
    const { id, ativo } = body;
    if (!id) return apiError("ID obrigatório", 400);

    await db
      .update(regrasAuditoria)
      .set({ ativo })
      .where(eq(regrasAuditoria.id, id));
    return apiSuccess({ ok: true });
  } catch (err) {
    console.error("PATCH /api/auditoria/regras:", err);
    return apiError("Erro interno", 500);
  }
}
