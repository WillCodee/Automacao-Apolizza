import { NextRequest } from "next/server";
import { eq, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, cotacoes } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

// PUT /api/users/:id (edit user)
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "proprietario") return apiError("Apenas o proprietário pode gerenciar usuários", 403);

    const { id } = await params;
    const body = await req.json();
    const { name, email, role, password, isActive } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        username: users.username,
        role: users.role,
        isActive: users.isActive,
      });

    if (!updated) return apiError("Usuario nao encontrado", 404);

    return apiSuccess(updated);
  } catch (error) {
    console.error("API PUT /api/users/[id]:", error);
    return apiError("Erro ao atualizar usuario", 500);
  }
}

// DELETE /api/users/:id — exclusão permanente
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "proprietario") return apiError("Apenas o proprietário pode excluir usuários", 403);

    const { id } = await params;

    if (id === user.id) {
      return apiError("Nao pode excluir a si mesmo", 400);
    }

    // Conta cotações vinculadas (assignee_id será NULL após exclusão pelo ON DELETE SET NULL)
    const [{ cotacoesCount }] = await db
      .select({ cotacoesCount: count() })
      .from(cotacoes)
      .where(eq(cotacoes.assigneeId, id));

    // Exclui o usuário — cotações terão assignee_id = NULL (ON DELETE SET NULL)
    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id, name: users.name });

    if (!deleted) return apiError("Usuario nao encontrado", 404);

    return apiSuccess({ ...deleted, cotacoesDesvinculadas: Number(cotacoesCount) });
  } catch (error) {
    console.error("API DELETE /api/users/[id]:", error);
    return apiError("Erro ao excluir usuario", 500);
  }
}
