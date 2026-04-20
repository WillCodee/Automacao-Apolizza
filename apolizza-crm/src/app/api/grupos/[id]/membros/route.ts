import { z } from "zod/v4";
import { db } from "@/lib/db";
import { grupoMembros, users } from "@/lib/schema";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/auth-helpers";
import { eq, and } from "drizzle-orm";

const addMembroSchema = z.object({
  userId: z.string().uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return apiError("Não autenticado", 401);
  if (currentUser.role !== "admin" && currentUser.role !== "proprietario") return apiError("Acesso negado.", 403);

  const { id: grupoId } = await params;

  const body = await request.json();
  const parsed = addMembroSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { userId } = parsed.data;

  // Verify user exists
  const [userExists] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
  if (!userExists) return apiError("Usuário não encontrado", 404);

  try {
    const insertData = { grupoId, userId };
    await db.insert(grupoMembros).values(insertData);
    const [inserted] = await db
      .select()
      .from(grupoMembros)
      .where(and(eq(grupoMembros.grupoId, grupoId), eq(grupoMembros.userId, userId)));

    return apiSuccess(inserted, 201);
  } catch {
    return apiError("Usuário já é membro deste grupo", 409);
  }
}
