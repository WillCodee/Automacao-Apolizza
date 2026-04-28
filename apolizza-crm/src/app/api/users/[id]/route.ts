import { NextRequest } from "next/server";
import { eq, count, and, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  users, cotacoes, cotacaoDocs, cotacaoHistory, cotacaoMensagens,
  metas, tarefas, tarefasBriefings, tarefasAnexos, tarefasAtividades,
  tarefasChecklist, chatMensagens,
} from "@/lib/schema";
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
    const { name, email, username, role, password, isActive } = body;

    if (email !== undefined) {
      const [dup] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email), ne(users.id, id)));
      if (dup) return apiError("Email já cadastrado por outro usuário", 409);
    }

    if (username !== undefined) {
      const [dup] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, username), ne(users.id, id)));
      if (dup) return apiError("Username já cadastrado por outro usuário", 409);
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (username !== undefined) updateData.username = username;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id));

    const [updated] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        username: users.username,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, id));

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

    // Buscar dados antes de deletar
    const [toDelete] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, id));

    if (!toDelete) return apiError("Usuario nao encontrado", 404);

    // Limpa todas as FKs antes de deletar (MySQL não tem cascade configurado)
    await db.delete(chatMensagens).where(eq(chatMensagens.fromUserId, id));
    await db.update(chatMensagens).set({ toUserId: null }).where(eq(chatMensagens.toUserId, id));
    await db.delete(cotacaoMensagens).where(eq(cotacaoMensagens.userId, id));
    await db.update(cotacaoHistory).set({ userId: null }).where(eq(cotacaoHistory.userId, id));
    await db.delete(tarefasBriefings).where(eq(tarefasBriefings.usuarioId, id));
    await db.delete(tarefasAnexos).where(eq(tarefasAnexos.usuarioId, id));
    await db.delete(tarefasAtividades).where(eq(tarefasAtividades.usuarioId, id));
    await db.delete(tarefas).where(eq(tarefas.criadorId, id));
    await db.update(tarefasChecklist).set({ concluidoPor: null }).where(eq(tarefasChecklist.concluidoPor, id));
    await db.update(cotacaoDocs).set({ uploadedBy: null }).where(eq(cotacaoDocs.uploadedBy, id));
    await db.update(metas).set({ userId: null }).where(eq(metas.userId, id));
    await db.update(cotacoes).set({ assigneeId: null }).where(eq(cotacoes.assigneeId, id));

    await db.delete(users).where(eq(users.id, id));

    return apiSuccess({ ...toDelete, cotacoesDesvinculadas: Number(cotacoesCount) });
  } catch (error) {
    console.error("API DELETE /api/users/[id]:", error);
    return apiError("Erro ao excluir usuario", 500);
  }
}
