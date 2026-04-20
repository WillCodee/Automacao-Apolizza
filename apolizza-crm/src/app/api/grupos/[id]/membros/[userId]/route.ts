import { db } from "@/lib/db";
import { grupoMembros } from "@/lib/schema";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/auth-helpers";
import { and, eq } from "drizzle-orm";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return apiError("Não autenticado", 401);
  if (currentUser.role !== "admin" && currentUser.role !== "proprietario") return apiError("Acesso negado.", 403);

  const { id: grupoId, userId } = await params;

  const [toDelete] = await db
    .select({ grupoId: grupoMembros.grupoId, userId: grupoMembros.userId })
    .from(grupoMembros)
    .where(and(eq(grupoMembros.grupoId, grupoId), eq(grupoMembros.userId, userId)));

  if (!toDelete) return apiError("Membro não encontrado neste grupo", 404);

  await db.delete(grupoMembros).where(and(eq(grupoMembros.grupoId, grupoId), eq(grupoMembros.userId, userId)));

  return apiSuccess({ ok: true });
}
