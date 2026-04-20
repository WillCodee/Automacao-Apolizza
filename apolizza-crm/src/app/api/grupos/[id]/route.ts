import { z } from "zod/v4";
import { db } from "@/lib/db";
import { gruposUsuarios } from "@/lib/schema";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/auth-helpers";
import { eq } from "drizzle-orm";

const updateGrupoSchema = z.object({
  nome: z.string().min(1).max(100).optional(),
  descricao: z.string().optional(),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return apiError("Não autenticado", 401);
  if (currentUser.role !== "admin" && currentUser.role !== "proprietario") return apiError("Acesso negado.", 403);

  const { id } = await params;

  const body = await request.json();
  const parsed = updateGrupoSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const updates: Partial<{ nome: string; descricao: string | null; cor: string }> = {};
  if (parsed.data.nome !== undefined) updates.nome = parsed.data.nome;
  if (parsed.data.descricao !== undefined) updates.descricao = parsed.data.descricao;
  if (parsed.data.cor !== undefined) updates.cor = parsed.data.cor;

  await db
    .update(gruposUsuarios)
    .set(updates)
    .where(eq(gruposUsuarios.id, id));
  const [updated] = await db.select().from(gruposUsuarios).where(eq(gruposUsuarios.id, id));

  if (!updated) return apiError("Grupo não encontrado", 404);

  return apiSuccess(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return apiError("Não autenticado", 401);
  if (currentUser.role !== "admin" && currentUser.role !== "proprietario") return apiError("Acesso negado.", 403);

  const { id } = await params;

  const [toDelete] = await db.select({ id: gruposUsuarios.id }).from(gruposUsuarios).where(eq(gruposUsuarios.id, id));

  if (!toDelete) return apiError("Grupo não encontrado", 404);

  await db.delete(gruposUsuarios).where(eq(gruposUsuarios.id, id));

  return apiSuccess({ ok: true });
}
